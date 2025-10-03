import { createContext, useContext, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface CompanyContextType {
  companyId: string | null;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { companyId } = useAuth();

  return (
    <CompanyContext.Provider value={{ companyId }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  
  return context;
}
