import React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import { useCompanySettings, useUpdateCompanySettings, BusinessHours, CompanySettingsUpdate } from '@/hooks/useCompanySettings';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const businessHoursSchema = z.object({
  day: z.number(),
  dayName: z.string(),
  isOpen: z.boolean(),
  openTime: z.string(),
  closeTime: z.string(),
}).refine((data) => {
  if (!data.isOpen) return true;
  
  // Convert time strings to comparable format
  const openTimeMinutes = timeToMinutes(data.openTime);
  const closeTimeMinutes = timeToMinutes(data.closeTime);
  
  return openTimeMinutes < closeTimeMinutes;
}, {
  message: "Stängningstid måste vara efter öppningstid",
  path: ["closeTime"],
});

// Helper function to convert time string to minutes
function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

const companySettingsSchema = z.object({
  company_name: z.string().min(1, 'Företagsnamn krävs'),
  address: z.string().optional(),
  postal_code: z.string().optional(),
  city: z.string().optional(),
  org_number: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Ogiltig e-postadress').optional().or(z.literal('')),
  website: z.string().url('Ogiltig webbadress').optional().or(z.literal('')),
  business_hours: z.array(businessHoursSchema).optional(),
});

type CompanySettingsForm = z.infer<typeof companySettingsSchema>;

const defaultBusinessHours: BusinessHours[] = [
  { day: 1, dayName: "Måndag", isOpen: true, openTime: "08:00", closeTime: "17:00" },
  { day: 2, dayName: "Tisdag", isOpen: true, openTime: "08:00", closeTime: "17:00" },
  { day: 3, dayName: "Onsdag", isOpen: true, openTime: "08:00", closeTime: "17:00" },
  { day: 4, dayName: "Torsdag", isOpen: true, openTime: "08:00", closeTime: "17:00" },
  { day: 5, dayName: "Fredag", isOpen: true, openTime: "08:00", closeTime: "17:00" },
  { day: 6, dayName: "Lördag", isOpen: false, openTime: "09:00", closeTime: "15:00" },
  { day: 0, dayName: "Söndag", isOpen: false, openTime: "10:00", closeTime: "14:00" },
];

export default function Settings() {
  const { userRole } = useAuth();
  const { data: companySettings, isLoading } = useCompanySettings();
  const updateCompanySettings = useUpdateCompanySettings();
  const { toast } = useToast();

  const form = useForm<CompanySettingsForm>({
    resolver: zodResolver(companySettingsSchema),
    defaultValues: {
      company_name: "",
      address: "",
      postal_code: "",
      city: "",
      org_number: "",
      phone: "",
      email: "",
      website: "",
      business_hours: defaultBusinessHours,
    },
  });

  const { fields, update } = useFieldArray({
    control: form.control,
    name: "business_hours",
  });

  // Update form when data is loaded
  React.useEffect(() => {
    if (companySettings) {
      form.reset({
        company_name: companySettings.company_name || "",
        address: companySettings.address || "",
        postal_code: companySettings.postal_code || "",
        city: companySettings.city || "",
        org_number: companySettings.org_number || "",
        phone: companySettings.phone || "",
        email: companySettings.email || "",
        website: companySettings.website || "",
        business_hours: companySettings.business_hours || defaultBusinessHours,
      });
    }
  }, [companySettings, form]);

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
    console.log('Form submission data:', data);
    console.log('Business hours:', data.business_hours);
    
    // Check validation errors
    const validationResult = companySettingsSchema.safeParse(data);
    if (!validationResult.success) {
      console.log('Validation errors:', validationResult.error.format());
      return;
    }
    
    try {
      // Ensure company_name is always present and business_hours are properly typed
      const settingsData: CompanySettingsUpdate = {
        ...data,
        company_name: data.company_name || 'Mitt Företag AB',
        business_hours: data.business_hours as BusinessHours[]
      };
      console.log('Sending to server:', settingsData);
      await updateCompanySettings.mutateAsync(settingsData);
      toast({
        title: 'Inställningar sparade',
        description: 'Företagsinställningarna har uppdaterats.',
      });
    } catch (error) {
      console.error('Save error:', error);
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

        {/* Business Hours Section */}
        <Card>
          <CardHeader>
            <CardTitle>Öppettider</CardTitle>
            <CardDescription>
              Ställ in vilka dagar och tider företaget är öppet
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.day} className="flex items-center gap-4 p-4 border rounded-lg">
                <div className="w-20 font-medium">
                  {field.dayName}
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={field.isOpen}
                    onCheckedChange={(checked) => {
                      const updatedField = { ...field, isOpen: checked };
                      update(index, updatedField);
                      // Trigger form validation
                      form.trigger("business_hours");
                    }}
                  />
                  <Label className="text-sm">Öppet</Label>
                </div>

                {field.isOpen && (
                  <>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Från:</Label>
                      <Input
                        type="time"
                        value={field.openTime}
                        onChange={(e) => {
                          const updatedField = { ...field, openTime: e.target.value };
                          update(index, updatedField);
                          // Trigger form validation
                          form.trigger("business_hours");
                        }}
                        className="w-32"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Till:</Label>
                      <Input
                        type="time"
                        value={field.closeTime}
                        onChange={(e) => {
                          const updatedField = { ...field, closeTime: e.target.value };
                          update(index, updatedField);
                          // Trigger form validation
                          form.trigger("business_hours");
                        }}
                        className="w-32"
                      />
                    </div>
                  </>
                )}
                
                {/* Show validation errors for this day */}
                {form.formState.errors.business_hours?.[index] && (
                  <div className="text-sm text-destructive ml-auto">
                    {form.formState.errors.business_hours[index]?.closeTime?.message || 
                     form.formState.errors.business_hours[index]?.openTime?.message ||
                     'Felaktig tid'}
                  </div>
                )}
              </div>
            ))}

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  // Set standard business hours (Mon-Fri 8-17)
                  const standardHours = fields.map(field => ({
                    ...field,
                    isOpen: field.day >= 1 && field.day <= 5,
                    openTime: "08:00",
                    closeTime: "17:00"
                  }));
                  form.setValue("business_hours", standardHours);
                  form.trigger("business_hours");
                }}
              >
                Standardtider (Mån-Fre 8-17)
              </Button>
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