import { Home, Calendar, Clock, Users, BarChart3, Shield, Settings, Thermometer } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { userRole } = useAuth();
  const isMobile = useIsMobile();
  const collapsed = state === 'collapsed';
  
  const currentPath = location.pathname;
  const isActive = (path: string) => currentPath === path;
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'hover:bg-sidebar-accent/50';

  const employeeItems = [
    { title: 'Dashboard', url: '/', icon: Home },
    { title: 'Min Plan', url: '/my-schedule', icon: Calendar },
    { title: 'Tidsregistrering', url: '/timesheet', icon: Clock },
    { title: 'Temperaturlogg', url: '/temperature-log', icon: Thermometer },
    { title: 'Timeliste', url: '/timeliste', icon: BarChart3 },
  ];

  const adminItems = [
    { title: 'Admin', url: '/admin', icon: Shield },
    { title: 'Vaktliste', url: '/schedule', icon: Calendar },
    { title: 'Tidsregistrering', url: '/timesheet', icon: Clock },
    { title: 'Ansatte', url: '/employees', icon: Users },
    { title: 'Rapporter', url: '/reports', icon: BarChart3 },
    { title: 'Inställningar', url: '/settings', icon: Settings },
  ];

  const items = userRole === 'admin' ? adminItems : employeeItems;

  return (
    <Sidebar 
      className={collapsed ? (isMobile ? 'w-0' : 'w-14') : (isMobile ? 'w-80' : 'w-60')} 
      collapsible="icon"
    >
      <SidebarContent>
        <div className="p-4">
          {!collapsed && (
            <h2 className="text-lg font-semibold text-sidebar-foreground">
              PunchEase
            </h2>
          )}
        </div>
        
        <SidebarGroup>
          <SidebarGroupLabel>
            {userRole === 'admin' ? 'Administrasjon' : 'Ansatt'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild size={isMobile ? "lg" : "default"}>
                    <NavLink to={item.url} end className={getNavCls}>
                      <item.icon className={`h-4 w-4 ${isMobile ? 'mr-3' : 'mr-2'}`} />
                      {!collapsed && <span className={isMobile ? 'text-base' : ''}>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}