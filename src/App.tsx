import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { LanguageProvider } from "./contexts/LanguageContext.tsx";
import { CurrencyProvider } from "./contexts/CurrencyContext.tsx";

import { Navigate } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import Splash from "./pages/Splash.tsx";
import CompanyIntro from "./pages/CompanyIntro.tsx";
import Catalogue from "./pages/Catalogue.tsx";
import Orders from "./pages/Orders.tsx";
import Cart from "./pages/Cart.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import ProductDetail from "./pages/ProductDetail.tsx";
import Account from "./pages/Account.tsx";
import Favorites from "./pages/Favorites.tsx";
import Documents from "./pages/Documents.tsx";
import Login from "./pages/Login.tsx";
import Register from "./pages/Register.tsx";
import NotFound from "./pages/NotFound.tsx";
import Onboarding from "./pages/Onboarding.tsx";
import BuyerPortal from "./pages/BuyerPortal.tsx";
import Index from "./pages/Index.tsx";
import ApprovalPending from "./pages/ApprovalPending.tsx";
import WelcomeGate from "./pages/WelcomeGate.tsx";
import OrderTracking from "./pages/OrderTracking.tsx";
import PublicOrderTracking from "./pages/PublicOrderTracking.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import AdminLayout from "./components/AdminLayout.tsx";
import AdminDashboard from "./pages/admin/AdminDashboard.tsx";
import AdminClients from "./pages/admin/AdminClients.tsx";
import AdminProducts from "./pages/admin/AdminProducts.tsx";
import AdminPricing from "./pages/admin/AdminPricing.tsx";
import AdminOrders from "./pages/admin/AdminOrders.tsx";
import AdminProduction from "./pages/admin/AdminProduction.tsx";
import AdminOperations from "./pages/admin/AdminOperations.tsx";
import AdminPackingDispatch from "./pages/admin/AdminPackingDispatch.tsx";
import AdminAccountsRelease from "./pages/admin/AdminAccountsRelease.tsx";
import AdminExceptions from "./pages/admin/AdminExceptions.tsx";
import AdminFinance from "./pages/admin/AdminFinance.tsx";
import AdminUsers from "./pages/admin/AdminUsers.tsx";
import AdminMOQ from "./pages/admin/AdminMOQ.tsx";
import AdminCurrency from "./pages/admin/AdminCurrency.tsx";
import AdminSupport from "./pages/admin/AdminSupport.tsx";
import AdminSettings from "./pages/admin/AdminSettings.tsx";
import AdminAudit from "./pages/admin/AdminAudit.tsx";
import AdminDepartment from "./pages/admin/AdminDepartment.tsx";
import OperationsController from "./pages/admin/OperationsController.tsx";
import AdminSecurityGate from "./pages/admin/AdminSecurityGate.tsx";
import AdminInventory from "./pages/admin/AdminInventory.tsx";
import AdminLogistics from "./pages/admin/AdminLogistics.tsx";
import ManageUsers from "./pages/ManageUsers.tsx";
import ManageAddresses from "./pages/ManageAddresses.tsx";
import ManageLogistics from "./pages/ManageLogistics.tsx";
import SalesDashboard from "./pages/sales/SalesDashboard.tsx";
import SalesPerformanceHub from "./pages/admin/SalesPerformanceHub.tsx";
import AdminNotifications from "./pages/admin/AdminNotifications.tsx";
import CMDHeartbeat from "./pages/admin/CMDHeartbeat.tsx";
import CMDWarRoom from "./pages/admin/CMDWarRoom.tsx";
import AdminMerchandising from "./pages/admin/AdminMerchandising.tsx";
import OrderManagement from "./pages/admin/OrderManagement.tsx";
import FactoryTVModule from "./components/FactoryTVModule.tsx";
import AssemblyManagement from "./pages/admin/AssemblyManagement.tsx";
import AssemblyTV from "./pages/admin/AssemblyTV.tsx";
import ReadyGoodsStore from "./pages/admin/ReadyGoodsStore.tsx";
import ReadyGoodsTV from "./pages/admin/ReadyGoodsTV.tsx";
import DispatchManagement from "./pages/admin/DispatchManagement.tsx";
import DispatchTV from "./pages/admin/DispatchTV.tsx";
import TargetVsActual from "./pages/admin/TargetVsActual.tsx";
import ThirdPartyStore from "./pages/admin/ThirdPartyStore.tsx";
import VerificationWarRoom from "./pages/admin/VerificationWarRoom.tsx";
import AdminAnnouncements from "./pages/admin/AdminAnnouncements.tsx";
import RoleProtectedRoute from "@/components/RoleProtectedRoute";
import PremiumAnnouncementOverlay from "@/components/PremiumAnnouncementOverlay";
import { useAuth } from "@/hooks/useAuth";
import { getRoleDestination, isStaffRole, isStorefrontRole, normalizeRole } from "@/lib/auth-routing";

