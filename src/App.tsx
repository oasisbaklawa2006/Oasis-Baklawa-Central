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
import Index from "./pages/Index.tsx";
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
import ApprovalPending from "./pages/ApprovalPending.tsx";
import FactoryTVModule from "./components/FactoryTVModule.tsx";
import RoleProtectedRoute from "./components/RoleProtectedRoute.tsx";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

const PROD_ROLE_ROUTES: Record<string, string> = {
  PROD_ARABIC_SWEETS: "/tv/arabic-sweets",
  PROD_CHOCOLATE: "/tv/chocolate",
  PROD_FUSION: "/tv/fusion",
  PROD_BAKERY: "/tv/bakery",
  PROD_NUTS: "/tv/nuts",
};

const ADMIN_ROLES = [
  "SUPER_ADMIN", "ADMIN", "FINANCE_HEAD", "DISPATCH_HEAD", "PRODUCTION_MANAGER",
  "ASSEMBLY_MANAGER", "PACKING_SUPERVISOR", "SUPPORT_EXECUTIVE",
  "STORE_READY_GOODS", "STORE_3RD_PARTY", "GATE_SECURITY",
];

const queryClient = new QueryClient();

const RootGate = () => {
  const { user, loading: authLoading } = useAuth();
  const [roleLoading, setRoleLoading] = useState(true);
  const [redirect, setRedirect] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setRedirect("/splash");
      setRoleLoading(false);
      return;
    }
    const fetchRole = async () => {
      const { data } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      const role = data?.role?.toUpperCase();

      // 1. Factory TV group — most specific, check first
      if (role && PROD_ROLE_ROUTES[role]) {
        setRedirect(PROD_ROLE_ROUTES[role]);
      }
      // 2. Sales group
      else if (role === "SALES_EXECUTIVE") {
        setRedirect("/sales/dashboard");
      }
      // 3. Admin / operations / finance / gate group
      else if (role && ADMIN_ROLES.includes(role)) {
        setRedirect("/admin");
      }
      // 4. Client group (buyer, client, null, or any unrecognized role)
      else {
        setRedirect(null);
      }
      setRoleLoading(false);
    };
    fetchRole();
  }, [user, authLoading]);

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (redirect) return <Navigate to={redirect} replace />;
  return <Index />;
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
            <Route path="/operations-controller" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={[...ADMIN_ROLES]}><OperationsController /></RoleProtectedRoute></ProtectedRoute>} />
            <Route path="/security-gate" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={['GATE_SECURITY', 'SUPER_ADMIN', 'ADMIN']}><AdminSecurityGate /></RoleProtectedRoute></ProtectedRoute>} />
            <Route path="/" element={<RootGate />} />
            <Route path="/catalogue" element={<RoleProtectedRoute allowedRoles={['BUYER', 'CUSTOMER_USER', 'CLIENT', 'SUPER_ADMIN', null]}><Catalogue /></RoleProtectedRoute>} />
            <Route path="/product/:id" element={<RoleProtectedRoute allowedRoles={['BUYER', 'CUSTOMER_USER', 'CLIENT', 'SUPER_ADMIN', null]}><ProductDetail /></RoleProtectedRoute>} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/buyer-portal" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={['BUYER', 'CUSTOMER_USER', 'CLIENT', null]}><BuyerPortal /></RoleProtectedRoute></ProtectedRoute>} />
            <Route path="/cart" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={['BUYER', 'CUSTOMER_USER', 'CLIENT', null]}><Cart /></RoleProtectedRoute></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={['BUYER', 'CUSTOMER_USER', 'CLIENT', null]}><Orders /></RoleProtectedRoute></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={['BUYER', 'CUSTOMER_USER', 'CLIENT', null]}><Dashboard /></RoleProtectedRoute></ProtectedRoute>} />
            <Route path="/account" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={['BUYER', 'CUSTOMER_USER', 'CLIENT', null]}><Account /></RoleProtectedRoute></ProtectedRoute>} />
            <Route path="/favorites" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={['BUYER', 'CUSTOMER_USER', 'CLIENT', null]}><Favorites /></RoleProtectedRoute></ProtectedRoute>} />
            <Route path="/account/users" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={['BUYER', 'CUSTOMER_USER', 'CLIENT', null]}><ManageUsers /></RoleProtectedRoute></ProtectedRoute>} />
            <Route path="/account/addresses" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={['BUYER', 'CUSTOMER_USER', 'CLIENT', null]}><ManageAddresses /></RoleProtectedRoute></ProtectedRoute>} />
            <Route path="/account/logistics" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={['BUYER', 'CUSTOMER_USER', 'CLIENT', null]}><ManageLogistics /></RoleProtectedRoute></ProtectedRoute>} />
            <Route path="/documents" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={['BUYER', 'CUSTOMER_USER', 'CLIENT', null]}><Documents /></RoleProtectedRoute></ProtectedRoute>} />

            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <RoleProtectedRoute allowedRoles={[...ADMIN_ROLES]}>
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
