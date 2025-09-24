import { Home, Calendar, Clock, Users, BarChart3, Shield } from 'lucide-react';
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

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { userRole } = useAuth();
  const collapsed = state === 'collapsed';
  
  const currentPath = location.pathname;
  const isActive = (path: string) => currentPath === path;
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'hover:bg-sidebar-accent/50';

  const employeeItems = [
    { title: 'Dashboard', url: '/', icon: Home },
    { title: 'My Schedule', url: '/schedule', icon: Calendar },
    { title: 'Time Entries', url: '/timesheet', icon: Clock },
  ];

  const adminItems = [
    { title: 'Dashboard', url: '/', icon: Home },
    { title: 'Admin', url: '/admin', icon: Shield },
    { title: 'Schedule', url: '/schedule', icon: Calendar },
    { title: 'Time Entries', url: '/timesheet', icon: Clock },
    { title: 'Employees', url: '/employees', icon: Users },
    { title: 'Reports', url: '/reports', icon: BarChart3 },
  ];

  const items = userRole === 'admin' ? adminItems : employeeItems;

  return (
    <Sidebar className={collapsed ? 'w-14' : 'w-60'} collapsible="icon">
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
            {userRole === 'admin' ? 'Admin Panel' : 'Employee'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavCls}>
                      <item.icon className="h-4 w-4 mr-2" />
                      {!collapsed && <span>{item.title}</span>}
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