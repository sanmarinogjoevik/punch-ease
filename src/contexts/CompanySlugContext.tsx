import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface CompanyInfo {
  id: string;
  name: string;
  slug: string;
}

interface CompanySlugContextType {
  companySlug: string | null;
  companyId: string | null;
  companyInfo: CompanyInfo | null;
  loading: boolean;
}

const CompanySlugContext = createContext<CompanySlugContextType | undefined>(undefined);

export function CompanySlugProvider({ children }: { children: ReactNode }) {
  const { companySlug } = useParams<{ companySlug: string }>();
  const navigate = useNavigate();
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCompanyBySlug() {
      if (!companySlug) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('companies')
          .select('id, name, slug')
          .eq('slug', companySlug)
          .maybeSingle();

        if (error) {
          console.error('Error fetching company:', error);
          navigate('/');
          return;
        }

        if (!data) {
          console.error('Company not found for slug:', companySlug);
          navigate('/');
          return;
        }

        setCompanyInfo(data);
      } catch (error) {
        console.error('Error:', error);
        navigate('/');
      } finally {
        setLoading(false);
      }
    }

    fetchCompanyBySlug();
  }, [companySlug, navigate]);

  const value = {
    companySlug: companySlug || null,
    companyId: companyInfo?.id || null,
    companyInfo,
    loading,
  };

  return (
    <CompanySlugContext.Provider value={value}>
      {children}
    </CompanySlugContext.Provider>
  );
}

export function useCompanySlug() {
  const context = useContext(CompanySlugContext);
  
  if (context === undefined) {
    throw new Error('useCompanySlug must be used within a CompanySlugProvider');
  }
  
  return context;
}
