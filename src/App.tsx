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
import ApprovalPending from "./pages/ApprovalPending.tsx";
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
import AdminMerchandising from "./pages/admin/AdminMerchandising.tsx";
import FactoryTVModule from "./components/FactoryTVModule.tsx";
import RoleProtectedRoute from "./components/RoleProtectedRoute.tsx";
import { useAuth } from "@/hooks/useAuth";

const PROD_ROLE_ROUTES: Record<string, string> = {
  PROD_ARABIC_SWEETS: "/tv/arabic-sweets",
  PROD_CHOCOLATE: "/tv/chocolate",
  PROD_FUSION: "/tv/fusion",
  PROD_BAKERY: "/tv/bakery",
  PROD_NUTS: "/tv/nuts",
};

// Roles allowed to access the full admin panel
const ADMIN_ONLY_ROLES = ["SUPER_ADMIN", "ADMIN"];

// Internal staff who can access specific admin sub-routes but NOT the dashboard stats
const ADMIN_STAFF_ROLES = [
  ...ADMIN_ONLY_ROLES, "FINANCE_HEAD", "DISPATCH_HEAD", "PRODUCTION_MANAGER",
  "ASSEMBLY_MANAGER", "PACKING_SUPERVISOR", "SUPPORT_EXECUTIVE",
  "STORE_READY_GOODS", "STORE_3RD_PARTY", "GATE_SECURITY",
];

const queryClient = new QueryClient();

const RootGate = () => {
  const { user, loading: authLoading, role, profileReady } = useAuth();

  if (authLoading || (user && !profileReady)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/splash" replace />;

  const normalizedRole = role?.toUpperCase() || null;

  // 1. ADMIN BYPASS — always lands on /admin
  if (normalizedRole === "ADMIN" || normalizedRole === "SUPER_ADMIN") {
    return <Navigate to="/admin" replace />;
  }

  if (normalizedRole && PROD_ROLE_ROUTES[normalizedRole]) {
    return <Navigate to={PROD_ROLE_ROUTES[normalizedRole]} replace />;
  }

  if (normalizedRole === "SALES_EXECUTIVE") {
    return <Navigate to="/sales/dashboard" replace />;
  }

  if (normalizedRole === "CUSTOMER_USER" || normalizedRole === "CLIENT" || normalizedRole === "BUYER") {
    return <Navigate to="/home" replace />;
  }

  if (normalizedRole === null) {
    return <Navigate to="/approval-pending" replace />;
  }

  return <Navigate to="/approval-pending" replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <LanguageProvider>
        <CurrencyProvider>
        
          <Routes>
            <Route path="/splash" element={<Splash />} />
            <Route path="/intro" element={<CompanyIntro />} />
            <Route path="/operations-controller" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={[...ADMIN_STAFF_ROLES]}><OperationsController /></RoleProtectedRoute></ProtectedRoute>} />
            <Route path="/security-gate" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={['GATE_SECURITY', 'SUPER_ADMIN', 'ADMIN']}><AdminSecurityGate /></RoleProtectedRoute></ProtectedRoute>} />
            <Route path="/" element={<RootGate />} />
            <Route path="/catalogue" element={<RoleProtectedRoute allowedRoles={['BUYER', 'CUSTOMER_USER', 'CLIENT', 'SUPER_ADMIN', 'ADMIN']}><Catalogue /></RoleProtectedRoute>} />
            <Route path="/product/:id" element={<RoleProtectedRoute allowedRoles={['BUYER', 'CUSTOMER_USER', 'CLIENT', 'SUPER_ADMIN', 'ADMIN']}><ProductDetail /></RoleProtectedRoute>} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/buyer-portal" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={['BUYER', 'CUSTOMER_USER', 'CLIENT']}><BuyerPortal /></RoleProtectedRoute></ProtectedRoute>} />
            <Route path="/cart" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={['BUYER', 'CUSTOMER_USER', 'CLIENT']}><Cart /></RoleProtectedRoute></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={['BUYER', 'CUSTOMER_USER', 'CLIENT']}><Orders /></RoleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={['BUYER', 'CUSTOMER_USER', 'CLIENT']}><Dashboard /></RoleProtectedRoute></ProtectedRoute>} />
            <Route path="/account" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={['BUYER', 'CUSTOMER_USER', 'CLIENT']}><Account /></RoleProtectedRoute></ProtectedRoute>} />
            <Route path="/favorites" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={['BUYER', 'CUSTOMER_USER', 'CLIENT']}><Favorites /></RoleProtectedRoute></ProtectedRoute>} />
            <Route path="/account/users" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={['BUYER', 'CUSTOMER_USER', 'CLIENT']}><ManageUsers /></RoleProtectedRoute></ProtectedRoute>} />
            <Route path="/account/addresses" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={['BUYER', 'CUSTOMER_USER', 'CLIENT']}><ManageAddresses /></RoleProtectedRoute></ProtectedRoute>} />
            <Route path="/account/logistics" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={['BUYER', 'CUSTOMER_USER', 'CLIENT']}><ManageLogistics /></RoleProtectedRoute></ProtectedRoute>} />
            <Route path="/documents" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={['BUYER', 'CUSTOMER_USER', 'CLIENT']}><Documents /></RoleProtectedRoute></ProtectedRoute>} />
            <Route path="/approval-pending" element={<ProtectedRoute><ApprovalPending /></ProtectedRoute>} />

            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <RoleProtectedRoute allowedRoles={[...ADMIN_ONLY_ROLES]}>
                    <AdminLayout />
                  </RoleProtectedRoute>
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="clients" element={<AdminClients />} />
              <Route path="approvals" element={<AdminClients />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="pricing" element={<AdminPricing />} />
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
            <Route path="/tv/arabic-sweets" element={<RoleProtectedRoute allowedRoles={['PROD_ARABIC_SWEETS', 'SUPER_ADMIN', 'ADMIN']}><FactoryTVModule category="Arabic Sweets" departmentFilter="Arabic Sweets" title="Arabic Sweets Line" /></RoleProtectedRoute>} />
            <Route path="/tv/chocolate" element={<RoleProtectedRoute allowedRoles={['PROD_CHOCOLATE', 'SUPER_ADMIN', 'ADMIN']}><FactoryTVModule category="Chocolate" departmentFilter="Confectionery & Chocolates" title="Chocolate Line" /></RoleProtectedRoute>} />
            <Route path="/tv/fusion" element={<RoleProtectedRoute allowedRoles={['PROD_FUSION', 'SUPER_ADMIN', 'ADMIN']}><FactoryTVModule category="Fusion Sweets" departmentFilter="Fusion Sweets" title="Fusion Sweets Line" /></RoleProtectedRoute>} />
            <Route path="/tv/bakery" element={<RoleProtectedRoute allowedRoles={['PROD_BAKERY', 'SUPER_ADMIN', 'ADMIN']}><FactoryTVModule category="Bakery" departmentFilter="Bakery" title="Bakery Line" /></RoleProtectedRoute>} />
            <Route path="/tv/nuts" element={<RoleProtectedRoute allowedRoles={['PROD_NUTS', 'SUPER_ADMIN', 'ADMIN']}><FactoryTVModule category="Seasoned Nuts" departmentFilter="Nuts Roasting" title="Nuts & Dry Fruits Line" /></RoleProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        
        </CurrencyProvider>
        </LanguageProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
