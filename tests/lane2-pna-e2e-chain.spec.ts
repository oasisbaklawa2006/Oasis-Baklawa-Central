/**
 * LANE 2 (P&A) — end-to-end chain proof, driven through real UI/auth.
 *
 * Central issue #368, Lane 2 (P&A) PR D. Proves the governed chain built in
 * PR B (oasis-supabase-core#100) and wired in PR C (#378), split into two
 * cases per an explicit dependency-boundary correction:
 *
 * 3PGS (the 3rd Party/Contract Store) IS AN EXISTING, PARTIALLY-BUILT
 * OPERATIONAL MODULE in this app -- ThirdPartyStore, ThirdPartyExecutionBoard,
 * thirdPartyQueueFeed, and its departmental routing are real and untouched
 * by this PR. b2b_assembly_3pgs_requirements (Core PR B) is the governed
 * record of a P&A packaging/outsourced shortfall against 3PGS, and 3PGS now
 * has a real, live fulfilment surface for it: ThreePgsProcurementQueue.tsx
 * (/admin/3pgs-procurement-queue) drives reserve_3pgs_requirement_stock ->
 * issue_3pgs_requirement_stock -> acknowledge_3pgs_requirement_receipt (a
 * DIFFERENT receiving actor than whoever issued), which internally calls
 * fulfil_assembly_3pgs_requirement. That RPC now credits the linked
 * b2b_assembly_components.reserved_qty/issued_qty and resumes the P&A job
 * from partially_reserved to materials_reserved once every component is
 * genuinely covered by real, receipted stock movement -- see Core's
 * 20260825100000_3pgs_pna_requirement_credit_and_resume.sql and its pgTAP
 * coverage. P&A's scope in THIS spec remains: decompose to Level 0, route
 * loose-food demand to RGS, and CREATE/EXPOSE a governed 3PGS requirement
 * for packaging/outsourced/giftware/decoration demand, respecting the
 * resulting material-readiness state -- Case B does not itself drive 3PGS's
 * resolution UI (that would require P&A's own dispatcher identity to act as
 * 3PGS too, blurring the actor boundary the RPC layer deliberately
 * separates, and this fixture's shortfall is not guaranteed to be coverable
 * by whatever stock happens to exist in a given staging run). The real,
 * governed resume-on-fulfilment path is proven directly against the RPC
 * layer by Core's pgTAP suite; this spec proves the P&A-side half of the
 * boundary -- the shortfall is real, correctly linked, and cannot be
 * bypassed or self-fulfilled from P&A's side of it.
 *
 * CASE A -- P&A executable chain, using material that is genuinely
 * available. Proves the full lifecycle end to end: pre-existing order ->
 * BOM decomposition -> assembly job -> reservation -> issue -> consumption/
 * waste/returns -> QC -> dispatcher handover -> separate receiver
 * acknowledgement -> server-derived reconciliation -> Job Completed -> Job
 * Closed. Its fixture (PNA_ORDER_NUMBER) MUST NOT contain an unresolved
 * mandatory 3PGS shortage -- this is asserted explicitly (the test fails
 * outright if the packaging/assembly source readiness ever reads "Short"),
 * not merely assumed. A FINISHED_GOODS (RGS/Production) shortfall IS
 * permitted here and is the RGS/Production proof, to the extent that lane
 * actually exists: reserve_assembly_components' fail-closed
 * partial-reservation gate and Core's fix that FINISHED_GOODS shortfalls
 * remain authorisable via authorize_partial_assembly_issue (unlike 3PGS
 * ones, which Core now refuses to bypass unconditionally).
 *
 * CASE B -- 3PGS dependency-boundary proof. A separate fixture
 * (PNA_3PGS_SHORTAGE_ORDER_NUMBER) whose BOM has a genuinely short 3PGS/
 * PACKING_ASSEMBLY/B2B_RAW-sourced component. Proves: P&A decomposition
 * raises a governed b2b_assembly_3pgs_requirements record with correct job/
 * component/correlation linkage; P&A's UI clearly shows the shortage; and
 * the job can never falsely become materially ready, issued, or complete
 * while that component remains genuinely unresolved -- authorize_partial_
 * assembly_issue refuses unconditionally (Core's dependency-boundary fix),
 * and issue_assembly_components is therefore never reachable from P&A's
 * side while the shortfall stands.
 *
 * This is a P&A-side boundary proof, not a 3PGS-side fulfilment proof: this
 * test does NOT drive 3PGS's own resolution UI (ThreePgsProcurementQueue.tsx)
 * and does NOT call fulfil_assembly_3pgs_requirement directly, because doing
 * either from P&A's own dispatcher identity would blur the actor boundary
 * the RPC layer deliberately separates (reserve/issue require
 * can_manage_b2b_inventory exercised as the 3PGS operator, and
 * acknowledgement requires can_receive_b2b_inventory as a receiver DISTINCT
 * from whoever issued -- P&A cannot self-fulfil its own request, and this
 * spec must not simulate around that). The requirement raised here is
 * genuinely, fully fulfillable once real 3PGS stock movement occurs --
 * fulfil_assembly_3pgs_requirement now credits the linked component and
 * resumes the job to materials_reserved when every component is covered
 * (20260825100000_3pgs_pna_requirement_credit_and_resume.sql in Core) -- but
 * proving that resolution path is Core's pgTAP responsibility
 * (3pgs_pna_requirement_credit_and_resume.test.sql), not this UI spec's.
 *
 * CORRECTED ORDER-CREATION PREMISE: Oasis-Baklawa-Central has NO storefront
 * checkout UI. There is no /cart or /catalogue route in this app's router,
 * and CheckoutModal.tsx is dead code (not imported anywhere). This app's
 * own root gate explicitly redirects non-staff users to a message saying
 * "Customers should continue in the Oasis Baklawa mobile app to browse,
 * order, and track deliveries" (see CustomerAppRedirect in src/App.tsx).
 * The existing phase-24c/g/k UAT specs in this repo that reference a
 * "PROCEED TO ORDER CONFIRMATION" / "Submit Sales Order" checkout flow are
 * testing UI that does not exist in current `main`; their checkout steps
 * are wrapped in soft `.isVisible().catch(() => false)` guards, which is
 * exactly why this has gone unnoticed rather than failing loudly. Each
 * order here is therefore a REQUIRED PRECONDITION supplied by order number
 * -- the exact same convention this repo's own `UAT_ORDER_SO` /
 * `PILOT_ORDERS` env vars already use elsewhere.
 *
 * STAGING-UAT-PENDING / ENVIRONMENT-PENDING: this spec has not been
 * executed and cannot currently be executed. This repository's sandbox has
 * no browser-automation runtime and no confirmed network reachability to a
 * deployed staging site or its seeded accounts/fixtures. Separately, and
 * more fundamentally: as of 2026-08-21, NO Supabase project is currently
 * approved by App-Verse environment governance as a Lane 2 certification
 * backend. `tcxvcatsqqertcnycuop` is the sole persistent/canonical Supabase
 * authority and must never be used for this mutating proof.
 * `aruyieslaxjhnamlstpx`, referenced below only as a historical marker, was
 * used in ad hoc engineering sessions before environment governance existed
 * (see docs/APP_VERSE_POINT_14_ENVIRONMENT_MATRIX_2026-07-23.md) and was
 * never named or ratified by that governance record -- it must not be
 * treated as approved, recreated, or reconnected. This spec fails closed at
 * `beforeAll` regardless of what `TEST_SUPABASE_URL` is supplied, until a
 * future, separately-approved disposable/isolated certification mechanism
 * exists. See docs/LANE2_PNA_STAGING_FIXTURE.md. No further Lane 2
 * construction is expected unless a real, environment-approved run exposes
 * a genuine defect.
 *
 * DATABASE READS: no unscoped or "latest X" read, and no anonymous read of
 * internally-governed tables. Case A's evidence reads and Case B's
 * governed-requirement-linkage read both go through a Supabase client
 * authenticated as the assembly identity (the same credentials already
 * required to drive the UI) -- Core's SELECT policies on these tables are
 * staff-only. There is no order-id-prefix translation anywhere: the order
 * number is supplied directly as a precondition, never resolved from a
 * database query.
 *
 * CREDENTIALS: every account (assembly, receiver) is REQUIRED via
 * environment variable with NO default value and NO fallback password.
 * There are no hard-coded credentials anywhere in this file.
 *
 * REQUIRED ENVIRONMENT:
 *   TEST_PREVIEW_URL        deployed site under test -- required (via
 *                           tests/e2e-helpers.ts's getPreviewUrl(), same
 *                           localhost/127.0.0.1/*.vercel.app allowlist and
 *                           post-navigation origin check used by this
 *                           repo's other UAT specs; not a credential)
 *   TEST_SUPABASE_URL       Supabase project URL backing TEST_PREVIEW_URL --
 *                           no value currently satisfies beforeAll's
 *                           refuseUnapprovedLane2Environment(), since no
 *                           project is currently approved for this purpose
 *   TEST_SUPABASE_ANON_KEY  its anon/publishable key -- used only as the
 *                           base client that PNA_ASSEMBLY_EMAIL/PASSWORD
 *                           then signs in through; never queried anonymously
 *   PNA_ASSEMBLY_EMAIL / PNA_ASSEMBLY_PASSWORD     can_manage_b2b_inventory
 *   PNA_RECEIVER_EMAIL / PNA_RECEIVER_PASSWORD     can_receive_b2b_inventory,
 *                                                   a DIFFERENT identity than
 *                                                   PNA_ASSEMBLY_* (Case A
 *                                                   only -- acknowledge_
 *                                                   assembly_handover fails
 *                                                   closed on self-
 *                                                   acknowledgement)
 *   PNA_ORDER_NUMBER        (Case A) a pre-existing order's exact
 *                           order_number. Its output product's product_bom
 *                           must have every component resolvable via
 *                           b2b_inventory_item_profiles, MUST NOT contain
 *                           any 3PGS/PACKING_ASSEMBLY/B2B_RAW component with
 *                           insufficient stock, and MAY contain a
 *                           FINISHED_GOODS component with insufficient
 *                           stock (the RGS/Production shortfall proof).
 *   PNA_3PGS_SHORTAGE_ORDER_NUMBER   (Case B) a DIFFERENT pre-existing
 *                           order's exact order_number, whose output
 *                           product's BOM includes at least one 3PGS/
 *                           PACKING_ASSEMBLY/B2B_RAW-sourced component with
 *                           LESS available stock than required.
 *
 * This spec does not, and per the governing directive must not, create
 * either order/BOM/stock fixture itself, and does not create any 3PGS
 * schema/UI/workflow -- doing either would mean seeding behind the UI or
 * building the very module whose absence this spec is proving.
 */
