import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Bedriftskunde {
  id: string;
  firmanamn: string;
  orgnr: string;
  adress: string;
  telefon?: string;
  epost?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateBedriftskunde {
  firmanamn: string;
  orgnr: string;
  adress: string;
  telefon?: string;
  epost?: string;
}

export const useBedriftskunder = () => {
  const [bedriftskunder, setBedriftskunder] = useState<Bedriftskunde[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchBedriftskunder = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('bedriftskunder')
        .select('*')
        .order('firmanamn', { ascending: true });

      if (error) throw error;
      setBedriftskunder(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Fel",
        description: error.message || "Kunde inte hämta bedriftskunder"
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const createBedriftskunde = async (data: CreateBedriftskunde) => {
    try {
      const { error } = await supabase
        .from('bedriftskunder')
        .insert([data]);

      if (error) throw error;

      toast({
        title: "Framgång",
        description: "Bedriftskunde skapad"
      });

      fetchBedriftskunder();
      return { success: true };
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Fel",
        description: error.message || "Kunde inte skapa bedriftskunde"
      });
      return { success: false };
    }
  };

  const updateBedriftskunde = async (id: string, data: Partial<CreateBedriftskunde>) => {
    try {
      const { error } = await supabase
        .from('bedriftskunder')
        .update(data)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Framgång",
        description: "Bedriftskunde uppdaterad"
      });

      fetchBedriftskunder();
      return { success: true };
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Fel",
        description: error.message || "Kunde inte uppdatera bedriftskunde"
      });
      return { success: false };
    }
  };

  const deleteBedriftskunde = async (id: string) => {
    try {
      const { error } = await supabase
        .from('bedriftskunder')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Framgång",
        description: "Bedriftskunde borttagen"
      });

      fetchBedriftskunder();
      return { success: true };
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Fel",
        description: error.message || "Kunde inte ta bort bedriftskunde"
      });
      return { success: false };
    }
  };

  useEffect(() => {
    fetchBedriftskunder();

    const channel = supabase
      .channel('bedriftskunder-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bedriftskunder'
        },
        () => {
          fetchBedriftskunder();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchBedriftskunder]);

  return {
    bedriftskunder,
    isLoading,
    createBedriftskunde,
    updateBedriftskunde,
    deleteBedriftskunde,
    refetch: fetchBedriftskunder
  };
};
