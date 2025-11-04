import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { RoleGate } from "@/components/RoleGate";
import { InstallPromptToast } from "@/components/InstallPromptToast";
import React from "react";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ConsumerAuth from "./pages/auth/ConsumerAuth";
import DriverAuth from "./pages/auth/DriverAuth";
import FarmerAuth from "./pages/auth/FarmerAuth";
import AdminAuth from "./pages/auth/AdminAuth";
import AcceptInvitation from "./pages/admin/AcceptInvitation";
import Shop from "./pages/consumer/Shop";
import Checkout from "./pages/consumer/Checkout";
import DriverDashboard from "./pages/driver/Dashboard";
import AvailableRoutes from "./pages/driver/AvailableRoutes";
import RouteDetails from "./pages/driver/RouteDetails";
import LoadBoxes from "./pages/driver/LoadBoxes";
import DriverPayouts from "./pages/driver/PayoutDetails";
import DriverTaxInfo from "./pages/driver/TaxInfo";
import FarmerDashboard from '@/pages/farmer/Dashboard';
import InventoryManagement from '@/pages/farmer/InventoryManagement';
import Financials from '@/pages/farmer/Financials';
import MyLeadFarmer from '@/pages/farmer/MyLeadFarmer';
import AffiliatedFarmers from '@/pages/farmer/AffiliatedFarmers';
import CustomerAnalytics from '@/pages/farmer/CustomerAnalytics';
import AdminDashboard from "./pages/admin/Dashboard";
import AnalyticsAndFinancials from "./pages/admin/AnalyticsAndFinancials";
import AdminRoles from "./pages/admin/AdminRoles";
import CreditsManager from "./pages/admin/CreditsManager";
import AuditLog from "./pages/admin/AuditLog";
import MarketConfig from "./pages/admin/MarketConfig";
import ProductApproval from "./pages/admin/ProductApproval";
import FarmAffiliations from "./pages/admin/FarmAffiliations";
import TaxDocuments from "./pages/admin/TaxDocuments";
import ConsumerOrderTracking from "./pages/consumer/OrderTracking";
import LiveTracking from "./pages/consumer/LiveTracking";
import OrderSuccess from "./pages/consumer/OrderSuccess";
import ConsumerProfile from "./pages/profile/ConsumerProfile";
import FarmerProfile from "./pages/profile/FarmerProfile";
import DriverProfile from "./pages/profile/DriverProfile";
import FarmProfileView from "./pages/FarmProfileView";
import PrivacyPolicy from "./pages/legal/PrivacyPolicy";
import TermsOfService from "./pages/legal/TermsOfService";
import UserApprovals from "./pages/admin/UserApprovals";
import UserSearch from "./pages/admin/UserSearch";
import Disputes from "./pages/admin/Disputes";
import BatchAdjustments from "./pages/admin/BatchAdjustments";
import Install from "./pages/Install";
import { CookieConsent } from "./components/CookieConsent";
import { BottomNav } from "./components/mobile/BottomNav";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 minutes
      gcTime: 5 * 60 * 1000, // 5 minutes (previously cacheTime)
      refetchOnWindowFocus: false, // Disable aggressive refetching
    },
  },
});

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

