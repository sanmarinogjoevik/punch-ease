import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';
import { useEquipment, CreateEquipment } from '@/hooks/useEquipment';

export default function AddEquipmentDialog() {
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
      return;
    }

    try {
      setIsSubmitting(true);
      await createEquipment({
        name: form.name.trim(),
        type: form.type,
        description: form.description?.trim() || undefined,
      });
      
      // Reset form and close dialog
      setForm({
        name: '',
        type: 'refrigerator',
        description: '',
      });
      setOpen(false);
    } catch (error) {
      // Error is handled in the hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTypeLabel = (type: string) => {
    return type === 'refrigerator' ? 'Kyl' : 'Frys';
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Lägg till utrustning
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lägg till ny utrustning</DialogTitle>
          <DialogDescription>
            Lägg till en ny kyl eller frys som ska temperaturkontrolleras.
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
              placeholder="t.ex. Kyl 4 eller Frys D"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Beskrivning (frivilligt)</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Kort beskrivning av utrustningen..."
              rows={3}
            />
          </div>
          
          <div className="flex justify-end gap-2">
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
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}