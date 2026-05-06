import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, [pathname]);
  return null;
}
import { AuthProvider } from "@/hooks/useAuth";
import { SplashScreen } from "@/components/SplashScreen";
import Index from "./pages/Index";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import Shop from "./pages/Shop";
import Cart from "./pages/Cart";
import VideoAds from "./pages/VideoAds";
import PromoterDashboard from "./pages/PromoterDashboard";
import PromoterProducts from "./pages/PromoterProducts";
import PromoterEarnings from "./pages/PromoterEarnings";
import PromoterWithdrawals from "./pages/PromoterWithdrawals";
import PromoterProfile from "./pages/PromoterProfile";
import PromoterReferralLinks from "./pages/PromoterReferralLinks";
import ManagerDashboard from "./pages/ManagerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import PromoterApplication from "./pages/PromoterApplication";
import Auth from "./pages/Auth";
import ShopperProfile from "./pages/ShopperProfile";
import NotFound from "./pages/NotFound";
import About from "./pages/About";
import Terms from "./pages/Terms";
import MyOrders from "./pages/MyOrders";
import Categories from "./pages/Categories";
import Wishlist from "./pages/Wishlist";
import Contact from "./pages/Contact";
import Notifications from "./pages/Notifications";
import VendorDashboard from "./pages/VendorDashboard";
import VendorApplication from "./pages/VendorApplication";
import ReferralRedirect from "./pages/ReferralRedirect";
import PaymentCallback from "./pages/PaymentCallback";
import OrderConfirmation from "./pages/OrderConfirmation";
import ShowcasePage from "./pages/ShowcasePage";
import CustomOrderPage from "./pages/CustomOrderPage";

const queryClient = new QueryClient();

const App = () => {
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Shop />} />
            <Route path="/landing" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/products" element={<Products />} />
            <Route path="/product/:productId" element={<ProductDetail />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/videos" element={<VideoAds />} />
            <Route path="/r/:code" element={<ReferralRedirect />} />
            <Route path="/profile" element={<ShopperProfile />} />
            <Route path="/promoter/dashboard" element={<PromoterDashboard />} />
            <Route path="/promoter/products" element={<PromoterProducts />} />
            <Route path="/promoter/earnings" element={<PromoterEarnings />} />
            <Route path="/promoter/withdrawals" element={<PromoterWithdrawals />} />
            <Route path="/promoter/profile" element={<PromoterProfile />} />
            <Route path="/promoter/links" element={<PromoterReferralLinks />} />
            <Route path="/promoter/apply" element={<PromoterApplication />} />
            <Route path="/promoter-application" element={<PromoterApplication />} />
            <Route path="/manager/dashboard" element={<ManagerDashboard />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/about" element={<About />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/my-orders" element={<MyOrders />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/vendor/dashboard" element={<VendorDashboard />} />
            <Route path="/vendor/apply" element={<VendorApplication />} />
            <Route path="/payment-callback" element={<PaymentCallback />} />
            <Route path="/order-confirmation" element={<OrderConfirmation />} />
            <Route path="/custom-order/:productId" element={<CustomOrderPage />} />
            <Route path="/shop/:shopName" element={<ShowcasePage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
