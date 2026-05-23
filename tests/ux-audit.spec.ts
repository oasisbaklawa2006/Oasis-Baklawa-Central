import { test, expect, type Page, type ConsoleMessage, type Response } from '@playwright/test';
/**
 * Run with: `npm run test:ux-audit` (uses `playwright.ux-audit.config.ts`; excluded from default `playwright.config.ts`).
 */
import * as fs from 'fs';
import * as path from 'path';

const ART = path.join(process.cwd(), 'audit-artifacts');
const SHOTS = path.join(ART, 'screenshots');
const VIDEOS = path.join(ART, 'videos');
const RAW = path.join(ART, 'raw');

/** Routes from `src/App.tsx` (public + common; auth-gated pages still audited for redirect/shell UX). */
const STATIC_ROUTES: string[] = [
  '/',
  '/splash',
  '/intro',
  '/track',
  '/home',
  '/welcome',
  '/catalogue',
  '/quick-order',
  '/product/1',
  '/login',
  '/register',
  '/onboarding',
  '/reset-password',
  '/terms',
  '/privacy',
  '/shipping',
  '/faq',
  '/buyer-portal',
  '/cart',
  '/orders',
  '/orders/1',
  '/dashboard',
  '/account',
  '/favorites',
  '/account/users',
  '/account/addresses',
  '/account/logistics',
  '/documents',
  '/approval-pending',
  '/operations-controller',
  '/security-gate',
  '/sales/dashboard',
  '/admin',
  '/admin/clients',
  '/admin/approvals',
  '/admin/products',
  '/admin/pricing',
  '/admin/orders',
  '/admin/production',
  '/admin/operations',
  '/admin/packing-dispatch',
  '/admin/accounts-release',
  '/admin/exceptions',
  '/admin/dispatch',
  '/admin/finance',
  '/admin/finance-board',
  '/admin/users',
  '/admin/moq',
  '/admin/currency',
  '/admin/support',
  '/admin/operator-inbox',
  '/admin/whatsapp',
  '/admin/settings',
  '/admin/audit',
  '/admin/department',
  '/admin/inventory',
  '/admin/logistics',
  '/admin/sales-hub',
  '/admin/notifications',
  '/admin/heartbeat',
  '/admin/display-management',
  '/admin/merchandising',
  '/admin/order-management',
  '/admin/central-pool',
  '/admin/cmd-war-room',
  '/admin/assembly-tasks',
  '/admin/assembly-tv',
  '/admin/ready-goods',
  '/admin/rgs-tv',
  '/admin/dispatch-mgmt',
  '/admin/dispatch-tv',
  '/admin/target-vs-actual',
  '/admin/3pcs-store',
  '/admin/verification',
  '/admin/announcements',
  '/tv/arabic-sweets',
  '/tv/chocolate',
  '/tv/dragees',
  '/tv/fusion',
  '/tv/bakery',
  '/tv/nuts',
];

type PageAudit = {
  route: string;
  finalUrl: string;
  ok: boolean;
  consoleErrors: string[];
  consoleWarnings: string[];
  failedRequests: { url: string; status: number }[];
  layout: {
    horizontalOverflow: boolean;
    bodyScrollHeight: number;
    viewportH: number;
  };
  a11y: {
    imagesMissingAlt: number;
    buttonsMissingName: number;
  };
  tapTargets: { smallInteractiveCount: number; samples: { w: number; h: number; label: string }[] };
  tables: { count: number; anyWideOverflow: boolean };
  error?: string;
};

