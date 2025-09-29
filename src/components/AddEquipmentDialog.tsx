import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useEquipment, CreateEquipment } from '@/hooks/useEquipment';
import { Plus } from 'lucide-react';

export default function AddEquipmentDialog() {
  const { toast } = useToast();
  const { createEquipment } = useEquipment();
  
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<CreateEquipment>({
    name: '',
    type: 'refrigerator',
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.name.trim()) {
      toast({
        title: 'Fel',
        description: 'Namn på utrustning måste anges',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await createEquipment({
        ...form,
        name: form.name.trim(),
        description: form.description?.trim() || undefined,
      });
      
      toast({
        title: 'Sparad!',
        description: 'Ny utrustning har lagts till',
      });
      
      // Reset form and close dialog
      setForm({
        name: '',
        type: 'refrigerator',
        description: '',
      });
      setOpen(false);
    } catch (error) {
      toast({
        title: 'Fel',
        description: 'Kunde inte lägga till utrustning',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Lägg till utrustning
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Lägg till ny utrustning</DialogTitle>
          <DialogDescription>
            Lägg till en ny kyl eller frys för temperaturregistrering.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">Typ av utrustning</Label>
            <Select 
              value={form.type} 
              onValueChange={(value: 'refrigerator' | 'freezer') => 
                setForm(prev => ({ ...prev, type: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background">
                <SelectItem value="refrigerator">Kyl</SelectItem>
                <SelectItem value="freezer">Frys</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="name">Namn</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="t.ex. Kyl 4, Frys D"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Beskrivning (frivilligt)</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Beskriv utrustningens placering eller användning..."
              rows={3}
            />
          </div>
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Avbryt
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !form.name.trim()}
            >
              {isSubmitting ? 'Sparar...' : 'Lägg till'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}