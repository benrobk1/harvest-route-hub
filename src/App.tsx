import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { RoleGate } from "@/components/RoleGate";
import { InstallPromptToast } from "@/components/InstallPromptToast";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ConsumerAuth from "./pages/auth/ConsumerAuth";
import DriverAuth from "./pages/auth/DriverAuth";
import FarmerAuth from "./pages/auth/FarmerAuth";
import AdminAuth from "./pages/auth/AdminAuth";
import Shop from "./pages/consumer/Shop";
import Checkout from "./pages/consumer/Checkout";
import DriverDashboard from "./pages/driver/Dashboard";
import AvailableRoutes from "./pages/driver/AvailableRoutes";
import RouteDetails from "./pages/driver/RouteDetails";
import LoadBoxes from "./pages/driver/LoadBoxes";
import FarmerDashboard from "./pages/farmer/Dashboard";
import AdminDashboard from "./pages/admin/Dashboard";
import Analytics from "./pages/admin/Analytics";
import AuditLog from "./pages/admin/AuditLog";
import MarketConfig from "./pages/admin/MarketConfig";
import ProductApproval from "./pages/admin/ProductApproval";
import ConsumerOrderTracking from "./pages/consumer/OrderTracking";
import ConsumerProfile from "./pages/profile/ConsumerProfile";
import FarmerProfile from "./pages/profile/FarmerProfile";
import DriverProfile from "./pages/profile/DriverProfile";
import FarmProfileView from "./pages/FarmProfileView";
import PrivacyPolicy from "./pages/legal/PrivacyPolicy";
import TermsOfService from "./pages/legal/TermsOfService";
import UserApprovals from "./pages/admin/UserApprovals";
import Disputes from "./pages/admin/Disputes";
import BatchAdjustments from "./pages/admin/BatchAdjustments";
import FinancialReports from "./pages/admin/FinancialReports";
import Install from "./pages/Install";
import { CookieConsent } from "./components/CookieConsent";
import { BottomNav } from "./components/mobile/BottomNav";

const queryClient = new QueryClient();

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
          
          <Route path="/farmer/dashboard" element={
            <RoleGate roles={['farmer', 'lead_farmer']}>
              <FarmerDashboard />
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
          <Route path="/admin/analytics" element={
            <RoleGate roles={['admin']}>
              <Analytics />
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
          <Route path="/admin/financials" element={
            <RoleGate roles={['admin']}>
              <FinancialReports />
            </RoleGate>
          } />
          
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
