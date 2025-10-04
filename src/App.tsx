import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import { TenantProvider } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import TenantLogin from './pages/TenantLogin';
import Auth from './pages/Auth';
import NotFound from './pages/NotFound';
import { AppLayout } from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Schedule from './pages/Schedule';
import EmployeeSchedule from './pages/EmployeeSchedule';
import TimeEntries from './pages/TimeEntries';
import Reports from './pages/Reports';
import Employees from './pages/Employees';
import Admin from './pages/Admin';
import Settings from './pages/Settings';
import TemperatureLog from './pages/TemperatureLog';
import Timeliste from './pages/Timeliste';
import Bedriftskunder from './pages/Bedriftskunder';
import Beställningar from './pages/Beställningar';

const queryClient = new QueryClient();

// Protected route wrapper that requires tenant authentication
function TenantProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useTenant();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// Protected route wrapper that requires both tenant and user authentication
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isAuthenticated } = useTenant();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-lg text-foreground">Laster...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}


function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<TenantLogin />} />
      <Route path="/auth" element={<TenantProtectedRoute><Auth /></TenantProtectedRoute>} />
      
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/employee-schedule" element={<EmployeeSchedule />} />
        <Route path="/time-entries" element={<TimeEntries />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/temperature-log" element={<TemperatureLog />} />
        <Route path="/timeliste" element={<Timeliste />} />
        <Route path="/bedriftskunder" element={<Bedriftskunder />} />
        <Route path="/beställningar" element={<Beställningar />} />
      </Route>
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HashRouter>
          <TenantProvider>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </TenantProvider>
        </HashRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
