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

      // Convert business_hours from Json to BusinessHours[]
      const businessHours = data.business_hours 
        ? (Array.isArray(data.business_hours) ? data.business_hours as unknown as BusinessHours[] : undefined)
        : undefined;

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
      // Convert business_hours to Json format for database
      const settingsForDb = {
        ...settings,
        business_hours: settings.business_hours 
          ? JSON.stringify(settings.business_hours) as any
          : undefined,
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
        // Insert new settings
        result = await supabase
          .from('company_settings')
          .insert(settingsForDb)
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