import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { CompanySlugProvider } from "./contexts/CompanySlugContext";
import { AppLayout } from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import Auth from "./pages/Auth";
import Employees from "./pages/Employees";
import Schedule from "./pages/Schedule";
import TimeEntries from "./pages/TimeEntries";
import EmployeeSchedule from "./pages/EmployeeSchedule";
import TemperatureLog from "./pages/TemperatureLog";
import Timeliste from "./pages/Timeliste";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Bedriftskunder from "./pages/Bedriftskunder";
import Beställningar from "./pages/Beställningar";
import NotFound from "./pages/NotFound";
import Index from "./pages/Index";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, companyId } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-lg text-foreground">Laster...</div>
      </div>
    );
  }
  
  if (!user || !companyId) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

function RoleBasedRedirect() {
  const { userRole, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-lg text-foreground">Laster...</div>
      </div>
    );
  }
  
  if (userRole === 'admin') {
    return <Navigate to="admin" replace />;
  }
  
  return <Dashboard />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/:companySlug/auth" element={
        <CompanySlugProvider>
          <Auth />
        </CompanySlugProvider>
      } />
      <Route path="/:companySlug" element={
        <CompanySlugProvider>
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        </CompanySlugProvider>
      }>
        <Route index element={<RoleBasedRedirect />} />
        <Route path="admin" element={<Admin />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="my-schedule" element={<EmployeeSchedule />} />
        <Route path="timesheet" element={<TimeEntries />} />
        <Route path="temperature-log" element={<TemperatureLog />} />
        <Route path="timeliste" element={<Timeliste />} />
        <Route path="bedriftskunder" element={<Bedriftskunder />} />
        <Route path="beställningar" element={<Beställningar />} />
        <Route path="employees" element={<Employees />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <AppRoutes />
          </TooltipProvider>
        </AuthProvider>
      </HashRouter>
    </QueryClientProvider>
  );
};

export default App;
