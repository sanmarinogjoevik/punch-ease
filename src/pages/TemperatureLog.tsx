import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useTemperatureLogs, CreateTemperatureLog } from '@/hooks/useTemperatureLogs';
import { useEquipment } from '@/hooks/useEquipment';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Thermometer, Clock, FileText } from 'lucide-react';
import AddEquipmentDialog from '@/components/AddEquipmentDialog';

export default function TemperatureLog() {
  const { toast } = useToast();
  const { temperatureLogs, isLoading, createTemperatureLog, getTodaysLogs } = useTemperatureLogs();
  const { getEquipmentOptions, isLoading: equipmentLoading } = useEquipment();
  const { isAdmin } = useAuth();
  
  const [form, setForm] = useState<CreateTemperatureLog>({
    equipment_name: '',
    temperature: 0,
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.equipment_name) {
      toast({
        title: 'Fel',
        description: 'Välj utrustning',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await createTemperatureLog(form);
      
      toast({
        title: 'Sparad!',
        description: 'Temperaturmätning har registrerats',
      });
      
      // Reset form
      setForm({
        equipment_name: '',
        temperature: 0,
        notes: '',
      });
      
      // Refresh today's logs
      await getTodaysLogs();
    } catch (error) {
      toast({
        title: 'Fel',
        description: 'Kunde inte spara temperaturmätning',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Thermometer className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Temperaturlogg</h1>
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Registrera temperatur</CardTitle>
              <CardDescription>
                Logga temperatur för kylar och frysar
              </CardDescription>
            </div>
            {isAdmin && <AddEquipmentDialog />}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="equipment">Utrustning</Label>
                <Select 
                  value={form.equipment_name} 
                  onValueChange={(value) => setForm(prev => ({ ...prev, equipment_name: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Välj kyl eller frys" />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    {equipmentLoading ? (
                      <SelectItem value="loading" disabled>
                        Laddar utrustning...
                      </SelectItem>
                    ) : (
                      getEquipmentOptions().map((equipment) => (
                        <SelectItem key={equipment.value} value={equipment.value}>
                          {equipment.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="temperature">Temperatur (°C)</Label>
                <Input
                  id="temperature"
                  type="text"
                  inputMode="decimal"
                  value={form.temperature === 0 ? '' : form.temperature}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Allow empty string, numbers, and decimal point
                    if (value === '' || /^-?\d*\.?\d*$/.test(value)) {
                      setForm(prev => ({ ...prev, temperature: value === '' ? 0 : parseFloat(value) || 0 }));
                    }
                  }}
                  placeholder="t.ex. -18 eller 4.5"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notes">Anteckningar (frivilligt)</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Eventuella kommentarer..."
                rows={3}
              />
            </div>
            
            <Button 
              type="submit" 
              disabled={isSubmitting || !form.equipment_name || equipmentLoading}
              className="w-full md:w-auto"
            >
              {isSubmitting ? 'Sparar...' : 'Registrera temperatur'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Dagens registreringar
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Laddar temperaturloggar...
            </div>
          ) : temperatureLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Inga temperaturregistreringar idag än
            </div>
          ) : (
            <div className="space-y-4">
              {temperatureLogs.map((log) => (
                <div key={log.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{log.equipment_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(log.timestamp), 'd MMM', { locale: sv })}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Thermometer className="h-4 w-4 text-primary" />
                      <span className="font-mono text-lg">
                        {log.temperature}°C
                      </span>
                    </div>
                  </div>
                  
                  {log.notes && (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{log.notes}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}