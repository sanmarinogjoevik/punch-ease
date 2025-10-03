import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useCompanySlug } from '@/contexts/CompanySlugContext';
import { EmployeeSelector } from '@/components/EmployeeSelector';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function Auth() {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<{ email: string; name: string } | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { signIn, user, companyId, loading: authLoading } = useAuth();
  const { companySlug, companyInfo, loading: companyLoading } = useCompanySlug();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Redirect if already authenticated with company access
  if (user && companyId && !authLoading && companySlug) {
    return <Navigate to={`/${companySlug}`} replace />;
  }

  // Show loading while company is being fetched
  if (companyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If no company found, redirect to home
  if (!companyInfo) {
    return <Navigate to="/" replace />;
  }

  const handleEmployeeSelect = (employeeEmail: string, employeeName: string) => {
    setSelectedEmployee({ email: employeeEmail, name: employeeName });
  };

  const handleBack = () => {
    setSelectedEmployee(null);
    setPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const loginEmail = isAdminMode ? email : selectedEmployee?.email || '';

    try {
      const result = await signIn(loginEmail, password);

      if (result.error) {
        toast({
          title: 'Fel',
          description: result.error.message,
          variant: 'destructive',
        });
      } else {
        // Redirect to company-specific page after successful login
        navigate(`/${companySlug}`);
      }
    } catch (error) {
      toast({
        title: 'Fel',
        description: 'Ett oväntat fel inträffade',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            {isAdminMode ? 'Admin Inloggning' : selectedEmployee ? `Välkommen ${selectedEmployee.name}` : 'Välj Anställd'}
          </CardTitle>
          <CardDescription>
            {companyInfo.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isAdminMode && !selectedEmployee && (
            <div className="space-y-6">
              <EmployeeSelector companyId={companyInfo.id} onSelectEmployee={handleEmployeeSelect} />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setIsAdminMode(true)}
              >
                Admin Inloggning
              </Button>
            </div>
          )}

          {!isAdminMode && selectedEmployee && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Ändra användare
              </Button>

              <div className="space-y-2">
                <Label htmlFor="selected-email">E-post</Label>
                <Input
                  id="selected-email"
                  type="email"
                  value={selectedEmployee.email}
                  readOnly
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Lösenord</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  placeholder="Ange ditt lösenord"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Loggar in...' : 'Logga in'}
              </Button>
            </form>
          )}

          {isAdminMode && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsAdminMode(false);
                  setEmail('');
                  setPassword('');
                }}
                className="mb-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Tillbaka
              </Button>

              <div className="space-y-2">
                <Label htmlFor="email">E-post</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="admin-password">Lösenord</Label>
                <Input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Loggar in...' : 'Logga in'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}