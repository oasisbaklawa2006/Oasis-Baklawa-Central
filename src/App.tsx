import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
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
import AdminModuleRoute from "@/components/AdminModuleRoute";
import PremiumAnnouncementOverlay from "@/components/PremiumAnnouncementOverlay";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { getRoleDestination, isStaffRole, isStorefrontRole, normalizeRole } from "@/lib/auth-routing";

// Lazy — split out of the main bundle
const CompanyIntro = lazy(() => import("./pages/CompanyIntro.tsx"));
const Catalogue = lazy(() => import("./pages/Catalogue.tsx"));
const QuickOrder = lazy(() => import("./pages/QuickOrder.tsx"));
const Orders = lazy(() => import("./pages/Orders.tsx"));
const Cart = lazy(() => import("./pages/Cart.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const ProductDetail = lazy(() => import("./pages/ProductDetail.tsx"));
const Account = lazy(() => import("./pages/Account.tsx"));
const Favorites = lazy(() => import("./pages/Favorites.tsx"));
const Documents = lazy(() => import("./pages/Documents.tsx"));
const Register = lazy(() => import("./pages/Register.tsx"));
const Onboarding = lazy(() => import("./pages/Onboarding.tsx"));
const BuyerPortal = lazy(() => import("./pages/BuyerPortal.tsx"));
const Index = lazy(() => import("./pages/Index.tsx"));
const ApprovalPending = lazy(() => import("./pages/ApprovalPending.tsx"));
const WelcomeGate = lazy(() => import("./pages/WelcomeGate.tsx"));
const OrderTracking = lazy(() => import("./pages/OrderTracking.tsx"));
const PublicOrderTracking = lazy(() => import("./pages/PublicOrderTracking.tsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.tsx"));
const FAQ = lazy(() => import("./pages/FAQ.tsx"));
const Privacy = lazy(() => import("./pages/Privacy.tsx"));
const PublicTerms = lazy(() => import("./pages/PublicTerms.tsx"));
const Shipping = lazy(() => import("./pages/Shipping.tsx"));

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
const ManageUsers = lazy(() => import("./pages/ManageUsers.tsx"));
const ManageAddresses = lazy(() => import("./pages/ManageAddresses.tsx"));
const ManageLogistics = lazy(() => import("./pages/ManageLogistics.tsx"));
const SalesDashboard = lazy(() => import("./pages/sales/SalesDashboard.tsx"));
const SalesPerformanceHub = lazy(() => import("./pages/admin/SalesPerformanceHub.tsx"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications.tsx"));
const CMDWarRoom = lazy(() => import("./pages/admin/CMDWarRoom.tsx"));
const AdminMerchandising = lazy(() => import("./pages/admin/AdminMerchandising.tsx"));
const OrderManagement = lazy(() => import("./pages/admin/OrderManagement.tsx"));
const CentralOrderPool = lazy(() => import("./pages/admin/CentralOrderPool.tsx"));
const FactoryTVModule = lazy(() => import("./components/FactoryTVModule.tsx"));
const AssemblyManagement = lazy(() => import("./pages/admin/AssemblyManagement.tsx"));
const AssemblyTV = lazy(() => import("./pages/admin/AssemblyTV.tsx"));
const ReadyGoodsStore = lazy(() => import("./pages/admin/ReadyGoodsStore.tsx"));
const ReadyGoodsTV = lazy(() => import("./pages/admin/ReadyGoodsTV.tsx"));
const DispatchManagement = lazy(() => import("./pages/admin/DispatchManagement.tsx"));
const DispatchTV = lazy(() => import("./pages/admin/DispatchTV.tsx"));
const DisplayManagement = lazy(() => import("./pages/admin/DisplayManagement.tsx"));
const TargetVsActual = lazy(() => import("./pages/admin/TargetVsActual.tsx"));
const ThirdPartyStore = lazy(() => import("./pages/admin/ThirdPartyStore.tsx"));
const VerificationWarRoom = lazy(() => import("./pages/admin/VerificationWarRoom.tsx"));
const AdminAnnouncements = lazy(() => import("./pages/admin/AdminAnnouncements.tsx"));
const OperatorInbox = lazy(() => import("./pages/OperatorInbox.tsx"));
const FinanceReleaseBoard = lazy(() => import("./pages/admin/FinanceReleaseBoard.tsx"));
const StoreCoordination = lazy(() => import("./pages/admin/StoreCoordination.tsx"));
const LabelCommandCenter = lazy(() => import("./pages/admin/LabelCommandCenter.tsx"));
const CustomerTimelinePreview = lazy(() => import("./pages/admin/CustomerTimelinePreview.tsx"));
const OperationalGlobalSearch = lazy(() => import("./pages/admin/OperationalGlobalSearch.tsx"));
const InventoryCommandCenter = lazy(() => import("./pages/admin/InventoryCommandCenter.tsx"));
const CartonExplorer = lazy(() => import("./pages/admin/CartonExplorer.tsx"));
const ReservationBoard = lazy(() => import("./pages/admin/ReservationBoard.tsx"));
const InventoryRiskBoard = lazy(() => import("./pages/admin/InventoryRiskBoard.tsx"));
const ScanTimeline = lazy(() => import("./pages/admin/ScanTimeline.tsx"));
const LiveWorkQueues = lazy(() => import("./pages/admin/LiveWorkQueues.tsx"));
const EntityGraphExplorer = lazy(() => import("./pages/admin/EntityGraphExplorer.tsx"));
const QueueExecutionPreview = lazy(() => import("./pages/admin/QueueExecutionPreview.tsx"));
const BarcodeExecutionPreview = lazy(() => import("./pages/admin/BarcodeExecutionPreview.tsx"));
const ExecutionCommandCenter = lazy(() => import("./pages/admin/ExecutionCommandCenter.tsx"));
const ExecutionRiskBoard = lazy(() => import("./pages/admin/ExecutionRiskBoard.tsx"));
const ExecutionBottlenecks = lazy(() => import("./pages/admin/ExecutionBottlenecks.tsx"));
const ProductionExecutionBoard = lazy(() => import("./pages/admin/execution/ProductionExecutionBoard.tsx"));
const AssemblyExecutionBoard = lazy(() => import("./pages/admin/execution/AssemblyExecutionBoard.tsx"));
const ReadyGoodsExecutionBoard = lazy(() => import("./pages/admin/execution/ReadyGoodsExecutionBoard.tsx"));
const DispatchExecutionBoard = lazy(() => import("./pages/admin/execution/DispatchExecutionBoard.tsx"));
const ThirdPartyExecutionBoard = lazy(() => import("./pages/admin/execution/ThirdPartyExecutionBoard.tsx"));
const RetailExecutionBoard = lazy(() => import("./pages/admin/execution/RetailExecutionBoard.tsx"));
const ComplaintsExecutionBoard = lazy(() => import("./pages/admin/execution/ComplaintsExecutionBoard.tsx"));

const ADMIN_ONLY_ROLES = ["SUPER_ADMIN", "ADMIN"];

const ADMIN_STAFF_ROLES = [
  ...ADMIN_ONLY_ROLES,
  "FINANCE_HEAD", "FINANCE_EXEC",
  "OPERATIONS_MANAGER", "PRODUCTION_MANAGER",
  "HOD_ARABIC", "HOD_FUSION", "HOD_CHOCOLATE", "HOD_BAKERY", "HOD_NUTS", "HOD_ASSEMBLY", "HOD_DRAGEES",
  "STORE_INCHARGE", "DISPATCH_MANAGER", "DISPATCH_INCHARGE", "SECURITY_CONTROL",
  "SUPPORT_EXECUTIVE",
  "DISPATCH_HEAD", "ASSEMBLY_MANAGER", "PACKING_SUPERVISOR",
  "STORE_READY_GOODS", "STORE_3RD_PARTY", "GATE_SECURITY", "RGS_ADMIN",
  "PROD_ARABIC_SWEETS", "PROD_CHOCOLATE", "PROD_DRAGEES", "PROD_FUSION", "PROD_BAKERY", "PROD_NUTS",
  "TV_DISPLAY", "TV_ASSEMBLY", "TV_READY",
  "CATALOGUE_CONTRIBUTOR",
];

const SALES_DASHBOARD_ROLES = [...ADMIN_ONLY_ROLES, "SALES_EXECUTIVE"];

const ALL_BUYER_ROLES = [
  "B2B_BUYER", "SPECIAL_BUYER", "HORECA_BUYER", "WHOLESALE_BUYER", "BULK_BUYER",
  "BUYER", "CUSTOMER_USER", "CLIENT",
];

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
 * Decide where an authenticated user with no resolved buyer role should land.
 * - Pending applicant (b2b application exists OR profile.status pending OR role='PENDING') → /approval-pending
 * - Fresh lead (auth.users only, zero portal records) → /register
 */
function getUnresolvedDestination(_opts: {
  hasAppliedB2B: boolean;
  profileStatus: string | null;
  role: string | null;
}): "/welcome" {
  // Nuclear option: never auto-route unresolved users to /register or /approval-pending
  // from the RootGate. Always park them at /welcome and let them choose.
  return "/welcome";
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
    return <Navigate to="/admin/cmd-war-room" replace />;
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

const StorefrontGate = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading, role, companyId, profileReady, hasAppliedB2B, profileStatus } = useAuth();
  const normalizedRole = normalizeRole(role);

  if (authLoading || (user && !profileReady)) {
    return <AuthSpinner />;
  }

  if (user && isAdminExpressUser(user)) {
    return <Navigate to="/admin/cmd-war-room" replace />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (normalizedRole && isStaffRole(normalizedRole)) {
    return <Navigate to={getRoleDestination(normalizedRole)} replace />;
  }

  if (!normalizedRole) {
    return <Navigate to={getUnresolvedDestination({ hasAppliedB2B, profileStatus, role: normalizedRole })} replace />;
  }

  if (!isStorefrontRole(normalizedRole)) {
    return <Navigate to={getRoleDestination(normalizedRole)} replace />;
  }

  if (!companyId) {
    return <Navigate to={getUnresolvedDestination({ hasAppliedB2B, profileStatus, role: normalizedRole })} replace />;
  }

  return <>{children}</>;
};

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
                <PremiumAnnouncementOverlay />
                <Suspense fallback={<AuthSpinner />}>
                <Routes>
                  <Route path="/splash" element={<Splash />} />
                  <Route path="/intro" element={<CompanyIntro />} />
                  <Route path="/track" element={<PublicOrderTracking />} />
                  <Route path="/operations-controller" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={[...ADMIN_STAFF_ROLES]}><OperationsController /></RoleProtectedRoute></ProtectedRoute>} />
                  <Route path="/security-gate" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={["GATE_SECURITY", "SECURITY_CONTROL", "SUPER_ADMIN", "ADMIN"]}><AdminSecurityGate /></RoleProtectedRoute></ProtectedRoute>} />
                  <Route path="/" element={<RootGate />} />
                  <Route path="/home" element={<StorefrontGate><Index /></StorefrontGate>} />
                  <Route path="/welcome" element={<ProtectedRoute><WelcomeGate /></ProtectedRoute>} />
                  <Route path="/catalogue" element={<StorefrontGate><Catalogue /></StorefrontGate>} />
                  <Route path="/quick-order" element={<StorefrontGate><QuickOrder /></StorefrontGate>} />
                  <Route path="/product/:id" element={<StorefrontGate><ProductDetail /></StorefrontGate>} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/onboarding" element={<Onboarding />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/buyer-portal" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={ALL_BUYER_ROLES}><BuyerPortal /></RoleProtectedRoute></ProtectedRoute>} />
                  <Route path="/cart" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={ALL_BUYER_ROLES}><Cart /></RoleProtectedRoute></ProtectedRoute>} />
                  <Route path="/orders" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={ALL_BUYER_ROLES}><Orders /></RoleProtectedRoute></ProtectedRoute>} />
                  <Route path="/orders/:id" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={ALL_BUYER_ROLES}><OrderTracking /></RoleProtectedRoute></ProtectedRoute>} />
                  <Route path="/dashboard" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={ALL_BUYER_ROLES}><Dashboard /></RoleProtectedRoute></ProtectedRoute>} />
                  <Route path="/account" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={ALL_BUYER_ROLES}><Account /></RoleProtectedRoute></ProtectedRoute>} />
                  <Route path="/favorites" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={ALL_BUYER_ROLES}><Favorites /></RoleProtectedRoute></ProtectedRoute>} />
                  <Route path="/account/users" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={ALL_BUYER_ROLES}><ManageUsers /></RoleProtectedRoute></ProtectedRoute>} />
                  <Route path="/account/addresses" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={ALL_BUYER_ROLES}><ManageAddresses /></RoleProtectedRoute></ProtectedRoute>} />
                  <Route path="/account/logistics" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={ALL_BUYER_ROLES}><ManageLogistics /></RoleProtectedRoute></ProtectedRoute>} />
                  <Route path="/documents" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={ALL_BUYER_ROLES}><Documents /></RoleProtectedRoute></ProtectedRoute>} />
                  <Route path="/faq" element={<ProtectedRoute><FAQ /></ProtectedRoute>} />
                  <Route path="/terms" element={<PublicTerms />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/shipping" element={<Shipping />} />
                  <Route path="/approval-pending" element={<ProtectedRoute><ApprovalPending /></ProtectedRoute>} />
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
                    <Route index element={<AdminDashboard />} />
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
                    <Route path="users" element={<AdminUsers />} />
                    <Route path="moq" element={<AdminMOQ />} />
                    <Route path="currency" element={<AdminCurrency />} />
                    <Route path="support" element={<AdminSupport />} />
                    <Route path="operator-inbox" element={<OperatorInbox />} />
                    <Route path="whatsapp" element={<OperatorInbox />} />
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
                    <Route path="order-management" element={<OrderManagement />} />
                    <Route path="central-pool" element={<CentralOrderPool />} />
                    <Route path="cmd-war-room" element={<CMDWarRoom />} />
                    <Route path="inventory-command-center" element={<InventoryCommandCenter />} />
                    <Route path="carton-explorer" element={<CartonExplorer />} />
                    <Route path="reservation-board" element={<ReservationBoard />} />
                    <Route path="inventory-risk-board" element={<InventoryRiskBoard />} />
                    <Route path="scan-timeline" element={<ScanTimeline />} />
                    <Route path="assembly-tasks" element={<AssemblyManagement />} />
                    <Route path="assembly-tv" element={<AssemblyTV />} />
                    <Route path="ready-goods" element={<ReadyGoodsStore />} />
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
                    <Route
                      path="execution/production"
                      element={
                        <AdminModuleRoute moduleKey="production">
                          <ProductionExecutionBoard />
                        </AdminModuleRoute>
                      }
                    />
                    <Route
                      path="execution/assembly"
                      element={
                        <AdminModuleRoute moduleKey="production">
                          <AssemblyExecutionBoard />
                        </AdminModuleRoute>
                      }
                    />
                    <Route
                      path="execution/ready-goods"
                      element={
                        <AdminModuleRoute moduleKey="inventory">
                          <ReadyGoodsExecutionBoard />
                        </AdminModuleRoute>
                      }
                    />
                    <Route
                      path="execution/dispatch"
                      element={
                        <AdminModuleRoute moduleKey="dispatch">
                          <DispatchExecutionBoard />
                        </AdminModuleRoute>
                      }
                    />
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
                    <Route path="dispatch-mgmt" element={<DispatchManagement />} />
                    <Route path="dispatch-tv" element={<DispatchTV />} />
                    <Route path="target-vs-actual" element={<TargetVsActual />} />
                    <Route path="3pcs-store" element={<ThirdPartyStore />} />
                    <Route path="verification" element={<VerificationWarRoom />} />
                    <Route path="announcements" element={<AdminAnnouncements />} />
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
                  <Route path="/tv/chocolate" element={<RoleProtectedRoute allowedRoles={["HOD_CHOCOLATE", "PROD_CHOCOLATE", "SUPER_ADMIN", "ADMIN"]}><FactoryTVModule category="Chocolate" departmentFilter="Chocolates" title="Chocolate Line" /></RoleProtectedRoute>} />
                  <Route path="/tv/dragees" element={<RoleProtectedRoute allowedRoles={["HOD_DRAGEES", "PROD_DRAGEES", "SUPER_ADMIN", "ADMIN"]}><FactoryTVModule category="Dragees" departmentFilter="Dragees" title="Dragees Line" /></RoleProtectedRoute>} />
                  <Route path="/tv/fusion" element={<RoleProtectedRoute allowedRoles={["HOD_FUSION", "PROD_FUSION", "SUPER_ADMIN", "ADMIN"]}><FactoryTVModule category="Fusion Sweets" departmentFilter="Fusion Sweets" title="Fusion Sweets Line" /></RoleProtectedRoute>} />
                  <Route path="/tv/bakery" element={<RoleProtectedRoute allowedRoles={["HOD_BAKERY", "PROD_BAKERY", "SUPER_ADMIN", "ADMIN"]}><FactoryTVModule category="Bakery" departmentFilter="Bakery" title="Bakery Line" /></RoleProtectedRoute>} />
                  <Route path="/tv/nuts" element={<RoleProtectedRoute allowedRoles={["HOD_NUTS", "PROD_NUTS", "SUPER_ADMIN", "ADMIN"]}><FactoryTVModule category="Seasoned Nuts" departmentFilter="Nuts Roasting" title="Nuts & Dry Fruits Line" /></RoleProtectedRoute>} />
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
