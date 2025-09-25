import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useCompanySettings, useUpdateCompanySettings } from '@/hooks/useCompanySettings';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const companySettingsSchema = z.object({
  company_name: z.string().min(1, 'Företagsnamn krävs'),
  address: z.string().optional(),
  postal_code: z.string().optional(),
  city: z.string().optional(),
  org_number: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Ogiltig e-postadress').optional().or(z.literal('')),
  website: z.string().url('Ogiltig webbadress').optional().or(z.literal('')),
});

type CompanySettingsForm = z.infer<typeof companySettingsSchema>;

export function Settings() {
  const { userRole } = useAuth();
  const { data: companySettings, isLoading } = useCompanySettings();
  const updateCompanySettings = useUpdateCompanySettings();
  const { toast } = useToast();

  const form = useForm<CompanySettingsForm>({
    resolver: zodResolver(companySettingsSchema),
    values: companySettings || {
      company_name: 'Mitt Företag AB',
      address: '',
      postal_code: '',
      city: '',
      org_number: '',
      phone: '',
      email: '',
      website: '',
    },
  });

  if (userRole !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Du har inte behörighet att komma åt denna sida.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const onSubmit = async (data: CompanySettingsForm) => {
    try {
      // Ensure company_name is always present
      const settingsData = {
        ...data,
        company_name: data.company_name || 'Mitt Företag AB'
      };
      await updateCompanySettings.mutateAsync(settingsData);
      toast({
        title: 'Inställningar sparade',
        description: 'Företagsinställningarna har uppdaterats.',
      });
    } catch (error) {
      toast({
        title: 'Fel',
        description: 'Kunde inte spara inställningarna. Försök igen.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Inställningar</h1>
        <p className="text-muted-foreground">
          Hantera företagsinformation och systeminställningar
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Företagsinformation</CardTitle>
            <CardDescription>
              Denna information visas på timelistan och andra rapporter
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">Företagsnamn *</Label>
                <Input
                  id="company_name"
                  {...form.register('company_name')}
                  placeholder="Mitt Företag AB"
                />
                {form.formState.errors.company_name && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.company_name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="org_number">Organisationsnummer</Label>
                <Input
                  id="org_number"
                  {...form.register('org_number')}
                  placeholder="556123-4567"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Adress</Label>
                <Input
                  id="address"
                  {...form.register('address')}
                  placeholder="Företagsgatan 1"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="postal_code">Postnummer</Label>
                <Input
                  id="postal_code"
                  {...form.register('postal_code')}
                  placeholder="123 45"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">Stad</Label>
                <Input
                  id="city"
                  {...form.register('city')}
                  placeholder="Stockholm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefon</Label>
                <Input
                  id="phone"
                  {...form.register('phone')}
                  placeholder="08-123 45 67"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-post</Label>
                <Input
                  id="email"
                  type="email"
                  {...form.register('email')}
                  placeholder="info@mittforetag.se"
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Webbsida</Label>
                <Input
                  id="website"
                  {...form.register('website')}
                  placeholder="https://www.mittforetag.se"
                />
                {form.formState.errors.website && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.website.message}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button 
            type="submit" 
            disabled={updateCompanySettings.isPending}
            className="min-w-[120px]"
          >
            {updateCompanySettings.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sparar...
              </>
            ) : (
              'Spara ändringar'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default Settings;