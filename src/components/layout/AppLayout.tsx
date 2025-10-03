import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { UserProfile } from '@/components/UserProfile';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { useCompanySlug } from '@/contexts/CompanySlugContext';
import { useNavigate } from 'react-router-dom';

export function AppLayout() {
  const { signOut } = useAuth();
  const { companySlug } = useCompanySlug();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const handleSignOut = async () => {
    await signOut();
    navigate(`/${companySlug}/auth`);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          <header className="h-14 border-b bg-background flex items-center justify-between px-4 md:px-6">
            <SidebarTrigger />
            <div className="flex items-center gap-3">
              <UserProfile />
              <Button 
                variant="ghost" 
                size={isMobile ? "sm" : "sm"}
                onClick={handleSignOut}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4 mr-2" />
                {!isMobile && <span>Sign Out</span>}
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