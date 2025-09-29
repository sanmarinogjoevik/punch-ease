import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TemperatureLog {
  id: string;
  employee_id: string;
  equipment_name: string;
  temperature: number;
  timestamp: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    first_name: string;
    last_name: string;
  };
}

export interface CreateTemperatureLog {
  equipment_name: string;
  temperature: number;
  notes?: string;
}

export const useTemperatureLogs = () => {
  const [temperatureLogs, setTemperatureLogs] = useState<TemperatureLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemperatureLogs = async (startDate?: string, endDate?: string, equipmentName?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      let query = supabase
        .from('temperature_logs')
        .select('*')
        .order('timestamp', { ascending: false });

      if (startDate) {
        query = query.gte('timestamp', startDate);
      }
      
      if (endDate) {
        query = query.lte('timestamp', endDate);
      }
      
      if (equipmentName) {
        query = query.eq('equipment_name', equipmentName);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Get employee names separately
      const logsWithProfiles = await Promise.all(
        (data || []).map(async (log) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('user_id', log.employee_id)
            .single();
          
          return {
            ...log,
            profiles: profile ? {
              first_name: profile.first_name || '',
              last_name: profile.last_name || ''
            } : undefined
          };
        })
      );
      
      setTemperatureLogs(logsWithProfiles);
    } catch (err) {
      console.error('Error fetching temperature logs:', err);
      setError(err instanceof Error ? err.message : 'Ett fel uppstod');
    } finally {
      setIsLoading(false);
    }
  };

  const createTemperatureLog = async (logData: CreateTemperatureLog) => {
    try {
      setError(null);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Du måste vara inloggad');

      const { data, error } = await supabase
        .from('temperature_logs')
        .insert({
          employee_id: user.id,
          equipment_name: logData.equipment_name,
          temperature: logData.temperature,
          notes: logData.notes,
        })
        .select('*')
        .single();

      if (error) throw error;
      
      // Get employee name
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('user_id', user.id)
        .single();
      
      const logWithProfile = {
        ...data,
        profiles: profile ? {
          first_name: profile.first_name || '',
          last_name: profile.last_name || ''
        } : undefined
      };
      
      // Add to current list
      setTemperatureLogs(prev => [logWithProfile, ...prev]);
      return logWithProfile;
    } catch (err) {
      console.error('Error creating temperature log:', err);
      setError(err instanceof Error ? err.message : 'Ett fel uppstod');
      throw err;
    }
  };

  const getTodaysLogs = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    await fetchTemperatureLogs(
      today.toISOString(),
      tomorrow.toISOString()
    );
  };

  useEffect(() => {
    getTodaysLogs();
  }, []);

  return {
    temperatureLogs,
    isLoading,
    error,
    fetchTemperatureLogs,
    createTemperatureLog,
    getTodaysLogs,
  };
};