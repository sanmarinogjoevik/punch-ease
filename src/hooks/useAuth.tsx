import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  userRole: 'superadmin' | 'admin' | 'employee' | null;
  companyId: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'superadmin' | 'admin' | 'employee' | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer role and company fetching with setTimeout to avoid callback issues
          setTimeout(async () => {
            try {
              const [roleData, profileData] = await Promise.all([
                supabase
                  .from('user_roles')
                  .select('role')
                  .eq('user_id', session.user.id)
                  .single(),
                supabase
                  .from('profiles')
                  .select('company_id')
                  .eq('user_id', session.user.id)
                  .single()
              ]);
              
              setUserRole(roleData.data?.role || 'employee');
              setCompanyId(profileData.data?.company_id || null);
            } catch (error) {
              console.error('Error fetching user data:', error);
              setUserRole('employee');
              setCompanyId(null);
            }
          }, 0);
        } else {
          setUserRole(null);
          setCompanyId(null);
        }
        
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          first_name: firstName,
          last_name: lastName,
        }
      }
    });
    return { error };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      // Even if logout fails on server, clear local session
      console.error('Logout error:', error);
    } finally {
      // Force clear local storage to ensure clean logout
      localStorage.removeItem('sb-eynulvphjcojanzryfyi-auth-token');
      setUser(null);
      setSession(null);
      setUserRole(null);
      setCompanyId(null);
    }
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    userRole,
    companyId,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return {
    ...context,
    isSuperAdmin: context.userRole === 'superadmin',
    isAdmin: context.userRole === 'admin',
    isEmployee: context.userRole === 'employee',
  };
}
