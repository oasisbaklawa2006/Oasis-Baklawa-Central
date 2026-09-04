export type AiUatStatus = "PASS" | "FAIL" | "BLOCKED";

export type AiUatRole = "DISPATCH_MANAGER" | "ASSEMBLY_MANAGER" | "ANONYMOUS";

export type AiUatCase = {
  id: `UAT-${string}`;
  title: string;
  actor: AiUatRole;
  credentialPrefix?: "TEST_DISPATCH" | "TEST_ASSEMBLY";
  startRoute: string;
  goal: string;
  expectedVisible: string[];
  forbiddenVisible: string[];
  allowedRoutes: string[];
  forbiddenRoutes: string[];
  deterministicOracle: string;
  exploratoryHints: string[];
};

export const APPVERSE_AI_UAT_TRANCHE_1: readonly AiUatCase[] = [
  {
    id: "UAT-001",
    title: "Logout terminates access",
    actor: "DISPATCH_MANAGER",
    credentialPrefix: "TEST_DISPATCH",
    startRoute: "/admin/dispatch-mgmt",
    goal: "Log out through the visible UI and verify the authenticated Dispatch session is gone without a 404 or stale Dispatch shell.",
    expectedVisible: ["Login"],
    forbiddenVisible: ["DISPATCH MANAGER", "Dispatch today", "Governed carton & DPL authority"],
    allowedRoutes: ["/admin/dispatch-mgmt", "/splash", "/login"],
    forbiddenRoutes: ["/admin/dispatch-mgmt"],
    deterministicOracle: "After logout the browser must reach the login flow and a direct revisit of /admin/dispatch-mgmt must not restore the authenticated Dispatch surface.",
    exploratoryHints: ["Use the visible Logout control.", "Note any 404, blank page, stale role badge, or delayed return to Dispatch."],
  },
  {
    id: "UAT-002",
    title: "Invalid direct URL protection",
    actor: "ANONYMOUS",
    startRoute: "/admin/finance",
    goal: "Open a protected internal URL without an authenticated session and verify that internal content is not exposed.",
    expectedVisible: ["Login"],
    forbiddenVisible: ["Finance today", "Accounts & Release", "DISPATCH MANAGER"],
    allowedRoutes: ["/admin/finance", "/login", "/splash", "/customer-app-redirect"],
    forbiddenRoutes: [],
    deterministicOracle: "An anonymous direct-open of /admin/finance must not render the Finance workspace and must end in an authentication-safe destination.",
    exploratoryHints: ["Do not authenticate.", "Treat a raw internal page, role data, or silent privileged render as FAIL."],
  },
  {
    id: "UAT-003",
    title: "Session isolation across roles",
    actor: "DISPATCH_MANAGER",
    credentialPrefix: "TEST_DISPATCH",
    startRoute: "/admin/dispatch-mgmt",
    goal: "Log out from Dispatch, log in as Assembly, and verify no Dispatch role state or Dispatch-only navigation survives the identity change.",
    expectedVisible: ["Production today"],
    forbiddenVisible: ["DISPATCH MANAGER", "Dispatch today"],
    allowedRoutes: ["/admin/dispatch-mgmt", "/splash", "/login", "/admin", "/admin/assembly-tasks", "/operations-controller"],
    forbiddenRoutes: [],
    deterministicOracle: "After Assembly login the current role must resolve as Assembly/production and no Dispatch role badge or Dispatch-home title may remain from the prior session.",
    exploratoryHints: ["Open navigation after Assembly login.", "Look for stale Dispatch cards, old Dispatch counts, or prior-role tools."],
  },
  {
    id: "UAT-004",
    title: "Dispatch Manager landing",
    actor: "DISPATCH_MANAGER",
    credentialPrefix: "TEST_DISPATCH",
    startRoute: "/admin/dispatch-mgmt",
    goal: "Verify Dispatch lands directly on the governed Dispatch workflow rather than CMD, Finance, Ready Goods, or a legacy execution screen.",
    expectedVisible: ["Dispatch", "Governed carton & DPL authority"],
    forbiddenVisible: ["Command War Room", "Finance today"],
    allowedRoutes: ["/admin", "/admin/dispatch-mgmt", "/admin/dispatch-readiness", "/admin/dispatch-completion", "/admin/dispatch-finalization"],
    forbiddenRoutes: ["/admin/cmd-war-room", "/admin/finance", "/admin/ready-goods"],
    deterministicOracle: "The post-login destination must be /admin/dispatch-mgmt or the Dispatch role home must provide the governed Dispatch workflow without redirecting into unrelated authority.",
    exploratoryHints: ["Record the first stable screen after login.", "Prefer governed DispatchManagement over legacy /admin/execution/dispatch."],
  },
  {
    id: "UAT-005",
    title: "Dispatch cannot access Finance",
    actor: "DISPATCH_MANAGER",
    credentialPrefix: "TEST_DISPATCH",
    startRoute: "/admin/dispatch-mgmt",
    goal: "Verify Finance controls are absent and a direct Finance URL fails closed for Dispatch.",
    expectedVisible: ["Dispatch"],
    forbiddenVisible: ["Finance today", "Finance queue", "Accounts & Release", "Finance governance"],
    allowedRoutes: ["/admin/dispatch-mgmt", "/admin"],
    forbiddenRoutes: ["/admin/finance", "/admin/finance-governance", "/admin/accounts-release"],
    deterministicOracle: "Dispatch must not remain on any Finance/Accounts route after direct navigation and must not be offered Finance controls in permitted navigation.",
    exploratoryHints: ["Inspect All tools if available.", "Do not infer security from hidden buttons alone; direct-route denial is mandatory."],
  },
  {
    id: "UAT-006",
    title: "Dispatch cannot see Admin Tools",
    actor: "DISPATCH_MANAGER",
    credentialPrefix: "TEST_DISPATCH",
    startRoute: "/admin",
    goal: "Open the role navigation and All tools drawer and verify Dispatch sees only Dispatch/packing workflow tools, not broad administration or governance tooling.",
    expectedVisible: ["Dispatch"],
    forbiddenVisible: ["Users", "Settings", "Audit Trail", "Executive Dashboard", "Ready Goods", "RGS ready stock", "3PGS packing material", "Security Gate", "Entity graph explorer"],
    allowedRoutes: ["/admin", "/admin/dispatch-mgmt", "/admin/dispatch-readiness", "/admin/dispatch-completion", "/admin/dispatch-finalization"],
    forbiddenRoutes: ["/admin/users", "/admin/settings", "/admin/audit", "/admin/ready-goods", "/admin/3pgs-packing-material", "/security-gate"],
    deterministicOracle: "The Dispatch role navigation must not render broad Admin/Governance/Store/Gate tools and direct protected routes must fail closed.",
    exploratoryHints: ["Open the sidebar and expand All tools.", "Scroll the complete tool list before judging."],
  },
  {
    id: "UAT-007",
    title: "Dispatch cannot see Legacy/CMD War Room",
    actor: "DISPATCH_MANAGER",
    credentialPrefix: "TEST_DISPATCH",
    startRoute: "/admin",
    goal: "Verify Command/Legacy War Room surfaces are absent and direct CMD routes fail closed for Dispatch.",
    expectedVisible: ["Dispatch"],
    forbiddenVisible: ["Execution CMD", "Command War Room", "Live work queues", "Entity graph explorer", "Product intelligence lab"],
    allowedRoutes: ["/admin", "/admin/dispatch-mgmt"],
    forbiddenRoutes: ["/admin/cmd-war-room", "/admin/execution-command-center", "/admin/live-work-queues", "/admin/entity-graph-explorer"],
    deterministicOracle: "Dispatch must have no cmd_war_room authority through cards, navigation, or direct URL access.",
    exploratoryHints: ["Expand All tools.", "Try a known CMD direct route after recording the visible menu state."],
  },
  {
    id: "UAT-008",
    title: "B2B Dispatch visibility",
    actor: "DISPATCH_MANAGER",
    credentialPrefix: "TEST_DISPATCH",
    startRoute: "/admin/dispatch-mgmt",
    goal: "Verify the governed B2B Dispatch surface renders meaningful content or an explicit empty state rather than a blank result after selecting/filtering Dispatch work.",
    expectedVisible: ["Governed consignments"],
    forbiddenVisible: [],
    allowedRoutes: ["/admin/dispatch-mgmt"],
    forbiddenRoutes: [],
    deterministicOracle: "After loading completes, DispatchManagement must show the governed-consignments UI and either rows or the explicit 'No governed consignments yet.' empty state; an unexplained blank panel is FAIL.",
    exploratoryHints: ["If a B2B Dispatch filter/control is present, exercise it.", "Record whether the result has rows, a legitimate empty-state message, or an unexplained blank area."],
  },
  {
    id: "UAT-009",
    title: "Cross-role navigation leakage",
    actor: "ASSEMBLY_MANAGER",
    credentialPrefix: "TEST_ASSEMBLY",
    startRoute: "/admin",
    goal: "Verify Assembly is offered Assembly/production work and is not offered Dispatch-only, Finance, Gate, CMD, or broad Admin authority.",
    expectedVisible: ["Production today"],
    forbiddenVisible: ["DISPATCH MANAGER", "Dispatch today", "Finance today", "Security Gate", "Execution CMD"],
    allowedRoutes: ["/admin", "/admin/assembly-tasks", "/operations-controller", "/admin/execution/production"],
    forbiddenRoutes: ["/admin/finance", "/security-gate", "/admin/cmd-war-room"],
    deterministicOracle: "Assembly role home/navigation must be production-oriented and direct unrelated authority routes must fail closed.",
    exploratoryHints: ["Inspect the first landing screen and All tools.", "Look specifically for stale Dispatch state after a prior role switch."],
  },
  {
    id: "UAT-010",
    title: "Hidden UI does not equal permission",
    actor: "DISPATCH_MANAGER",
    credentialPrefix: "TEST_DISPATCH",
    startRoute: "/admin/dispatch-mgmt",
    goal: "Prove least privilege with direct route probes even when forbidden controls are not visible in navigation.",
    expectedVisible: ["Dispatch"],
    forbiddenVisible: [],
    allowedRoutes: ["/admin/dispatch-mgmt", "/admin"],
    forbiddenRoutes: ["/admin/finance", "/admin/users", "/admin/cmd-war-room", "/admin/ready-goods", "/security-gate"],
    deterministicOracle: "Every forbidden direct route must bounce Dispatch to a permitted destination; hiding links alone is not sufficient for PASS.",
    exploratoryHints: ["Probe every forbidden route in the case definition.", "Capture the resulting URL after each denial."],
  },
] as const;

export function getAiUatCase(id: string): AiUatCase {
  const found = APPVERSE_AI_UAT_TRANCHE_1.find((entry) => entry.id === id);
  if (!found) throw new Error(`Unknown APPVERSE AI UAT case: ${id}`);
  return found;
}