// Roles allowed to access the full admin panel
const ADMIN_ONLY_ROLES = ["SUPER_ADMIN", "ADMIN"];

// Internal staff who can access specific admin sub-routes but NOT the dashboard stats
const ADMIN_STAFF_ROLES = [
  ...ADMIN_ONLY_ROLES,
  "FINANCE_HEAD", "FINANCE_EXEC",
  "OPERATIONS_MANAGER", "PRODUCTION_MANAGER",
  "HOD_ARABIC", "HOD_FUSION", "HOD_CHOCOLATE", "HOD_BAKERY", "HOD_NUTS", "HOD_ASSEMBLY", "HOD_DRAGEES",
  "STORE_INCHARGE", "DISPATCH_MANAGER", "DISPATCH_INCHARGE", "SECURITY_CONTROL",
  "SUPPORT_EXECUTIVE", "SALES_EXECUTIVE",
  // Legacy compat
  "DISPATCH_HEAD", "ASSEMBLY_MANAGER", "PACKING_SUPERVISOR",
  "STORE_READY_GOODS", "STORE_3RD_PARTY", "GATE_SECURITY", "RGS_ADMIN",
  "PROD_ARABIC_SWEETS", "PROD_CHOCOLATE", "PROD_DRAGEES", "PROD_FUSION", "PROD_BAKERY", "PROD_NUTS",
];

const ALL_BUYER_ROLES = [
  'B2B_BUYER', 'SPECIAL_BUYER', 'HORECA_BUYER', 'WHOLESALE_BUYER', 'BULK_BUYER',
  // Legacy compat
  'BUYER', 'CUSTOMER_USER', 'CLIENT',
];

const queryClient = new QueryClient();

const AuthSpinner = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const RootGate = () => {
  const { user, loading: authLoading, role, companyId, profileReady } = useAuth();
  const normalizedRole = normalizeRole(role);

  if (authLoading || !profileReady) {
    return <AuthSpinner />;
  }

  if (!user) return <Navigate to="/splash" replace />;

  if (!normalizedRole) {
    return <Navigate to="/approval-pending" replace />;
  }

  if (isStorefrontRole(normalizedRole) && !companyId) {
    return <Navigate to="/approval-pending" replace />;
  }

  return <Navigate to={getRoleDestination(normalizedRole)} replace />;
};

