import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface TenantContextType {
  tenantUsername: string | null;
  tenantId: string | null;
  companyId: string | null;
  isAuthenticated: boolean;
  loginTenant: (username: string, companyId: string, tenantId: string, rememberMe: boolean) => void;
  logoutTenant: () => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

const TENANT_STORAGE_KEY = 'punchease_tenant';

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenantUsername, setTenantUsername] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    // Load tenant data from localStorage on mount
    const stored = localStorage.getItem(TENANT_STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        setTenantUsername(data.username);
        setTenantId(data.tenantId);
        setCompanyId(data.companyId);
      } catch (error) {
        console.error('Error loading tenant data:', error);
        localStorage.removeItem(TENANT_STORAGE_KEY);
      }
    }
  }, []);

  const loginTenant = (username: string, cId: string, tId: string, rememberMe: boolean) => {
    setTenantUsername(username);
    setCompanyId(cId);
    setTenantId(tId);
    
    if (rememberMe) {
      localStorage.setItem(TENANT_STORAGE_KEY, JSON.stringify({
        username,
        companyId: cId,
        tenantId: tId,
      }));
    }
  };

  const logoutTenant = () => {
    setTenantUsername(null);
    setCompanyId(null);
    setTenantId(null);
    localStorage.removeItem(TENANT_STORAGE_KEY);
  };

  const value = {
    tenantUsername,
    tenantId,
    companyId,
    isAuthenticated: !!companyId,
    loginTenant,
    logoutTenant,
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