const AppContent = () => {
  const location = useLocation();
  const isConsumerRoute = location.pathname.startsWith('/consumer/');

  return (
    <>
      <CookieConsent />
      <InstallPromptToast />
      <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth/consumer" element={<ConsumerAuth />} />
          <Route path="/auth/driver" element={<DriverAuth />} />
          <Route path="/auth/farmer" element={<FarmerAuth />} />
          <Route path="/auth/admin" element={<AdminAuth />} />
          
          <Route path="/consumer/shop" element={
            <RoleGate roles={['consumer']}>
              <Shop />
            </RoleGate>
          } />
          <Route path="/consumer/checkout" element={
            <RoleGate roles={['consumer']}>
              <Checkout />
            </RoleGate>
          } />
          <Route path="/consumer/orders" element={
            <RoleGate roles={['consumer']}>
              <ConsumerOrderTracking />
            </RoleGate>
          } />
          <Route path="/consumer/live-tracking" element={
            <RoleGate roles={['consumer']}>
              <LiveTracking />
            </RoleGate>
          } />
          <Route path="/demo/live-orders" element={
            <RoleGate roles={['consumer']}>
              <LiveTracking />
            </RoleGate>
          } />
          <Route path="/consumer/order-success/:orderId" element={
            <RoleGate roles={['consumer']}>
              <OrderSuccess />
            </RoleGate>
          } />
          <Route path="/consumer/profile" element={
            <RoleGate roles={['consumer']}>
              <ConsumerProfile />
            </RoleGate>
          } />
          
          <Route path="/driver/dashboard" element={
            <RoleGate roles={['driver']}>
              <DriverDashboard />
            </RoleGate>
          } />
          <Route path="/driver/available-routes" element={
            <RoleGate roles={['driver']}>
              <AvailableRoutes />
            </RoleGate>
          } />
          <Route path="/driver/load/:batchId" element={
            <RoleGate roles={['driver']}>
              <LoadBoxes />
            </RoleGate>
          } />
          <Route path="/driver/active-route" element={
            <RoleGate roles={['driver']}>
              <RouteDetails />
            </RoleGate>
          } />
          <Route path="/driver/profile" element={
            <RoleGate roles={['driver']}>
              <DriverProfile />
            </RoleGate>
          } />
          <Route path="/driver/payouts" element={
            <RoleGate roles={['driver']}>
              <DriverPayouts />
            </RoleGate>
          } />
          <Route path="/driver/tax-info" element={
            <RoleGate roles={['driver']}>
              <DriverTaxInfo />
            </RoleGate>
          } />
          
          <Route path="/farmer/dashboard" element={
            <RoleGate roles={['farmer', 'lead_farmer']}>
              <FarmerDashboard />
            </RoleGate>
          } />
          <Route path="/farmer/inventory" element={
            <RoleGate roles={['farmer', 'lead_farmer']}>
              <InventoryManagement />
            </RoleGate>
          } />
          <Route path="/farmer/financials" element={
            <RoleGate roles={['farmer', 'lead_farmer']}>
              <Financials />
            </RoleGate>
          } />
          <Route path="/farmer/my-lead-farmer" element={
            <RoleGate roles={['farmer']}>
              <MyLeadFarmer />
            </RoleGate>
          } />
          <Route path="/farmer/customer-analytics" element={
            <RoleGate roles={['farmer', 'lead_farmer']}>
              <CustomerAnalytics />
            </RoleGate>
          } />
          <Route path="/farmer/affiliated-farmers" element={
            <RoleGate roles={['lead_farmer']}>
              <AffiliatedFarmers />
            </RoleGate>
          } />
          <Route path="/farmer/profile" element={
            <RoleGate roles={['farmer', 'lead_farmer']}>
              <FarmerProfile />
            </RoleGate>
          } />
          
          <Route path="/admin/dashboard" element={
            <RoleGate roles={['admin']}>
              <AdminDashboard />
            </RoleGate>
          } />
          <Route path="/admin/analytics-financials" element={
            <RoleGate roles={['admin']}>
              <AnalyticsAndFinancials />
            </RoleGate>
          } />
          <Route path="/admin/roles" element={
            <RoleGate roles={['admin']}>
              <AdminRoles />
            </RoleGate>
          } />
          <Route path="/admin/credits" element={
            <RoleGate roles={['admin']}>
              <CreditsManager />
            </RoleGate>
          } />
          <Route path="/admin/audit-log" element={
            <RoleGate roles={['admin']}>
              <AuditLog />
            </RoleGate>
          } />
          <Route path="/admin/market-config" element={
            <RoleGate roles={['admin']}>
              <MarketConfig />
            </RoleGate>
          } />
          <Route path="/admin/products" element={
            <RoleGate roles={['admin']}>
              <ProductApproval />
            </RoleGate>
          } />
          <Route path="/admin/approvals" element={
            <RoleGate roles={['admin']}>
              <UserApprovals />
            </RoleGate>
          } />
          <Route path="/admin/user-search" element={
            <RoleGate roles={['admin']}>
              <UserSearch />
            </RoleGate>
          } />
          <Route path="/admin/disputes" element={
            <RoleGate roles={['admin']}>
              <Disputes />
            </RoleGate>
          } />
          <Route path="/admin/batches" element={
            <RoleGate roles={['admin']}>
              <BatchAdjustments />
            </RoleGate>
          } />
          <Route path="/admin/farm-affiliations" element={
            <RoleGate roles={['admin']}>
              <FarmAffiliations />
            </RoleGate>
          } />
          <Route path="/admin/tax-documents" element={
            <RoleGate roles={['admin']}>
              <TaxDocuments />
            </RoleGate>
          } />
          
          <Route path="/admin/accept-invitation" element={<AcceptInvitation />} />
          
          <Route path="/farm/:farmId" element={<FarmProfileView />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/install" element={<Install />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
          </Routes>
          {isConsumerRoute && <BottomNav />}
        </>
      );
    };

    export default App;
