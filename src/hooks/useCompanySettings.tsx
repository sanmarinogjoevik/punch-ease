import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BusinessHours {
  day: number; // 0-6 (söndag-lördag)
  dayName: string;
  isOpen: boolean;
  openTime: string; // 'HH:MM' format
  closeTime: string; // 'HH:MM' format
}

export interface CompanySettings {
  id: string;
  company_name: string;
  address?: string;
  postal_code?: string;
  city?: string;
  org_number?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo_url?: string;
  business_hours?: BusinessHours[];
  tenant_username?: string;
  tenant_password_hash?: string;
  created_at: string;
  updated_at: string;
}

export interface CompanySettingsUpdate {
  company_name: string;
  address?: string;
  postal_code?: string;
  city?: string;
  org_number?: string;
  phone?: string;
  email?: string;
  website?: string;
  business_hours?: BusinessHours[];
  tenant_username?: string;
  tenant_password?: string; // Cleartext password, will be hashed via edge function
}

export function useCompanySettings() {
  return useQuery({
    queryKey: ['company-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) return null;

      // Convert business_hours from Json string to BusinessHours[]
      let businessHours: BusinessHours[] | undefined = undefined;
      
      if (data.business_hours) {
        try {
          // If it's already an array (should not happen from DB), use as is
          if (Array.isArray(data.business_hours)) {
            businessHours = data.business_hours as unknown as BusinessHours[];
          } 
          // If it's a string (normal case from DB), parse it
          else if (typeof data.business_hours === 'string') {
            businessHours = JSON.parse(data.business_hours) as BusinessHours[];
          }
          // If it's an object (fallback), try to use as is
          else if (typeof data.business_hours === 'object') {
            businessHours = data.business_hours as unknown as BusinessHours[];
          }
          
          console.log('Parsed business_hours from DB:', businessHours);
        } catch (error) {
          console.error('Error parsing business_hours from database:', error);
          console.log('Raw business_hours data:', data.business_hours);
          businessHours = undefined; // Will fallback to default in component
        }
      }

      return {
        ...data,
        business_hours: businessHours,
      } as CompanySettings;
    },
  });
}

export function useUpdateCompanySettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: CompanySettingsUpdate) => {
      // Hash password if provided
      let tenant_password_hash: string | undefined = undefined;
      if (settings.tenant_password) {
        const { data: hashData, error: hashError } = await supabase.functions.invoke(
          'hash-tenant-password',
          {
            body: { password: settings.tenant_password },
          }
        );

        if (hashError) {
          throw new Error(`Failed to hash password: ${hashError.message}`);
        }

        tenant_password_hash = hashData.hash;
      }

      // Convert business_hours to Json format for database
      const settingsForDb = {
        ...settings,
        business_hours: settings.business_hours 
          ? JSON.stringify(settings.business_hours) as any
          : undefined,
        tenant_password_hash,
        tenant_password: undefined, // Remove cleartext password
      };

      // First, check if settings exist
      const { data: existing } = await supabase
        .from('company_settings')
        .select('id')
        .maybeSingle();

      let result;
      if (existing) {
        // Update existing settings
        result = await supabase
          .from('company_settings')
          .update(settingsForDb)
          .eq('id', existing.id)
          .select()
          .single();
      } else {
        // Insert new settings - get company_id from current user
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('user_id', user?.id)
          .single();

        result = await supabase
          .from('company_settings')
          .insert({ ...settingsForDb, company_id: profile?.company_id || '' })
          .select()
          .single();
      }

      if (result.error) {
        throw result.error;
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-settings'] });
    },
  });
}