import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPreviewUrl } from "./e2e-helpers";

/** Narrow evidence-row shapes for Core assembly tables (not yet in database.types.ts). */
type AssemblyJobIdRow = { id: string };
type AssemblyJobStatusRow = { id: string; status: string };
type AssemblyJobPartialRow = { status: string; partial_issue_authorized: boolean };

/** Sole persistent/canonical Supabase authority (App-Verse Point 14). Lane 2 proof must never authenticate or mutate this project. */
const PRODUCTION_SUPABASE_PROJECT_REF = "tcxvcatsqqertcnycuop";
/**
 * Historical, NON-authoritative reference only. Used in ad hoc engineering
 * sessions (2026-05-30, Stage 14B/14F/14H) before App-Verse environment
 * governance existed. Never named or ratified by the canonical governance
 * record (docs/APP_VERSE_POINT_14_ENVIRONMENT_MATRIX_2026-07-23.md, FROZEN).
 * Retained here only so this constant's history is documented -- NOT to
 * authorise its use, recreation, or reconnection. See
 * docs/LANE2_PNA_STAGING_FIXTURE.md.
 */
const HISTORICAL_UNAPPROVED_STAGING_REF = "aruyieslaxjhnamlstpx";

/**
 * Fail closed, unconditionally: no Supabase project is currently approved by
 * App-Verse environment governance as a Lane 2 certification backend. This
 * spec refuses to run against ANY project -- including production and
 * including the historical, unapproved reference above -- until a future,
 * separately-approved disposable/isolated certification mechanism exists.
 * See docs/LANE2_PNA_STAGING_FIXTURE.md.
 */
