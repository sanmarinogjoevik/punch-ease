import { Outlet, useNavigate } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { UserProfile } from '@/components/UserProfile';
import { Button } from '@/components/ui/button';
import { LogOut, Building2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useIsMobile } from '@/hooks/use-mobile';

export function AppLayout() {
  const { signOut } = useAuth();
  const { logoutTenant } = useTenant();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const handleTenantLogout = async () => {
    await signOut();
    logoutTenant();
    navigate('/');
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          <header className="h-14 border-b bg-background flex items-center justify-between px-4 md:px-6">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <UserProfile />
              <Button 
                variant="ghost" 
                size={isMobile ? "sm" : "sm"}
                onClick={signOut}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4 mr-2" />
                {!isMobile && <span>Sign Out</span>}
              </Button>
              <Button 
                variant="ghost" 
                size={isMobile ? "sm" : "sm"}
                onClick={handleTenantLogout}
                className="text-muted-foreground hover:text-foreground"
              >
                <Building2 className="h-4 w-4 mr-2" />
                {!isMobile && <span>Byt företag</span>}
              </Button>
            </div>
          </header>
          
          <main className="flex-1 p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}