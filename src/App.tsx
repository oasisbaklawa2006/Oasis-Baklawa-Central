import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Link, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { LanguageProvider } from "./contexts/LanguageContext.tsx";
import { CurrencyProvider } from "./contexts/CurrencyContext.tsx";

import { Navigate } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";

// Eager — small, used on initial paint / auth flow
import Login from "./pages/Login.tsx";
import Splash from "./pages/Splash.tsx";
import NotFound from "./pages/NotFound.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import AuthErrorListener from "./components/AuthErrorListener.tsx";
import RoleProtectedRoute from "@/components/RoleProtectedRoute";
import { WhatsAppPermissionRoute } from "@/components/WhatsAppPermissionRoute";
import AdminModuleRoute from "@/components/AdminModuleRoute";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { getRoleDestination, isStaffRole, isStorefrontRole, normalizeRole } from "@/lib/auth-routing";

// Lazy — split out of the main bundle
const ResetPassword = lazy(() => import("./pages/ResetPassword.tsx"));
const BuyerApp = lazy(() => import("./pages/customer/BuyerApp.tsx"));
const BuyerAccessRequest = lazy(() => import("./pages/customer/BuyerApp.tsx").then((module) => ({ default: module.BuyerAccessRequest })));

const AdminLayout = lazy(() => import("./components/AdminLayout.tsx"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard.tsx"));
const AdminClients = lazy(() => import("./pages/admin/AdminClients.tsx"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts.tsx"));
const AdminPricing = lazy(() => import("./pages/admin/AdminPricing.tsx"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders.tsx"));
const AdminProduction = lazy(() => import("./pages/admin/AdminProduction.tsx"));
const AdminOperations = lazy(() => import("./pages/admin/AdminOperations.tsx"));
const AdminPackingDispatch = lazy(() => import("./pages/admin/AdminPackingDispatch.tsx"));
const AdminAccountsRelease = lazy(() => import("./pages/admin/AdminAccountsRelease.tsx"));
const AdminExceptions = lazy(() => import("./pages/admin/AdminExceptions.tsx"));
const AdminFinance = lazy(() => import("./pages/admin/AdminFinance.tsx"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers.tsx"));
const AdminMOQ = lazy(() => import("./pages/admin/AdminMOQ.tsx"));
const AdminCurrency = lazy(() => import("./pages/admin/AdminCurrency.tsx"));
const AdminSupport = lazy(() => import("./pages/admin/AdminSupport.tsx"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings.tsx"));
const AdminAudit = lazy(() => import("./pages/admin/AdminAudit.tsx"));
const AdminDepartment = lazy(() => import("./pages/admin/AdminDepartment.tsx"));
const OperationsController = lazy(() => import("./pages/admin/OperationsController.tsx"));
const AdminSecurityGate = lazy(() => import("./pages/admin/AdminSecurityGate.tsx"));
const AdminInventory = lazy(() => import("./pages/admin/AdminInventory.tsx"));
const AdminLogistics = lazy(() => import("./pages/admin/AdminLogistics.tsx"));
const SalesDashboard = lazy(() => import("./pages/sales/SalesDashboard.tsx"));
const SalesPerformanceHub = lazy(() => import("./pages/admin/SalesPerformanceHub.tsx"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications.tsx"));
const AdminMerchandising = lazy(() => import("./pages/admin/AdminMerchandising.tsx"));
const AdminCatalogueSyncStatus = lazy(() => import("./pages/admin/AdminCatalogueSyncStatus.tsx"));
const ApprovalInbox = lazy(() => import("./pages/admin/ApprovalInbox.tsx"));
const OrderManagement = lazy(() => import("./pages/admin/OrderManagement.tsx"));
const FactoryTVModule = lazy(() => import("./components/FactoryTVModule.tsx"));
const AssemblyManagement = lazy(() => import("./pages/admin/AssemblyManagement.tsx"));
const AssemblyTV = lazy(() => import("./pages/admin/AssemblyTV.tsx"));
const ReadyGoodsStore = lazy(() => import("./pages/admin/ReadyGoodsStore.tsx"));
const ReadyGoodsTV = lazy(() => import("./pages/admin/ReadyGoodsTV.tsx"));
const RgsDayClose = lazy(() => import("./pages/admin/RgsDayClose.tsx"));
const RgsReports = lazy(() => import("./pages/admin/RgsReports.tsx"));
const RgsStockPosition = lazy(() => import("./pages/admin/RgsStockPosition.tsx"));
const RgsProductionDemandPlanner = lazy(() => import("./pages/admin/RgsProductionDemandPlanner.tsx"));
const ThirdPartyPackingMaterialCatalogue = lazy(() => import("./pages/admin/ThirdPartyPackingMaterialCatalogue.tsx"));
const DispatchManagement = lazy(() => import("./pages/admin/DispatchManagement.tsx"));
const DispatchTV = lazy(() => import("./pages/admin/DispatchTV.tsx"));
const DisplayManagement = lazy(() => import("./pages/admin/DisplayManagement.tsx"));
const TargetVsActual = lazy(() => import("./pages/admin/TargetVsActual.tsx"));
const ThirdPartyStore = lazy(() => import("./pages/admin/ThirdPartyStore.tsx"));
const VerificationWarRoom = lazy(() => import("./pages/admin/VerificationWarRoom.tsx"));
const AdminAnnouncements = lazy(() => import("./pages/admin/AdminAnnouncements.tsx"));
const OperatorInbox = lazy(() => import("./pages/OperatorInbox.tsx"));
const FinanceReleaseBoard = lazy(() => import("./pages/admin/FinanceReleaseBoard.tsx"));
const FinanceGovernanceBoard = lazy(() => import("./pages/admin/FinanceGovernanceBoard.tsx"));
const StoreCoordination = lazy(() => import("./pages/admin/StoreCoordination.tsx"));
const LabelCommandCenter = lazy(() => import("./pages/admin/LabelCommandCenter.tsx"));
const CustomerTimelinePreview = lazy(() => import("./pages/admin/CustomerTimelinePreview.tsx"));
const OperationalGlobalSearch = lazy(() => import("./pages/admin/OperationalGlobalSearch.tsx"));
const InventoryCommandCenter = lazy(() => import("./pages/admin/InventoryCommandCenter.tsx"));
const InventoryReceiving = lazy(() => import("./pages/admin/InventoryReceiving.tsx"));
const CartonExplorer = lazy(() => import("./pages/admin/CartonExplorer.tsx"));
const ReservationBoard = lazy(() => import("./pages/admin/ReservationBoard.tsx"));
const InventoryRiskBoard = lazy(() => import("./pages/admin/InventoryRiskBoard.tsx"));
const ScanTimeline = lazy(() => import("./pages/admin/ScanTimeline.tsx"));
const LiveWorkQueues = lazy(() => import("./pages/admin/LiveWorkQueues.tsx"));
const EntityGraphExplorer = lazy(() => import("./pages/admin/EntityGraphExplorer.tsx"));
const QueueExecutionPreview = lazy(() => import("./pages/admin/QueueExecutionPreview.tsx"));
const BarcodeExecutionPreview = lazy(() => import("./pages/admin/BarcodeExecutionPreview.tsx"));
const ThreePgsProcurementQueue = lazy(() => import("./pages/admin/ThreePgsProcurementQueueComposition.tsx"));
const ProductIntelligencePrototype = lazy(
  () => import("./pages/admin/ProductIntelligencePrototype.tsx"),
);
const ExecutionCommandCenter = lazy(() => import("./pages/admin/ExecutionCommandCenter.tsx"));
const ExecutionRiskBoard = lazy(() => import("./pages/admin/ExecutionRiskBoard.tsx"));
const ExecutionBottlenecks = lazy(() => import("./pages/admin/ExecutionBottlenecks.tsx"));
// ProductionExecutionBoard / AssemblyExecutionBoard / ReadyGoodsExecutionBoard
// and DispatchExecutionBoard are no longer routed -- their routes now redirect
// to the governed canonical surfaces (see the execution/* <Route> comments
// below); the components themselves are left in place, unrouted, rather
// than deleted, since DepartmentExecutionBoard is shared with the remaining
// execution boards still in service.
const ThirdPartyExecutionBoard = lazy(() => import("./pages/admin/execution/ThirdPartyExecutionBoard.tsx"));
const RetailExecutionBoard = lazy(() => import("./pages/admin/execution/RetailExecutionBoard.tsx"));
const ComplaintsExecutionBoard = lazy(() => import("./pages/admin/execution/ComplaintsExecutionBoard.tsx"));
const DispatchReadinessBoard = lazy(() => import("./pages/admin/DispatchReadinessBoard.tsx"));
const DispatchCompletionBoard = lazy(() => import("./pages/admin/DispatchCompletionBoard.tsx"));
const DispatchFinalizationBoard = lazy(() => import("./pages/admin/DispatchFinalizationBoard.tsx"));
const StockFinalizationBoard = lazy(() => import("./pages/admin/StockFinalizationBoard.tsx"));
const GoldenChainOperatorWizard = lazy(() => import("./pages/admin/GoldenChainOperatorWizard.tsx"));

const ADMIN_ONLY_ROLES = ["SUPER_ADMIN", "ADMIN"];

const ADMIN_STAFF_ROLES = [
  ...ADMIN_ONLY_ROLES,
  "FINANCE_HEAD", "FINANCE_EXEC",
  "OPERATIONS_MANAGER", "PRODUCTION_MANAGER",
  "HOD_ARABIC", "HOD_FUSION", "HOD_CHOCOLATE", "HOD_BAKERY", "HOD_NUTS", "HOD_ASSEMBLY", "HOD_DRAGEES", "HOD_DATES",
  "STORE_INCHARGE", "DISPATCH_MANAGER", "DISPATCH_INCHARGE", "SECURITY_CONTROL",
  "SUPPORT_EXECUTIVE",
  "DISPATCH_HEAD", "ASSEMBLY_MANAGER", "PACKING_SUPERVISOR",
  "STORE_READY_GOODS", "STORE_3RD_PARTY", "GATE_SECURITY", "RGS_ADMIN",
  "PROD_ARABIC_SWEETS", "PROD_CHOCOLATE", "PROD_DRAGEES", "PROD_FUSION", "PROD_DATES", "PROD_BAKERY", "PROD_NUTS",
  "TV_DISPLAY", "TV_ASSEMBLY", "TV_READY",
  "CATALOGUE_CONTRIBUTOR",
];

const SALES_DASHBOARD_ROLES = [...ADMIN_ONLY_ROLES, "SALES_EXECUTIVE"];

const queryClient = new QueryClient();

const AuthSpinner = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div
      className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
      style={{ borderColor: "#C5A059", borderTopColor: "transparent" }}
    />
  </div>
);

/**
 * Scoped crash containment for /admin child routes. A pathless layout route
 * (no `path`, so no route/URL change) sitting between AdminLayout's <Outlet />
 * and each individual admin screen — a crash inside one screen is caught here
 * instead of bubbling to the app-root ErrorBoundary, so the admin sidebar/nav
 * (rendered by AdminLayout, an ancestor of this boundary) stays usable.
 */
const AdminRouteBoundary = () => {
  const location = useLocation();
  return (
    <ErrorBoundary key={location.pathname + location.search} fallbackTitle="This admin screen crashed">
      <Outlet />
    </ErrorBoundary>
  );
};

/**
 * Decide where an authenticated user with no resolved staff role should land.
 * Central is admin-only now — any account that isn't a recognized staff role
 * (unresolved, pending, or a buyer/customer role) lands on the same
 * customer-app-redirect gate rather than a dedicated onboarding flow.
 */
function getUnresolvedDestination(_opts: {
  hasAppliedB2B: boolean;
  profileStatus: string | null;
  role: string | null;
}): "/customer-app-redirect" {
  return "/customer-app-redirect";
}

const ADMIN_EXPRESS_EMAILS = new Set(["admin@oasisbaklawa.com"]);
const ADMIN_EXPRESS_PHONES = new Set(["+919891162212", "919891162212", "9891162212"]);

const isAdminExpressUser = (user: { email?: string | null; phone?: string | null } | null | undefined) => {
  if (!user) return false;
  const email = (user.email || "").toLowerCase();
  const phone = (user.phone || "").replace(/\s+/g, "");
  return ADMIN_EXPRESS_EMAILS.has(email) || ADMIN_EXPRESS_PHONES.has(phone);
};

const RootGate = () => {
  const { user, loading: authLoading, role, companyId, profileReady, hasAppliedB2B, profileStatus } = useAuth();
  const normalizedRole = normalizeRole(role);

  // Admin express bypass — skip heavy bootstrap waits for known admin identities
  if (user && isAdminExpressUser(user)) {
    return <Navigate to="/admin/execution-command-center" replace />;
  }

  if (authLoading || (user && !profileReady)) {
    return <AuthSpinner />;
  }

  if (!user) return <Navigate to="/login" replace />;

  if (normalizedRole && isStaffRole(normalizedRole)) {
    return <Navigate to={getRoleDestination(normalizedRole)} replace />;
  }

  if (!normalizedRole) {
    return <Navigate to={getUnresolvedDestination({ hasAppliedB2B, profileStatus, role: normalizedRole })} replace />;
  }

  if (isStorefrontRole(normalizedRole) && !companyId) {
    return <Navigate to={getUnresolvedDestination({ hasAppliedB2B, profileStatus, role: normalizedRole })} replace />;
  }

  return <Navigate to={getRoleDestination(normalizedRole)} replace />;
};

const CustomerAppRedirect = () => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
    <h1 className="text-xl font-bold">Oasis Baklawa</h1>
    <p className="max-w-sm text-sm text-muted-foreground">
      This is the Oasis Baklawa Admin Web. Customers should continue in the Oasis Baklawa mobile app to browse,
      order, and track deliveries. Staff without admin access should contact their administrator.
    </p>
    <Link to="/buyer/access-request" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Request Buyer access</Link>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ErrorBoundary fallbackTitle="Application connection interrupted">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <LanguageProvider>
              <CurrencyProvider>
                <AuthErrorListener />
                <Suspense fallback={<AuthSpinner />}>
                <Routes>
                  <Route path="/splash" element={<Splash />} />
                  <Route path="/operations-controller" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={[...ADMIN_STAFF_ROLES]}><OperationsController /></RoleProtectedRoute></ProtectedRoute>} />
                  <Route path="/security-gate" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={["GATE_SECURITY", "SECURITY_CONTROL", "SUPER_ADMIN", "ADMIN"]}><AdminSecurityGate /></RoleProtectedRoute></ProtectedRoute>} />
                  <Route path="/" element={<RootGate />} />
                  <Route path="/customer-app-redirect" element={<CustomerAppRedirect />} />
                  <Route path="/buyer/access-request" element={<ProtectedRoute><BuyerAccessRequest /></ProtectedRoute>} />
                  <Route
                    path="/buyer/*"
                    element={
                      <ProtectedRoute>
                        <RoleProtectedRoute allowedRoles={["B2B_BUYER", "SPECIAL_BUYER", "HORECA_BUYER", "WHOLESALE_BUYER", "BULK_BUYER", "BUYER", "CLIENT", "CUSTOMER_USER"]}>
                          <BuyerApp />
                        </RoleProtectedRoute>
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/login" element={<Login />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route
                    path="/admin"
                    element={
                      <ProtectedRoute>
                        <RoleProtectedRoute allowedRoles={[...ADMIN_STAFF_ROLES]}>
                          <AdminLayout />
                        </RoleProtectedRoute>
                      </ProtectedRoute>
                    }
                  >
                  <Route element={<AdminRouteBoundary />}>
                    <Route index element={<AdminDashboard />} />
                    {/* Legacy bookmarks from older audits / docs */}
                    <Route path="customers" element={<Navigate to="/admin/clients" replace />} />
                    <Route path="assembly" element={<Navigate to="/admin/assembly-tasks" replace />} />
                    <Route path="finance/payments" element={<Navigate to="/admin/finance" replace />} />
                    <Route path="finance/invoices" element={<Navigate to="/admin/finance" replace />} />
                    <Route path="crm" element={<Navigate to="/admin/clients" replace />} />
                    <Route path="roles" element={<Navigate to="/admin/users" replace />} />
                    <Route path="clients" element={<AdminClients />} />
                    <Route path="approvals" element={<AdminClients />} />
                    <Route path="products" element={<AdminProducts />} />
                    <Route path="pricing" element={<ErrorBoundary fallbackTitle="Pricing Matrix crashed"><AdminPricing /></ErrorBoundary>} />
                    <Route path="orders" element={<AdminOrders />} />
                    <Route path="production" element={<AdminProduction />} />
                    <Route path="operations" element={<AdminOperations />} />
                    <Route path="packing-dispatch" element={<AdminPackingDispatch />} />
                    <Route path="accounts-release" element={<AdminAccountsRelease />} />
                    <Route path="exceptions" element={<AdminExceptions />} />
                    <Route path="dispatch" element={<AdminPackingDispatch />} />
                    <Route path="finance" element={<AdminFinance />} />
                    <Route path="finance-board" element={<FinanceReleaseBoard />} />
                    <Route path="finance-governance" element={<FinanceGovernanceBoard />} />
                    <Route path="users" element={<AdminUsers />} />
                    <Route path="moq" element={<AdminMOQ />} />
                    <Route path="currency" element={<AdminCurrency />} />
                    <Route path="support" element={<AdminSupport />} />
                    <Route path="operator-inbox" element={<WhatsAppPermissionRoute permission="wa.intake.read"><OperatorInbox /></WhatsAppPermissionRoute>} />
                    <Route path="whatsapp" element={<WhatsAppPermissionRoute permission="wa.intake.read"><OperatorInbox /></WhatsAppPermissionRoute>} />
                    <Route path="settings" element={<AdminSettings />} />
                    <Route path="audit" element={<AdminAudit />} />
                    <Route path="department" element={<AdminDepartment />} />
                    <Route path="inventory" element={<AdminInventory />} />
                    <Route path="logistics" element={<AdminLogistics />} />
                    <Route path="sales-hub" element={<SalesPerformanceHub />} />
                    <Route path="notifications" element={<AdminNotifications />} />
                    <Route path="heartbeat" element={<AdminDashboard />} />
                    <Route path="display-management" element={<DisplayManagement />} />
                    <Route path="merchandising" element={<AdminMerchandising />} />
                    <Route path="catalogue-sync" element={<AdminCatalogueSyncStatus />} />
                    <Route path="catalogue-approvals" element={<ApprovalInbox />} />
                    <Route path="order-management" element={<OrderManagement />} />
                    <Route path="central-pool" element={<Navigate to="/admin/operator-inbox" replace />} />
                    <Route path="cmd-war-room" element={<Navigate to="/admin/operator-inbox" replace />} />
                    <Route path="inventory-command-center" element={<InventoryCommandCenter />} />
                    <Route path="inventory-receiving" element={<InventoryReceiving />} />
                    <Route path="carton-explorer" element={<CartonExplorer />} />
                    <Route path="reservation-board" element={<ReservationBoard />} />
                    <Route path="inventory-risk-board" element={<InventoryRiskBoard />} />
                    <Route path="scan-timeline" element={<ScanTimeline />} />
                    <Route path="assembly-tasks" element={<AssemblyManagement />} />
                    <Route path="assembly-tv" element={<AssemblyTV />} />
                    <Route path="ready-goods" element={<ReadyGoodsStore />} />
                    <Route path="ready-goods-day-close" element={<RgsDayClose />} />
                    <Route path="ready-goods-reports" element={<RgsReports />} />
                    <Route path="ready-goods-stock" element={<RgsStockPosition />} />
                    <Route path="production-demand-planner" element={<RgsProductionDemandPlanner />} />
                    <Route path="3pgs-packing-material" element={<ThirdPartyPackingMaterialCatalogue />} />
                    <Route path="store-coordination" element={<StoreCoordination />} />
                    <Route path="label-command-center" element={<LabelCommandCenter />} />
                    <Route
                      path="customer-timeline-preview"
                      element={
                        <AdminModuleRoute moduleKey="cmd_war_room">
                          <CustomerTimelinePreview />
                        </AdminModuleRoute>
                      }
                    />
                    <Route
                      path="operational-search"
                      element={
                        <AdminModuleRoute moduleKey="cmd_war_room">
                          <OperationalGlobalSearch />
                        </AdminModuleRoute>
                      }
                    />
                    <Route
                      path="live-work-queues"
                      element={
                        <AdminModuleRoute moduleKey="cmd_war_room">
                          <LiveWorkQueues />
                        </AdminModuleRoute>
                      }
                    />
                    <Route
                      path="entity-graph-explorer"
                      element={
                        <AdminModuleRoute moduleKey="cmd_war_room">
                          <EntityGraphExplorer />
                        </AdminModuleRoute>
                      }
                    />
                    <Route
                      path="queue-execution-preview"
                      element={
                        <AdminModuleRoute moduleKey="cmd_war_room">
                          <QueueExecutionPreview />
                        </AdminModuleRoute>
                      }
                    />
                    <Route
                      path="barcode-execution-preview"
                      element={
                        <AdminModuleRoute moduleKey="cmd_war_room">
                          <BarcodeExecutionPreview />
                        </AdminModuleRoute>
                      }
                    />
                    <Route
                      path="product-intelligence-prototype"
                      element={
                        <AdminModuleRoute moduleKey="cmd_war_room">
                          <ProductIntelligencePrototype />
                        </AdminModuleRoute>
                      }
                    />
                    <Route
                      path="execution-command-center"
                      element={
                        <AdminModuleRoute moduleKey="cmd_war_room">
                          <ExecutionCommandCenter />
                        </AdminModuleRoute>
                      }
                    />
                    <Route
                      path="execution-risk"
                      element={
                        <AdminModuleRoute moduleKey="cmd_war_room">
                          <ExecutionRiskBoard />
                        </AdminModuleRoute>
                      }
                    />
                    <Route
                      path="execution-bottlenecks"
                      element={
                        <AdminModuleRoute moduleKey="cmd_war_room">
                          <ExecutionBottlenecks />
                        </AdminModuleRoute>
                      }
                    />
                    {/*
                      execution/production, execution/assembly and
                      execution/ready-goods all read operational_queue_items,
                      a table with zero writers anywhere in
                      oasis-supabase-core's migration history for every
                      queue_type -- confirmed dead data by direct inspection.
                      Redirected to the real governed surfaces that read the
                      authoritative tables instead. execution/dispatch now
                      redirects to FACT-C3 /admin/dispatch-mgmt (Lane D).
                      execution/third-party redirects to the governed 3PGS
                      queue. execution/retail and execution/complaints remain
                      in the dead-data situation and are NOT redirected here.
                    */}
                    <Route path="execution/production" element={<Navigate to="/operations-controller" replace />} />
                    <Route path="execution/assembly" element={<Navigate to="/admin/assembly-tasks" replace />} />
                    <Route path="execution/ready-goods" element={<Navigate to="/admin/ready-goods" replace />} />
                    <Route path="execution/dispatch" element={<Navigate to="/admin/dispatch-mgmt" replace />} />
                    <Route
                      path="execution/third-party"
                      element={
                        <AdminModuleRoute moduleKey="orders">
                          <ThirdPartyExecutionBoard />
                        </AdminModuleRoute>
                      }
                    />
                    <Route
                      path="execution/retail"
                      element={
                        <AdminModuleRoute moduleKey="inventory">
                          <RetailExecutionBoard />
                        </AdminModuleRoute>
                      }
                    />
                    <Route
                      path="execution/complaints"
                      element={
                        <AdminModuleRoute moduleKey="support">
                          <ComplaintsExecutionBoard />
                        </AdminModuleRoute>
                      }
                    />
                    <Route path="rgs-tv" element={<ReadyGoodsTV />} />
                    <Route path="golden-chain-operator" element={<GoldenChainOperatorWizard />} />
                    <Route path="dispatch-readiness" element={<DispatchReadinessBoard />} />
                    <Route path="dispatch-completion" element={<DispatchCompletionBoard />} />
                    <Route path="dispatch-finalization" element={<DispatchFinalizationBoard />} />
                    <Route path="stock-finalization" element={<StockFinalizationBoard />} />
                    <Route path="dispatch-mgmt" element={<DispatchManagement />} />
                    <Route path="dispatch-tv" element={<DispatchTV />} />
                    <Route path="target-vs-actual" element={<TargetVsActual />} />
                    <Route path="3pcs-store" element={<ThirdPartyStore />} />
                    <Route
                      path="3pgs-procurement-queue"
                      element={
                        <AdminModuleRoute moduleKey="inventory">
                          <ThreePgsProcurementQueue />
                        </AdminModuleRoute>
                      }
                    />
                    <Route path="verification" element={<Navigate to="/admin/execution-command-center" replace />} />
                    <Route path="announcements" element={<AdminAnnouncements />} />
                  </Route>
                  </Route>
                  <Route
                    path="/sales/dashboard"
                    element={
                      <ProtectedRoute>
                        <RoleProtectedRoute allowedRoles={SALES_DASHBOARD_ROLES}>
                          <SalesDashboard />
                        </RoleProtectedRoute>
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/tv/arabic-sweets" element={<RoleProtectedRoute allowedRoles={["HOD_ARABIC", "PROD_ARABIC_SWEETS", "SUPER_ADMIN", "ADMIN"]}><FactoryTVModule category="Arabic Sweets" departmentFilter="Arabic Sweets" title="Arabic Sweets Line" /></RoleProtectedRoute>} />
                  {/* Chocolates & Confectionery TV also serves Dragees staff -- owner's
                      six-TV estate (Central issue #368) folds Dragees into Chocolates &
                      Confectionery rather than giving it its own screen. FactoryTVModule's
                      departmentFilter matches by TV group (productProductionDepartments.ts),
                      so "Chocolates" already includes dragees-labelled jobs/products. */}
                  <Route path="/tv/chocolate" element={<RoleProtectedRoute allowedRoles={["HOD_CHOCOLATE", "PROD_CHOCOLATE", "HOD_DRAGEES", "PROD_DRAGEES", "SUPER_ADMIN", "ADMIN"]}><FactoryTVModule category="Chocolate" departmentFilter="Chocolates" title="Chocolate Line" /></RoleProtectedRoute>} />
                  {/* Legacy standalone Dragees TV bookmark/kiosk config -- redirect rather
                      than leave an unreachable route (six-TV estate has no Dragees TV). */}
                  <Route path="/tv/dragees" element={<Navigate to="/tv/chocolate" replace />} />
                  {/* Fusion Sweets TV also serves Dates staff -- owner's six-TV estate
                      (Central issue #368) folds Dates into Fusion Sweets rather than
                      giving it its own screen. FactoryTVModule's departmentFilter
                      matches by TV group (productProductionDepartments.ts), so
                      "Fusion Sweets" already includes dates-labelled jobs/products. */}
                  <Route path="/tv/fusion" element={<RoleProtectedRoute allowedRoles={["HOD_FUSION", "PROD_FUSION", "HOD_DATES", "PROD_DATES", "SUPER_ADMIN", "ADMIN"]}><FactoryTVModule category="Fusion Sweets" departmentFilter="Fusion Sweets" title="Fusion Sweets Line" /></RoleProtectedRoute>} />
                  <Route path="/tv/bakery" element={<RoleProtectedRoute allowedRoles={["HOD_BAKERY", "PROD_BAKERY", "SUPER_ADMIN", "ADMIN"]}><FactoryTVModule category="Bakery" departmentFilter="Bakery" title="Bakery Line" /></RoleProtectedRoute>} />
                  <Route path="/tv/nuts" element={<RoleProtectedRoute allowedRoles={["HOD_NUTS", "PROD_NUTS", "SUPER_ADMIN", "ADMIN"]}><FactoryTVModule category="Seasoned Nuts" departmentFilter="Nuts Roasting" title="Nuts & Dry Fruits Line" /></RoleProtectedRoute>} />
                  {/* RGS is the sixth TV in the owner's six-TV estate (Central issue #368),
                      alongside the five production TVs above -- previously ReadyGoodsTV was
                      only reachable inside the full authenticated /admin shell
                      (/admin/rgs-tv), which is not kiosk-appropriate for a wall-mounted
                      dedicated display. This route gives it the same top-level, chrome-free
                      pattern as /tv/arabic-sweets etc.; /admin/rgs-tv is left in place
                      unchanged for in-app admin navigation. */}
                  <Route path="/tv/rgs" element={<RoleProtectedRoute allowedRoles={["STORE_READY_GOODS", "RGS_ADMIN", "TV_READY", "SUPER_ADMIN", "ADMIN"]}><ReadyGoodsTV /></RoleProtectedRoute>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
                </Suspense>
              </CurrencyProvider>
            </LanguageProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ErrorBoundary>
  </QueryClientProvider>
);

export default App;
