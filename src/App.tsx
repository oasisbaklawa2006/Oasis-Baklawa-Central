import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "./contexts/CartContext.tsx";

import ProtectedRoute from "@/components/ProtectedRoute";
import Splash from "./pages/Splash.tsx";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <CartProvider>
          <Routes>
            <Route path="/splash" element={<Splash />} />
            <Route path="/" element={<Index />} />
            <Route path="/catalogue" element={<Catalogue />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route
              path="/buyer-portal"
              element={
                <ProtectedRoute>
                  <BuyerPortal />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cart"
              element={
                <ProtectedRoute>
                  <Cart />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders"
              element={
                <ProtectedRoute>
                  <Orders />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/account"
              element={
                <ProtectedRoute>
                  <Account />
                </ProtectedRoute>
              }
            />
            <Route
              path="/favorites"
              element={
                <ProtectedRoute>
                  <Favorites />
                </ProtectedRoute>
              }
            />
            <Route
              path="/documents"
              element={
                <ProtectedRoute>
                  <Documents />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminLayout />
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
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </CartProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