function slugify(route: string) {
  return route.replace(/^\//, '').replace(/\//g, '_') || 'root';
}

async function discoverMoreRoutes(page: Page, max: number): Promise<string[]> {
  const hrefs = await page
    .$$eval('a[href^="/"]', (els) =>
      [...new Set(els.map((e) => (e as HTMLAnchorElement).getAttribute('href')?.split('#')[0]?.split('?')[0] || ''))].filter(Boolean),
    )
    .catch(() => [] as string[]);
  return hrefs.slice(0, max);
}

async function auditOnePage(page: Page, route: string, projectName: string): Promise<PageAudit> {
  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];
  const failedRequests: { url: string; status: number }[] = [];

  const onConsole = (msg: ConsoleMessage) => {
    const t = msg.type();
    const text = msg.text();
    if (t === 'error') consoleErrors.push(text);
    if (t === 'warning') consoleWarnings.push(text);
  };
  const onResponse = (res: Response) => {
    const st = res.status();
    const rt = res.request().resourceType();
    if (st >= 400 && ['document', 'xhr', 'fetch', 'script', 'stylesheet'].includes(rt)) {
      failedRequests.push({ url: res.url().slice(0, 200), status: st });
    }
  };
  page.on('console', onConsole);
  page.on('response', onResponse);

  let finalUrl = '';
  let ok = true;
  let errMsg: string | undefined;
  try {
    const resp = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 55_000 });
    finalUrl = page.url();
    if (resp && resp.status() >= 500) ok = false;
    await page.waitForTimeout(1200);
  } catch (e) {
    ok = false;
    errMsg = e instanceof Error ? e.message : String(e);
    finalUrl = page.url();
  } finally {
    page.off('console', onConsole);
    page.off('response', onResponse);
  }

  const layout = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const sw = Math.max(doc.scrollWidth, body?.scrollWidth ?? 0);
    const cw = doc.clientWidth;
    return {
      horizontalOverflow: sw > cw + 2,
      bodyScrollHeight: body?.scrollHeight ?? 0,
      viewportH: window.innerHeight,
    };
  });

  const a11y = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('img')].filter((i) => !(i as HTMLImageElement).alt?.trim()).length;
    let badBtn = 0;
    for (const el of document.querySelectorAll('button')) {
      const t = (el.textContent || '').trim();
      const a = el.getAttribute('aria-label');
      const hasName = t.length > 0 || (a && a.trim().length > 0);
      if (!hasName && el.getBoundingClientRect().width > 0) badBtn++;
    }
    return { imagesMissingAlt: imgs, buttonsMissingName: badBtn };
  });

  const tapTargets = await page.evaluate(() => {
    const samples: { w: number; h: number; label: string }[] = [];
    let small = 0;
    const sel = 'button, a[href], [role="button"], input[type="submit"], input[type="button"]';
    document.querySelectorAll(sel).forEach((el, i) => {
      if (i > 250) return;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      const min = Math.min(r.width, r.height);
      if (min < 44) {
        small++;
        if (samples.length < 10) {
          const label =
            (el.textContent || '').trim().slice(0, 48) ||
            el.getAttribute('aria-label')?.slice(0, 48) ||
            el.tagName;
          samples.push({ w: Math.round(r.width), h: Math.round(r.height), label });
        }
      }
    });
    return { smallInteractiveCount: small, samples };
  });

  const tables = await page.evaluate(() => {
    let anyWide = false;
    document.querySelectorAll('table').forEach((t) => {
      const r = t.getBoundingClientRect();
      if (r.width > document.documentElement.clientWidth + 2) anyWide = true;
    });
    return { count: document.querySelectorAll('table').length, anyWideOverflow: anyWide };
  });

  const safe = slugify(route);
  const shotPath = path.join(SHOTS, `${projectName}__${safe}.png`);
  try {
    await page.screenshot({ path: shotPath, fullPage: true, timeout: 45_000 });
  } catch {
    await page.screenshot({ path: shotPath.replace('.png', '-viewport.png'), fullPage: false }).catch(() => {});
  }

  return {
    route,
    finalUrl,
    ok,
    consoleErrors,
    consoleWarnings,
    failedRequests,
    layout,
    a11y,
    tapTargets,
    tables,
    error: errMsg,
  };
}

test.describe.configure({ mode: 'serial' });

test.setTimeout(2_400_000);

test('Mobile-first full UX audit (all viewports)', async ({ page }, testInfo) => {
  const project = testInfo.project.name;
  fs.mkdirSync(SHOTS, { recursive: true });
  fs.mkdirSync(VIDEOS, { recursive: true });
  fs.mkdirSync(RAW, { recursive: true });
  fs.mkdirSync(path.join(ART, 'playwright-output'), { recursive: true });

  const base =
    process.env.APP_URL ||
    process.env.BASE_URL ||
    'https://cursor-central-vercel.vercel.app';
  const discovered = new Set<string>(STATIC_ROUTES);

  try {
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    (await discoverMoreRoutes(page, 120)).forEach((r) => discovered.add(r));
  } catch {
    /* ignore */
  }
  try {
    await page.goto('/splash', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    (await discoverMoreRoutes(page, 120)).forEach((r) => discovered.add(r));
  } catch {
    /* ignore */
  }

  const routes = [...discovered].sort((a, b) => a.localeCompare(b));
  const results: PageAudit[] = [];

  for (const route of routes) {
    const audit = await auditOnePage(page, route, project);
    results.push(audit);
  }

  const out = {
    project,
    baseURL: base,
    generatedAt: new Date().toISOString(),
    routeCount: routes.length,
    pages: results,
  };
  fs.writeFileSync(path.join(RAW, `raw-${project}.json`), JSON.stringify(out, null, 2), 'utf8');
  expect(results.length).toBeGreaterThan(0);
});
