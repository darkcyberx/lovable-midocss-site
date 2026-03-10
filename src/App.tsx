import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load pages
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Licenses = lazy(() => import("./pages/Licenses"));
const Customers = lazy(() => import("./pages/Customers"));
const Products = lazy(() => import("./pages/Products"));
const Devices = lazy(() => import("./pages/Devices"));
const Logs = lazy(() => import("./pages/Logs"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const ApiCredentials = lazy(() => import("./pages/ApiCredentials"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));
const TelegramSettings = lazy(() => import("./pages/TelegramSettings"));
const RenewalOrders = lazy(() => import("./pages/RenewalOrders"));
const RustDeskIds = lazy(() => import("./pages/RustDeskIds"));
const IpManagement = lazy(() => import("./pages/IpManagement"));
const BlockedHwids = lazy(() => import("./pages/BlockedHwids"));
const Alerts = lazy(() => import("./pages/Alerts"));
const LegacyMonitor = lazy(() => import("./pages/LegacyMonitor"));
const MigrationGuide = lazy(() => import("./pages/MigrationGuide"));
const NotFound = lazy(() => import("./pages/NotFound"));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (previously cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="space-y-4 w-full max-w-md p-6">
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            
            
            {/* Admin Dashboard Routes */}
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/licenses" element={<Licenses />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/products" element={<Products />} />
              <Route path="/devices" element={<Devices />} />
              <Route path="/logs" element={<Logs />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/api-credentials" element={<ApiCredentials />} />
              <Route path="/notification-settings" element={<NotificationSettings />} />
              <Route path="/telegram-settings" element={<TelegramSettings />} />
              <Route path="/renewal-orders" element={<RenewalOrders />} />
              <Route path="/ip-management" element={<IpManagement />} />
              <Route path="/blocked-hwids" element={<BlockedHwids />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/legacy-monitor" element={<LegacyMonitor />} />
              <Route path="/rustdesk-ids" element={<RustDeskIds />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/migration-guide" element={<MigrationGuide />} />
            </Route>
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