function refuseUnapprovedLane2Environment(url: string, label: string): never {
  let hostname = "(unparseable)";
  try {
    hostname = new URL(url).hostname;
  } catch {
    // Reported generically below regardless of parse success.
  }
  if (hostname === `${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`) {
    throw new Error(
      `${label} points at the sole persistent/canonical Supabase project (${PRODUCTION_SUPABASE_PROJECT_REF}). Lane 2 certification must never run against it.`,
    );
  }
  throw new Error(
    `Lane 2 certification is deferred by environment governance: no Supabase project is currently approved as a staging/certification backend (this includes the historical, unapproved reference "${HISTORICAL_UNAPPROVED_STAGING_REF}"). ${label} resolved to host "${hostname}". See docs/LANE2_PNA_STAGING_FIXTURE.md.`,
  );
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`${name} is required to run this spec -- no default credential or fixture value is provided.`);
  }
  return value;
}

async function login(page: Page, email: string, password: string) {
  const previewUrl = getPreviewUrl();
  const expectedOrigin = new URL(previewUrl).origin;
  await page.goto(`${previewUrl}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const actualOrigin = new URL(page.url()).origin;
  if (actualOrigin !== expectedOrigin) {
    throw new Error(
      `Refusing to fill credentials: navigated to origin "${actualOrigin}" but expected "${expectedOrigin}" (TEST_PREVIEW_URL may have redirected off-origin).`,
    );
  }
  await page.getByRole("button", { name: /^Email$/i }).click();
  await page.getByPlaceholder("you@business.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: /^Login$/i }).click();
  await page.waitForURL((url) => !/\/login(\/|$|\?)/i.test(url.pathname), { timeout: 120_000 });
}
function errorToast(page: Page) {
  return page.locator("[data-sonner-toast]", { hasText: /failed|error|denied|blocked|requires|refused|must/i });
}
function successToast(page: Page, pattern: RegExp) {
  return page.locator("[data-sonner-toast]", { hasText: pattern });
}
function sourceReadinessBadge(page: Page, title: string) {
  return page.locator("div", { has: page.getByText(title, { exact: true }) }).first().getByText(/^(Reserved|Short|Not required)$/);
}
/** Exact, job-scoped lookup shared by both cases -- asserts the order's job resolves to exactly one row before returning it. */
async function getAssemblyJob<T extends AssemblyJobIdRow>(sb: SupabaseClient, jobNumber: string, select: string): Promise<T> {
  const { data, error } = await sb.from("b2b_assembly_jobs").select(select).eq("assembly_job_number", jobNumber);
  if (error) throw new Error(`Job lookup failed for ${jobNumber}: ${error.message}`);
  expect(data ?? [], `the exact assembly_job_number ${jobNumber} must resolve to exactly one job`).toHaveLength(1);
  const row = (data ?? [])[0] as T | undefined;
  expect(row, `job row must exist for ${jobNumber}`).toBeTruthy();
  return row as T;
}
/** Creates the job for a looked-up order, returning its exact assembly_job_number and the row prefix. */
async function lookupOrderAndCreateJob(page: Page, orderNumber: string) {
  await page.goto(`${getPreviewUrl()}/admin/assembly-tasks`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.getByText("Create assembly job from an order requirement")).toBeVisible({ timeout: 30_000 });

  await page.getByPlaceholder("SO-...").fill(orderNumber);
  await page.getByRole("button", { name: /look up order/i }).click();
  // getByText/hasText with a plain string does a substring match -- no
  // RegExp needed (and none built from this env-var-supplied value), so an
  // order number containing a regex metacharacter can never be
  // misinterpreted.
  await expect(page.getByText(`Order ${orderNumber}`)).toBeVisible({ timeout: 30_000 });

  await page.getByRole("combobox").first().click();
  await page.getByRole("option").first().click();
  await page.getByPlaceholder(/planned qty|qty/i).first().fill("1");
  await page.getByRole("button", { name: /^create assembly job$/i }).click();
  await expect(successToast(page, /assembly job created/i)).toBeVisible({ timeout: 30_000 });

  // The exact job belongs to THIS order: assembly_job_number is constructed
  // client-side as `ASM-${order_number}-${suffix}`, so a row containing
  // that exact prefix is this order's job, never "the first row in the
  // queue". Extracted with plain string operations plus a LITERAL regex
  // (not built from a variable), so no non-literal RegExp construction is
  // needed anywhere in this lookup.
  const jobPrefix = `ASM-${orderNumber}-`;
  const jobRow = page.locator("button").filter({ hasText: jobPrefix }).first();
  await expect(jobRow).toBeVisible({ timeout: 30_000 });
  const jobRowText = (await jobRow.textContent()) ?? "";
  const prefixIndex = jobRowText.indexOf(jobPrefix);
  expect(prefixIndex, `job row text must contain the exact prefix ${jobPrefix}`).toBeGreaterThanOrEqual(0);
  const suffix = jobRowText.slice(prefixIndex + jobPrefix.length).match(/^[A-Z0-9]+/)?.[0] ?? "";
  const jobNumber = jobPrefix + suffix;
  expect(suffix, "must capture the exact assembly_job_number suffix for this order's job").toBeTruthy();
  await jobRow.click();
  return { jobNumber, jobPrefix };
}

test.describe("Lane 2 (P&A) end-to-end chain [STAGING-UAT-PENDING]", () => {
  let TEST_SUPABASE_URL: string;
  let TEST_SUPABASE_ANON_KEY: string;
  let ASSEMBLY_EMAIL: string;
  let ASSEMBLY_PASSWORD: string;
  let RECEIVER_EMAIL: string;
  let RECEIVER_PASSWORD: string;
  let ORDER_NUMBER: string;
  let SHORTAGE_ORDER_NUMBER: string;

  test.beforeAll(() => {
    TEST_SUPABASE_URL = requireEnv("TEST_SUPABASE_URL");
    refuseUnapprovedLane2Environment(TEST_SUPABASE_URL, "TEST_SUPABASE_URL");
    TEST_SUPABASE_ANON_KEY = requireEnv("TEST_SUPABASE_ANON_KEY");
    ASSEMBLY_EMAIL = requireEnv("PNA_ASSEMBLY_EMAIL");
    ASSEMBLY_PASSWORD = requireEnv("PNA_ASSEMBLY_PASSWORD");
    RECEIVER_EMAIL = requireEnv("PNA_RECEIVER_EMAIL");
    RECEIVER_PASSWORD = requireEnv("PNA_RECEIVER_PASSWORD");
    ORDER_NUMBER = requireEnv("PNA_ORDER_NUMBER");
    SHORTAGE_ORDER_NUMBER = requireEnv("PNA_3PGS_SHORTAGE_ORDER_NUMBER");
    if (ASSEMBLY_EMAIL === RECEIVER_EMAIL) {
      throw new Error("PNA_ASSEMBLY_EMAIL and PNA_RECEIVER_EMAIL must be different identities -- acknowledge_assembly_handover fails closed on self-acknowledgement.");
    }
    if (ORDER_NUMBER === SHORTAGE_ORDER_NUMBER) {
      throw new Error("PNA_ORDER_NUMBER and PNA_3PGS_SHORTAGE_ORDER_NUMBER must be different orders: Case A must not carry the mandatory 3PGS shortage that Case B specifically requires.");
    }
  });

  /** Authenticated as the assembly/dispatcher identity -- never anon. Used only for read-only verification of governed evidence the UI itself doesn't render in full. */
  async function assemblyAuthedSupabase(): Promise<SupabaseClient> {
    const sb = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY);
    const { error } = await sb.auth.signInWithPassword({ email: ASSEMBLY_EMAIL, password: ASSEMBLY_PASSWORD });
    if (error) throw new Error(`Assembly-identity Supabase auth failed for evidence verification: ${error.message}`);
    return sb;
  }

  test("CASE A -- executable P&A chain on genuinely available material: order -> BOM decomposition -> reservation (RGS/Production shortfall permitted, NO 3PGS shortfall permitted) -> issue -> consumption -> QC -> receiver-acknowledged handover (zero receipt, then full receipt) -> server-derived reconciliation (fails closed, then succeeds once explained) -> Job Completed -> Job Closed", async ({ browser }: { browser: Browser }) => {
    test.setTimeout(10 * 60 * 1000);
    const contexts: BrowserContext[] = [];
    async function isolatedPage(): Promise<Page> {
      const ctx = await browser.newContext();
      contexts.push(ctx);
      return ctx.newPage();
    }

    try {
      const assemblyPage = await isolatedPage();
      await login(assemblyPage, ASSEMBLY_EMAIL, ASSEMBLY_PASSWORD);
      const { jobNumber, jobPrefix } = await lookupOrderAndCreateJob(assemblyPage, ORDER_NUMBER);

      await assemblyPage.getByRole("button", { name: /^reserve components$/i }).click();

      // Load-bearing precondition check, not an assumption: Case A's fixture
      // must never carry a 3PGS shortfall. If it does, this is a fixture
      // misconfiguration and the test fails outright rather than silently
      // exercising the wrong case.
      await expect(
        sourceReadinessBadge(assemblyPage, "Packaging & assembly sources"),
        "PNA_ORDER_NUMBER must not have any 3PGS/PACKING_ASSEMBLY/B2B_RAW component short -- that is Case B's fixture, not Case A's. Case A proves the executable chain on genuinely available material.",
      ).toHaveText(/Reserved|Not required/, { timeout: 15_000 });

      const evidenceSb = await assemblyAuthedSupabase();
      const jobRow = await getAssemblyJob<AssemblyJobIdRow>(evidenceSb, jobNumber, "id");

      const { data: pgsRequirement, error: pgsRequirementError } = await evidenceSb
        .from("b2b_assembly_3pgs_requirements")
        .select("id")
        .eq("assembly_job_id", jobRow.id);
      if (pgsRequirementError) throw new Error(`3PGS requirement evidence lookup failed: ${pgsRequirementError.message}`);
      expect((pgsRequirement ?? []).length, "Case A must raise zero 3PGS requirements -- confirms no mandatory 3PGS shortage exists on this fixture").toBe(0);

      // The RGS/Production shortfall proof, to the extent that lane exists:
      // a FINISHED_GOODS shortfall IS permitted and IS authorisable.
      const issueDirectAttempt = assemblyPage.getByRole("button", { name: /^issue components$/i });
      const partialIssueReasonInput = assemblyPage.getByPlaceholder(/reason to authorise a partial issue/i);
      if (await partialIssueReasonInput.isVisible().catch(() => false)) {
        if (await issueDirectAttempt.isVisible().catch(() => false)) {
          await issueDirectAttempt.click();
          await expect(errorToast(assemblyPage)).toBeVisible({ timeout: 15_000 });
        }
        await partialIssueReasonInput.fill(
          "PR D e2e proof, Case A: proceeding on real available stock; the FINISHED_GOODS shortfall was routed to RGS/Production (a real, implemented lane)",
        );
        await assemblyPage.getByRole("button", { name: /authorise partial issue/i }).click();
        await expect(successToast(assemblyPage, /authoris/i)).toBeVisible({ timeout: 15_000 });
        await assemblyPage.getByRole("button", { name: /issue components \(partial, authorised\)/i }).click();
      } else {
        await assemblyPage.getByRole("button", { name: /^issue components$/i }).click();
      }
      await expect(successToast(assemblyPage, /issue/i)).toBeVisible({ timeout: 30_000 });

      // Consumption: deliberately leave exactly 1 unit of residue per
      // component so reconciliation's server-derived variance is a real,
      // non-zero, fully-deterministic value regardless of the BOM's actual
      // quantities.
      const componentRows = assemblyPage.locator("table tbody tr");
      const rowCount = await componentRows.count();
      for (let i = 0; i < rowCount; i += 1) {
        const row = componentRows.nth(i);
        const issuedText = await row.locator("td").nth(4).textContent();
        const issuedQty = Number((issuedText ?? "0").replace(/[^0-9.]/g, ""));
        if (issuedQty <= 0) continue;
        const consumeQty = Math.max(0, issuedQty - 1);
        await row.locator("input").nth(0).fill(String(consumeQty));
        await row.getByRole("button", { name: /^log$/i }).click();
        await expect(successToast(assemblyPage, /consumption recorded/i)).toBeVisible({ timeout: 15_000 });
      }

      await assemblyPage.getByPlaceholder(/completed qty/i).fill("1");
      await assemblyPage.getByRole("button", { name: /^send to qc$/i }).click();
      await expect(successToast(assemblyPage, /sent to qc/i)).toBeVisible({ timeout: 15_000 });

      await assemblyPage.getByPlaceholder(/^accepted$/i).fill("1");
      await assemblyPage.getByPlaceholder(/^rejected$/i).fill("0");
      await assemblyPage.getByRole("button", { name: /record qc decision/i }).click();
      await expect(successToast(assemblyPage, /qc decision/i)).toBeVisible({ timeout: 15_000 });

      const destinationReference = `E2E-PROOF-CASE-A-${Date.now()}`;
      await assemblyPage.getByPlaceholder(/destination reference/i).fill(destinationReference);
      await assemblyPage.getByPlaceholder(/^qty$/i).fill("1");
      await assemblyPage.getByRole("button", { name: /dispatch \(initiate handover\)/i }).click();
      await expect(successToast(assemblyPage, /handover dispatched/i)).toBeVisible({ timeout: 15_000 });

      // Receiver identity, its OWN isolated context: genuinely independent
      // auth session. Zero receipt, then the remainder -- proving neither a
      // zero nor a short receipt can by itself satisfy Handed Over.
      const receiverPage = await isolatedPage();
      await login(receiverPage, RECEIVER_EMAIL, RECEIVER_PASSWORD);
      await receiverPage.goto(`${getPreviewUrl()}/admin/assembly-tasks`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      const receiverJobRow = receiverPage.locator("button").filter({ hasText: jobPrefix }).first();
      await expect(receiverJobRow).toBeVisible({ timeout: 30_000 });
      await receiverJobRow.click();

      await receiverPage.getByPlaceholder(/received qty/i).fill("0");
      await receiverPage.getByRole("button", { name: /acknowledge as receiver/i }).click();
      await expect(successToast(receiverPage, /acknowledged/i)).toBeVisible({ timeout: 15_000 });
      await expect(receiverPage.getByText(/reconciliation_pending|job completed/i)).not.toBeVisible();

      await receiverPage.getByPlaceholder(/received qty/i).fill("1");
      await receiverPage.getByRole("button", { name: /acknowledge as receiver/i }).click();
      await expect(successToast(receiverPage, /acknowledged/i)).toBeVisible({ timeout: 15_000 });

      await expect(receiverPage.getByText(/server-computed variance/i)).toBeVisible({ timeout: 30_000 });
      const varianceText = (await receiverPage.getByText(/server-computed variance/i).textContent()) ?? "";
      expect(/variance:\s*[1-9]/.test(varianceText), "consumption was deliberately under-logged by 1 unit per component -- the server-computed variance must be a real, non-zero figure").toBe(true);

      const reconcileButton = receiverPage.getByRole("button", { name: /reconcile \(to job completed\)/i });
      await reconcileButton.click();
      await expect(errorToast(receiverPage)).toBeVisible({ timeout: 15_000 });

      await receiverPage.getByPlaceholder(/notes/i).fill("PR D e2e proof, Case A: 1 unit of deliberate consumption residue per component, written off after floor check");
      await reconcileButton.click();
      await expect(successToast(receiverPage, /reconciled/i)).toBeVisible({ timeout: 15_000 });

      await receiverPage.getByRole("button", { name: /^close job$/i }).click();
      await expect(successToast(receiverPage, /job closed/i)).toBeVisible({ timeout: 15_000 });
      test.info().annotations.push({
        type: "staging-cleanup",
        description: `Case A completed job ${jobNumber} on order ${ORDER_NUMBER} — re-seed fixture per docs/LANE2_PNA_STAGING_FIXTURE.md`,
      });
    } finally {
      for (const ctx of contexts) await ctx.close();
    }
  });

  test("CASE B -- 3PGS dependency-boundary proof: a mandatory 3PGS-sourced shortfall raises exact governed evidence and can NEVER be bypassed or self-fulfilled from P&A's side, and stays correctly blocked until 3PGS's own governed reserve/issue/acknowledge bridge actually resolves it (proven separately in Core's pgTAP suite)", async ({ browser }: { browser: Browser }) => {
    test.setTimeout(5 * 60 * 1000);
    const ctx = await browser.newContext();
    try {
      const page = await ctx.newPage();
      await login(page, ASSEMBLY_EMAIL, ASSEMBLY_PASSWORD);
      const { jobNumber } = await lookupOrderAndCreateJob(page, SHORTAGE_ORDER_NUMBER);

      await page.getByRole("button", { name: /^reserve components$/i }).click();

      // Load-bearing precondition check: this fixture MUST actually be
      // short on a 3PGS/PACKING_ASSEMBLY/B2B_RAW component, or this test is
      // not exercising the boundary it claims to.
      await expect(
        sourceReadinessBadge(page, "Packaging & assembly sources"),
        "PNA_3PGS_SHORTAGE_ORDER_NUMBER's BOM must include a 3PGS/PACKING_ASSEMBLY/B2B_RAW component with insufficient stock -- this test does not silently pass without a real, mandatory 3PGS shortage",
      ).toHaveText("Short", { timeout: 15_000 });
      await expect(page.getByText(/^partially_reserved$/i).or(page.getByText(/partially_reserved/i))).toBeVisible().catch(() => {
        // status text rendering may vary; the authoritative check is the evidence read below.
      });

      // Governed downstream evidence: an exact, job-scoped, authenticated
      // read (never anonymous, never "latest") confirming
      // reserve_assembly_components raised a real b2b_assembly_
      // 3pgs_requirements row with correct job/component/correlation
      // linkage -- P&A's actual current scope for this dependency.
      const evidenceSb = await assemblyAuthedSupabase();
      const shortageJob = await getAssemblyJob<AssemblyJobStatusRow>(evidenceSb, jobNumber, "id, status");
      expect(shortageJob.status, "the job must genuinely be partially_reserved -- not materials_reserved, not further along").toBe("partially_reserved");

      const { data: pgsRequirements, error: pgsRequirementError } = await evidenceSb
        .from("b2b_assembly_3pgs_requirements")
        .select("id, assembly_job_id, assembly_component_id, correlation_id, status")
        .eq("assembly_job_id", shortageJob.id);
      if (pgsRequirementError) throw new Error(`3PGS requirement evidence lookup failed: ${pgsRequirementError.message}`);
      expect((pgsRequirements ?? []).length, "reserve_assembly_components must have raised at least one real governed 3PGS requirement for this exact job").toBeGreaterThan(0);
      for (const requirement of pgsRequirements ?? []) {
        expect(requirement.assembly_job_id, "each requirement must be linked to this exact job").toBe(shortageJob.id);
        expect(requirement.assembly_component_id, "each requirement must be linked to an exact component").toBeTruthy();
        expect(requirement.correlation_id, "each requirement must carry a correlation id").toBeTruthy();
      }

      const { data: shortComponents, error: componentError } = await evidenceSb
        .from("b2b_assembly_components")
        .select("id, source_store_code, required_qty, reserved_qty")
        .eq("assembly_job_id", shortageJob.id)
        .in("source_store_code", ["3PGS", "PACKING_ASSEMBLY", "B2B_RAW"]);
      if (componentError) throw new Error(`Component evidence lookup failed: ${componentError.message}`);
      const genuinelyShort = (shortComponents ?? []).filter((c) => Number(c.reserved_qty) < Number(c.required_qty));
      expect(genuinelyShort.length, "at least one 3PGS/packaging component must be genuinely short of its required quantity").toBeGreaterThan(0);
      for (const requirement of pgsRequirements ?? []) {
        expect(
          genuinelyShort.some((c) => c.id === requirement.assembly_component_id),
          "each 3PGS requirement must be linked to a component that is actually, currently short -- not an arbitrary component",
        ).toBe(true);
      }

      // The dependency boundary itself: P&A's own manager-authority override
      // refuses, unconditionally, to bypass this -- even though the
      // requirement is genuinely fulfillable via 3PGS's own governed
      // reserve/issue/acknowledge bridge, that bridge has not been driven
      // here, so the shortfall is still real and the bypass must still be
      // refused. Do NOT fabricate 3PGS fulfilment and do NOT self-fulfil --
      // this test never calls fulfil_assembly_3pgs_requirement, and never
      // drives ThreePgsProcurementQueue.tsx, at all.
      await page.getByPlaceholder(/reason to authorise a partial issue/i).fill(
        "PR D e2e proof, Case B: attempting to bypass the outstanding 3PGS/packaging shortfall (this must be refused)",
      );
      await page.getByRole("button", { name: /authorise partial issue/i }).click();
      await expect(
        page.locator("[data-sonner-toast]", { hasText: /3PGS completion work pending/i }),
        "authorize_partial_assembly_issue must refuse, unconditionally, to bypass an unresolved 3PGS/packaging shortfall",
      ).toBeVisible({ timeout: 15_000 });

      // issue_assembly_components must remain unreachable: the UI only
      // exposes "Issue components (partial, authorised)" once
      // partial_issue_authorized is true, which the refusal above never set.
      await expect(page.getByRole("button", { name: /issue components \(partial, authorised\)/i })).not.toBeVisible();
      await expect(page.getByPlaceholder(/reason to authorise a partial issue/i)).toBeVisible();

      // The ordinary (non-authorised) "Issue components" action is not just
      // refused server-side -- AssemblyManagement.tsx's own status-gated
      // ActionBar never renders it while status === "partially_reserved"
      // (that status only ever shows "Retry reservation" plus either the
      // partial-issue-authorise flow, or once authorised, "Issue components
      // (partial, authorised)" -- the plain button only appears once
      // materials_reserved). Assert that absence explicitly so this is a
      // real UI-contract check, not a silently-skipped no-op.
      await expect(
        page.getByRole("button", { name: /^issue components$/i }),
        "the ordinary (non-authorised) Issue components button must not be offered while partially_reserved with an unresolved 3PGS shortfall",
      ).not.toBeVisible();

      const { data: recheckJob, error: recheckError } = await evidenceSb
        .from("b2b_assembly_jobs")
        .select("status, partial_issue_authorized")
        .eq("id", shortageJob.id)
        .single();
      if (recheckError) throw new Error(`Post-refusal job re-check failed: ${recheckError.message}`);
      const partialRow = recheckJob as AssemblyJobPartialRow;
      expect(partialRow.partial_issue_authorized, "the refused authorization attempt must not have been recorded").toBe(false);
      // Still partially_reserved here because THIS test never drove 3PGS's
      // real reserve/issue/acknowledge bridge against the shortfall -- not
      // because no such bridge exists. A genuinely resolved requirement DOES
      // resume this exact job to materials_reserved (proven directly against
      // the RPC layer in Core's 3pgs_pna_requirement_credit_and_resume.test.sql);
      // this assertion only confirms the job never falsely resumes on its own
      // while the shortfall remains genuinely unresolved.
      expect(partialRow.status, "the job must remain at partially_reserved while its 3PGS shortfall remains genuinely unresolved -- it can never falsely reach materially ready or Job Completed on its own").toBe("partially_reserved");
      test.info().annotations.push({
        type: "staging-cleanup",
        description: `Case B partial job ${jobNumber} on order ${SHORTAGE_ORDER_NUMBER} — reset fixture per docs/LANE2_PNA_STAGING_FIXTURE.md`,
      });
    } finally {
      await ctx.close();
    }
  });
});
