import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './useAuth';

export interface Equipment {
  id: string;
  name: string;
  type: 'refrigerator' | 'freezer';
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateEquipment {
  name: string;
  type: 'refrigerator' | 'freezer';
  description?: string;
}

export function useEquipment() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { companyId } = useAuth();

  const fetchEquipment = async (activeOnly: boolean = true) => {
    try {
      setIsLoading(true);
      setError(null);

      let query = supabase
        .from('equipment')
        .select('*')
        .order('type', { ascending: true })
        .order('name', { ascending: true });

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        console.error('Error fetching equipment:', fetchError);
        setError(fetchError.message);
        return;
      }

      setEquipment(data || []);
    } catch (err) {
      console.error('Error in fetchEquipment:', err);
      setError('Ett fel uppstod vid hämtning av utrustning');
    } finally {
      setIsLoading(false);
    }
  };

  const createEquipment = async (equipmentData: CreateEquipment) => {
    try {
      if (!companyId) {
        throw new Error('Company ID saknas');
      }

      const { data, error: insertError } = await supabase
        .from('equipment')
        .insert([{ ...equipmentData, company_id: companyId }])
        .select()
        .single();

      if (insertError) {
        console.error('Error creating equipment:', insertError);
        throw new Error(insertError.message);
      }

      // Add to local state
      if (data) {
        setEquipment(prev => [...prev, data].sort((a, b) => {
          if (a.type !== b.type) {
            return a.type.localeCompare(b.type);
          }
          return a.name.localeCompare(b.name);
        }));
      }

      return data;
    } catch (err) {
      console.error('Error in createEquipment:', err);
      throw err;
    }
  };

  const updateEquipment = async (id: string, updates: Partial<Equipment>) => {
    try {
      const { data, error: updateError } = await supabase
        .from('equipment')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating equipment:', updateError);
        throw new Error(updateError.message);
      }

      // Update local state
      if (data) {
        setEquipment(prev => prev.map(item => 
          item.id === id ? data : item
        ));
      }

      return data;
    } catch (err) {
      console.error('Error in updateEquipment:', err);
      throw err;
    }
  };

  const deactivateEquipment = async (id: string) => {
    return updateEquipment(id, { is_active: false });
  };

  const getActiveEquipment = () => {
    return equipment.filter(item => item.is_active);
  };

  const getEquipmentOptions = () => {
    return getActiveEquipment().map(item => ({
      value: item.name,
      label: `${item.name} (${item.type === 'refrigerator' ? 'Kyl' : 'Frys'})`,
      type: item.type
    }));
  };

  useEffect(() => {
    fetchEquipment();
  }, []);

  return {
    equipment,
    isLoading,
    error,
    fetchEquipment,
    createEquipment,
    updateEquipment,
    deactivateEquipment,
    getActiveEquipment,
    getEquipmentOptions,
  };
}