const StorefrontGate = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading, role, companyId, profileReady } = useAuth();
  const normalizedRole = normalizeRole(role);

  if (authLoading) {
    return <AuthSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (normalizedRole && isStaffRole(normalizedRole)) {
    return <Navigate to={getRoleDestination(normalizedRole)} replace />;
  }

  if (!normalizedRole || !profileReady) {
    return <AuthSpinner />;
  }

  if (!isStorefrontRole(role)) {
    return <Navigate to={getRoleDestination(role)} replace />;
  }

  // Client role but missing company_id → redirect to approval
  if (!companyId) {
    return <Navigate to="/approval-pending" replace />;
  }

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <LanguageProvider>
        <CurrencyProvider>
          <PremiumAnnouncementOverlay />
          <Routes>
            <Route path="/splash" element={<Splash />} />
            <Route path="/intro" element={<CompanyIntro />} />
            <Route path="/track" element={<PublicOrderTracking />} />
            <Route path="/operations-controller" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={[...ADMIN_STAFF_ROLES]}><OperationsController /></RoleProtectedRoute></ProtectedRoute>} />
            <Route path="/security-gate" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={['GATE_SECURITY', 'SUPER_ADMIN', 'ADMIN']}><AdminSecurityGate /></RoleProtectedRoute></ProtectedRoute>} />
            <Route path="/" element={<RootGate />} />
            <Route path="/home" element={<StorefrontGate><Index /></StorefrontGate>} />
            <Route path="/welcome" element={<ProtectedRoute><WelcomeGate /></ProtectedRoute>} />
            <Route path="/catalogue" element={<StorefrontGate><Catalogue /></StorefrontGate>} />
            <Route path="/product/:id" element={<StorefrontGate><ProductDetail /></StorefrontGate>} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/onboarding" element={<Onboarding />} />
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
              <Route path="users" element={<AdminUsers />} />
              <Route path="moq" element={<AdminMOQ />} />
              <Route path="currency" element={<AdminCurrency />} />
              <Route path="support" element={<AdminSupport />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="audit" element={<AdminAudit />} />
              <Route path="department" element={<AdminDepartment />} />
              <Route path="inventory" element={<AdminInventory />} />
              <Route path="logistics" element={<AdminLogistics />} />
              <Route path="sales-hub" element={<SalesPerformanceHub />} />
              <Route path="notifications" element={<AdminNotifications />} />
              <Route path="heartbeat" element={<CMDHeartbeat />} />
              <Route path="merchandising" element={<AdminMerchandising />} />
              <Route path="order-management" element={<OrderManagement />} />
              <Route path="cmd-war-room" element={<CMDWarRoom />} />
              <Route path="assembly-tasks" element={<AssemblyManagement />} />
              <Route path="assembly-tv" element={<AssemblyTV />} />
              <Route path="ready-goods" element={<ReadyGoodsStore />} />
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
                  <RoleProtectedRoute allowedRoles={['SALES_EXECUTIVE', 'SUPER_ADMIN', 'ADMIN']}>
                    <SalesDashboard />
                  </RoleProtectedRoute>
                </ProtectedRoute>
              }
            />

            {/* Factory TV Routes — guarded for PROD_* roles + admins */}
            <Route path="/tv/arabic-sweets" element={<RoleProtectedRoute allowedRoles={['HOD_ARABIC', 'PROD_ARABIC_SWEETS', 'SUPER_ADMIN', 'ADMIN']}><FactoryTVModule category="Arabic Sweets" departmentFilter="Arabic Sweets" title="Arabic Sweets Line" /></RoleProtectedRoute>} />
            <Route path="/tv/chocolate" element={<RoleProtectedRoute allowedRoles={['HOD_CHOCOLATE', 'PROD_CHOCOLATE', 'SUPER_ADMIN', 'ADMIN']}><FactoryTVModule category="Chocolate" departmentFilter="Chocolates" title="Chocolate Line" /></RoleProtectedRoute>} />
            <Route path="/tv/dragees" element={<RoleProtectedRoute allowedRoles={['HOD_DRAGEES', 'PROD_DRAGEES', 'SUPER_ADMIN', 'ADMIN']}><FactoryTVModule category="Dragees" departmentFilter="Dragees" title="Dragees Line" /></RoleProtectedRoute>} />
            <Route path="/tv/fusion" element={<RoleProtectedRoute allowedRoles={['HOD_FUSION', 'PROD_FUSION', 'SUPER_ADMIN', 'ADMIN']}><FactoryTVModule category="Fusion Sweets" departmentFilter="Fusion Sweets" title="Fusion Sweets Line" /></RoleProtectedRoute>} />
            <Route path="/tv/bakery" element={<RoleProtectedRoute allowedRoles={['HOD_BAKERY', 'PROD_BAKERY', 'SUPER_ADMIN', 'ADMIN']}><FactoryTVModule category="Bakery" departmentFilter="Bakery" title="Bakery Line" /></RoleProtectedRoute>} />
            <Route path="/tv/nuts" element={<RoleProtectedRoute allowedRoles={['HOD_NUTS', 'PROD_NUTS', 'SUPER_ADMIN', 'ADMIN']}><FactoryTVModule category="Seasoned Nuts" departmentFilter="Nuts Roasting" title="Nuts & Dry Fruits Line" /></RoleProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        
        </CurrencyProvider>
        </LanguageProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
