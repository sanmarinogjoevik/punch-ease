import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface CreateCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateCompanyDialog({ open, onOpenChange, onSuccess }: CreateCompanyDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    companyName: '',
    email: '',
    phone: '',
    address: '',
    postalCode: '',
    city: '',
    orgNumber: '',
    adminEmail: '',
    adminPassword: '',
    adminFirstName: '',
    adminLastName: '',
    tenantUsername: '',
    tenantPassword: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-company', {
        body: formData
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Företag skapat!',
        description: `${formData.companyName} har skapats med admin: ${formData.adminEmail}`
      });

      // Reset form
      setFormData({
        companyName: '',
        email: '',
        phone: '',
        address: '',
        postalCode: '',
        city: '',
        orgNumber: '',
        adminEmail: '',
        adminPassword: '',
        adminFirstName: '',
        adminLastName: '',
        tenantUsername: '',
        tenantPassword: ''
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error creating company:', error);
      toast({
        title: 'Fel',
        description: error.message || 'Kunde inte skapa företag',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Skapa Nytt Företag</DialogTitle>
          <DialogDescription>
            Fyll i information om företaget och skapa en admin-användare
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Företagsinformation</h3>
            
            <div className="space-y-2">
              <Label htmlFor="companyName">Företagsnamn *</Label>
              <Input
                id="companyName"
                required
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefon</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Adress</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postalCode">Postnummer</Label>
                <Input
                  id="postalCode"
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">Stad</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="orgNumber">Organisationsnummer</Label>
              <Input
                id="orgNumber"
                value={formData.orgNumber}
                onChange={(e) => setFormData({ ...formData, orgNumber: e.target.value })}
              />
            </div>
          </div>

          {/* Admin User */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold text-sm">Admin-användare</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="adminFirstName">Förnamn *</Label>
                <Input
                  id="adminFirstName"
                  required
                  value={formData.adminFirstName}
                  onChange={(e) => setFormData({ ...formData, adminFirstName: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminLastName">Efternamn *</Label>
                <Input
                  id="adminLastName"
                  required
                  value={formData.adminLastName}
                  onChange={(e) => setFormData({ ...formData, adminLastName: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminEmail">Email *</Label>
              <Input
                id="adminEmail"
                type="email"
                required
                value={formData.adminEmail}
                onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminPassword">Lösenord *</Label>
              <Input
                id="adminPassword"
                type="password"
                required
                value={formData.adminPassword}
                onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
              />
            </div>
          </div>

          {/* Tenant Access (Optional) */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold text-sm">Tenant-inloggning (valfritt)</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tenantUsername">Användarnamn</Label>
                <Input
                  id="tenantUsername"
                  value={formData.tenantUsername}
                  onChange={(e) => setFormData({ ...formData, tenantUsername: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tenantPassword">Lösenord</Label>
                <Input
                  id="tenantPassword"
                  type="password"
                  value={formData.tenantPassword}
                  onChange={(e) => setFormData({ ...formData, tenantPassword: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Avbryt
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Skapar...' : 'Skapa Företag'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}