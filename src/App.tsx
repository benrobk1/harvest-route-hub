import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ConsumerAuth from "./pages/auth/ConsumerAuth";
import DriverAuth from "./pages/auth/DriverAuth";
import FarmerAuth from "./pages/auth/FarmerAuth";
import AdminAuth from "./pages/auth/AdminAuth";
import Shop from "./pages/consumer/Shop";
import DriverDashboard from "./pages/driver/Dashboard";
import FarmerDashboard from "./pages/farmer/Dashboard";
import AdminDashboard from "./pages/admin/Dashboard";
import ConsumerOrderTracking from "./pages/consumer/OrderTracking";
import ConsumerProfile from "./pages/profile/ConsumerProfile";
import FarmerProfile from "./pages/profile/FarmerProfile";
import DriverProfile from "./pages/profile/DriverProfile";
import FarmProfileView from "./pages/FarmProfileView";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth/consumer" element={<ConsumerAuth />} />
          <Route path="/auth/driver" element={<DriverAuth />} />
          <Route path="/auth/farmer" element={<FarmerAuth />} />
          <Route path="/auth/admin" element={<AdminAuth />} />
          <Route path="/consumer/shop" element={<Shop />} />
          <Route path="/consumer/orders" element={<ConsumerOrderTracking />} />
          <Route path="/consumer/profile" element={<ConsumerProfile />} />
          <Route path="/driver/dashboard" element={<DriverDashboard />} />
          <Route path="/driver/profile" element={<DriverProfile />} />
          <Route path="/farmer/dashboard" element={<FarmerDashboard />} />
          <Route path="/farmer/profile" element={<FarmerProfile />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/farm/:farmId" element={<FarmProfileView />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
