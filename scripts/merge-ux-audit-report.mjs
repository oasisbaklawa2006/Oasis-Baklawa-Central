/**
 * Merges audit-artifacts/raw-*.json from Playwright UX audit into docs/UX_AUDIT_PLAYWRIGHT_REPORT.md
 * Run: node scripts/merge-ux-audit-report.mjs
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const ART = path.join(ROOT, 'audit-artifacts');
const RAW = path.join(ART, 'raw');
const OUT = path.join(ROOT, 'docs', 'UX_AUDIT_PLAYWRIGHT_REPORT.md');

const projects = ['iphone-14-pro', 'iphone-se', 'ipad', 'desktop'];

function loadRaw(name) {
  const f = path.join(RAW, `raw-${name}.json`);
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

function uniq(arr) {
  return [...new Set(arr)];
}

function scoreFrom(dataByProject) {
  let score = 10;
  const critical = [];
  const high = [];
  const medium = [];

  for (const [proj, data] of Object.entries(dataByProject)) {
    if (!data?.pages) continue;
    for (const p of data.pages) {
      const skipped = p.checksSkipped === true;
      if (p.failedRequests?.some((r) => r.status >= 500)) {
        score -= 0.35;
        critical.push(`${proj}: ${p.route} — HTTP 5xx`);
      } else if (p.failedRequests?.length) {
        score -= 0.08;
        high.push(`${proj}: ${p.route} — failed requests (${p.failedRequests.length})`);
      }
      if (p.consoleErrors?.length) {
        score -= Math.min(0.15, 0.02 * p.consoleErrors.length);
        if (p.consoleErrors.length >= 3) high.push(`${proj}: ${p.route} — ${p.consoleErrors.length} console errors`);
      }
      if (!skipped && p.layout?.horizontalOverflow) {
        score -= 0.12;
        high.push(`${proj}: ${p.route} — horizontal overflow`);
      }
      if (!skipped && p.tapTargets?.smallInteractiveCount > 5 && proj !== 'desktop') {
        score -= 0.06;
        medium.push(`${proj}: ${p.route} — ${p.tapTargets.smallInteractiveCount} tap targets < 44px`);
      }
      if (!skipped && p.a11y?.imagesMissingAlt > 5) {
        score -= 0.05;
        medium.push(`${proj}: ${p.route} — ${p.a11y.imagesMissingAlt} images missing alt`);
      }
      if (!skipped && p.a11y?.buttonsMissingName > 3) {
        score -= 0.06;
        high.push(`${proj}: ${p.route} — unnamed visible buttons (${p.a11y.buttonsMissingName})`);
      }
      if (!skipped && p.tables?.anyWideOverflow) {
        score -= 0.08;
        high.push(`${proj}: ${p.route} — table wider than viewport`);
      }
      if (!p.ok) {
        score -= 0.2;
        critical.push(`${proj}: ${p.route} — navigation error: ${p.navigationError || p.error || 'unknown'}`);
      }
    }
  }
  score = Math.max(0, Math.min(10, Math.round(score * 10) / 10));
  return { score, critical: uniq(critical).slice(0, 40), high: uniq(high).slice(0, 50), medium: uniq(medium).slice(0, 40) };
}

const dataByProject = {};
for (const p of projects) {
  const d = loadRaw(p);
  if (d) dataByProject[p] = d;
}

if (Object.keys(dataByProject).length === 0) {
  console.error('No raw-*.json files under audit-artifacts/raw/. Run: npm run test:ux-audit');
  process.exit(1);
}

const { score, critical, high, medium } = scoreFrom(dataByProject);

const primary = dataByProject['iphone-14-pro'] || dataByProject[Object.keys(dataByProject)[0]];
const baseURL = primary.baseURL || 'https://cursor-central-vercel.vercel.app';

let md = `# UX audit — Playwright (mobile-first)\n\n`;
md += `**Target:** ${baseURL}  \n`;
md += `**Generated:** ${new Date().toISOString()}  \n`;
md += `**Tooling:** @playwright/test, Chromium emulation (see \`playwright.ux-audit.config.ts\`; default \`playwright.config.ts\` is for CI smoke tests).  \n`;
md += `**Artifacts:** screenshots under \`audit-artifacts/screenshots/\`; **videos** (one full journey per viewport): \`audit-artifacts/videos/*.webm\`; raw JSON under \`audit-artifacts/raw/\`.\n\n`;

md += `## Executive summary\n\n`;
md += `Automated crawl across discovered internal routes plus the static route manifest from \`src/App.tsx\`, repeated for **four** viewports (iPhone 14 Pro 390×844, iPhone SE 375×667, iPad 768×1024, desktop 1440×900). `;
md += `Each successfully loaded page captured a **full-page screenshot** (path in raw JSON as \`screenshotPath\`; omitted when navigation failed before commit). Console warnings/errors and failed XHR/document responses (4xx/5xx) are recorded for loaded pages. Heuristics (overflow, tap targets, \`alt\`, unnamed buttons, tables) are **skipped** when \`checksSkipped\` is true so stale DOM from a prior route is never attributed. `;
md += `Auth-protected pages typically redirect to login — screenshots still document that behavior.\n\n`;

md += `## Overall score (heuristic)\n\n**${score} / 10** — automated deduction for console noise, failed requests, overflow, and accessibility heuristics; not a substitute for human design QA.\n\n`;

md += `## Critical blockers\n\n`;
md += critical.length ? critical.map((c) => `- ${c}`).join('\n') : '- _(none detected by automated thresholds)_';
md += `\n\n## High severity UX / reliability issues\n\n`;
md += high.length ? high.map((c) => `- ${c}`).join('\n') : '- _(none above noise threshold)_';
md += `\n\n## Medium polish issues\n\n`;
md += medium.length ? medium.map((c) => `- ${c}`).join('\n') : '- _(see per-page tables for minor items)_';
md += `\n\n`;

md += `## Mobile-specific issues\n\n`;
md += `Issues weighted on **iphone-14-pro** and **iphone-se** projects: tap targets < 44px, horizontal overflow, long vertical scroll without sticky nav patterns (not auto-detected). See raw JSON.\n\n`;

md += `## Desktop-specific issues\n\n`;
md += `**desktop** project: overflow and table width issues; tap-target rule less relevant.\n\n`;

md += `## Accessibility issues (heuristic)\n\n`;
md += `- Images missing \`alt\` (count per page in raw JSON)\n`;
md += `- Visible \`<button>\` without text or \`aria-label\`\n`;
md += `- Full WCAG audit not performed — add axe-core / manual screen reader pass for 10/10 readiness.\n\n`;

md += `## Console / network errors\n\n`;
md += `Aggregated in \`audit-artifacts/raw/raw-<project>.json\` per page under \`consoleErrors\`, \`consoleWarnings\`, \`failedRequests\`.\n\n`;

md += `## Video walkthrough (full app journey)\n\n`;
md += `| Viewport | File |\n|----------|------|\n`;
let videoRows = 0;
for (const proj of projects) {
  const vn = `ux-audit-Mobile-first-full-UX-audit-all-viewports--${proj}.webm`;
  const p = path.join(ART, 'videos', vn);
  if (fs.existsSync(p)) {
    md += `| ${proj} | \`audit-artifacts/videos/${vn}\` (${(fs.statSync(p).size / 1e6).toFixed(1)} MB) |\n`;
    videoRows++;
  }
}
if (videoRows === 0) {
  md += `| _(none)_ | Run \`npm run test:ux-audit\` locally to produce \`audit-artifacts/videos/*.webm\`; files are gitignored. |\n`;
}
md += `\n`;
md += `| Viewport | Route | Screenshot file |\n|----------|-------|-----------------|\n`;

for (const proj of projects) {
  const d = dataByProject[proj];
  if (!d?.pages) continue;
  for (const p of d.pages) {
    const slug = p.route.replace(/^\//, '').replace(/\//g, '_') || 'root';
    const legacyPath = `audit-artifacts/screenshots/${proj}__${slug}.png`;
    let shotCell;
    if (p.screenshotPath) {
      const abs = path.join(ROOT, p.screenshotPath);
      if (fs.existsSync(abs)) shotCell = `\`${p.screenshotPath}\``;
      else shotCell = `\`${p.screenshotPath}\` _(missing on disk)_`;
    } else if (p.checksSkipped === true) {
      shotCell = '_(none — `checksSkipped`; navigation failed; see `navigationError` in raw JSON)_';
    } else {
      const absLegacy = path.join(ROOT, legacyPath);
      if (fs.existsSync(absLegacy)) shotCell = `\`${legacyPath}\``;
      else shotCell = `\`${legacyPath}\` _(not on disk — re-run audit for \`screenshotPath\`)_`;
    }
    md += `| ${proj} | \`${p.route}\` | ${shotCell} |\n`;
  }
}

md += `\n## Recommended fixes (priority)\n\n`;
md += `1. Eliminate **HTTP 5xx** and repeated **4xx** on API calls (check Supabase env on preview).\n`;
md += `2. Fix **horizontal overflow** (tables, flex rows, min-width) starting with admin finance/orders.\n`;
md += `3. Raise **tap targets** to ≥44×44px on primary actions for mobile.\n`;
md += `4. Add **alt text** and **accessible names** for icon-only controls.\n`;
md += `5. Add **loading/skeleton** consistency for slow routes.\n`;
md += `6. Run **axe** + keyboard-only pass + real-device smoke.\n\n`;

md += `## 10/10 readiness checklist\n\n`;
md += `- [ ] Zero console errors on happy-path flows\n`;
md += `- [ ] Zero failed network calls for core APIs\n`;
md += `- [ ] No horizontal scroll on all breakpoints\n`;
md += `- [ ] Tap targets ≥44px; spacing between FABs and nav\n`;
md += `- [ ] WCAG 2.2 AA axe scan clean\n`;
md += `- [ ] Keyboard + screen reader pass\n`;
md += `- [ ] Performance: LCP < 2.5s on 4G Fast emulation\n`;
md += `- [ ] Visual regression baseline in CI\n`;
md += `- [ ] Auth flows tested with real roles\n`;
md += `- [ ] Error boundaries copy reviewed for humans\n\n`;

md += `## Commands run\n\n`;
md += `\`\`\`bash\n`;
md += `npx playwright install chromium\n`;
md += `APP_URL=${baseURL} npx playwright test -c playwright.ux-audit.config.ts\n`;
md += `node scripts/merge-ux-audit-report.mjs\n`;
md += `\`\`\`\n`;

fs.writeFileSync(OUT, md, 'utf8');
console.log('Wrote', OUT);
