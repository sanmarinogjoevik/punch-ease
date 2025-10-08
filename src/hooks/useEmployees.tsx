import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Employee {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone?: string | null;
  personal_number?: string | null;
  company_id?: string;
  created_at: string;
  updated_at: string;
}

// Query keys
export const employeesKeys = {
  all: ['employees'] as const,
  byId: (id: string) => [...employeesKeys.all, id] as const,
};

// Hook to fetch all employees (excluding admins and superadmins)
export const useEmployees = (overrideCompanyId?: string) => {
  return useQuery({
    queryKey: [...employeesKeys.all, 'no-admins', overrideCompanyId],
    queryFn: async (): Promise<Employee[]> => {
      let targetCompanyId: string;
      
      if (overrideCompanyId) {
        // Use provided company_id (from tenant context)
        targetCompanyId = overrideCompanyId;
      } else {
        // Get current user's company_id
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('User not authenticated');
        }

        const { data: currentUserProfile, error: profileError } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('user_id', user.id)
          .single();

        if (profileError || !currentUserProfile?.company_id) {
          console.error('Error fetching user profile:', profileError);
          throw new Error('Could not fetch user company');
        }
        
        targetCompanyId = currentUserProfile.company_id;
      }

      // Get all admin and superadmin user IDs
      const { data: adminRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'superadmin']);

      if (rolesError) {
        console.error('Error fetching admin roles:', rolesError.message);
        throw rolesError;
      }

      const adminUserIds = adminRoles?.map(role => role.user_id) || [];
      console.log('Admin/Superadmin user IDs to filter out:', adminUserIds);

      // Fetch profiles filtered by company_id on server-side
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('company_id', targetCompanyId)
        .order('first_name', { ascending: true });

      if (error) {
        console.error('Error fetching employees:', error.message);
        throw error;
      }

      console.log('Profiles from company before admin filtering:', data?.length);
      
      // Filter out admins and superadmins on the client side
      const employees = data?.filter(profile => {
        const isAdmin = adminUserIds.includes(profile.user_id);
        if (isAdmin) {
          console.log('Filtering out admin/superadmin:', profile.first_name, profile.last_name);
        }
        return !isAdmin;
      }) || [];

      console.log('Employees after filtering:', employees.length);

      return employees;
    },
  });
};

// Hook to fetch a single employee by ID
export const useEmployee = (employeeId: string) => {
  return useQuery({
    queryKey: employeesKeys.byId(employeeId),
    queryFn: async (): Promise<Employee | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', employeeId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        console.error('Error fetching employee:', error.message);
        throw error;
      }

      return data;
    },
    enabled: !!employeeId,
  });
};