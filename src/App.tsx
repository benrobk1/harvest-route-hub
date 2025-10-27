import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { RoleGate } from "@/components/RoleGate";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ConsumerAuth from "./pages/auth/ConsumerAuth";
import DriverAuth from "./pages/auth/DriverAuth";
import FarmerAuth from "./pages/auth/FarmerAuth";
import AdminAuth from "./pages/auth/AdminAuth";
import Shop from "./pages/consumer/Shop";
import Checkout from "./pages/consumer/Checkout";
import DriverDashboard from "./pages/driver/Dashboard";
import RouteDetails from "./pages/driver/RouteDetails";
import FarmerDashboard from "./pages/farmer/Dashboard";
import AdminDashboard from "./pages/admin/Dashboard";
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
import { CookieConsent } from "./components/CookieConsent";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CookieConsent />
          <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/consumer/auth" element={<ConsumerAuth />} />
          <Route path="/driver/auth" element={<DriverAuth />} />
          <Route path="/farmer/auth" element={<FarmerAuth />} />
          <Route path="/admin/auth" element={<AdminAuth />} />
          
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
          <Route path="/driver/route" element={
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
          
          <Route path="/farm/:farmId" element={<FarmProfileView />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
