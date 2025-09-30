import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Bedriftskunde } from '@/hooks/useBedriftskunder';
import { Beställning } from '@/hooks/useBeställningar';

const beställningSchema = z.object({
  bedriftskunde_id: z.string().min(1, 'Välj en bedriftskunde'),
  beskrivning: z.string().min(1, 'Beskrivning är obligatoriskt'),
  referanse: z.string().optional(),
  telefon: z.string().optional(),
});

type BeställningFormData = z.infer<typeof beställningSchema>;

interface BeställningFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: BeställningFormData) => Promise<{ success: boolean }>;
  bedriftskunder: Bedriftskunde[];
  initialData?: Beställning;
  isEdit?: boolean;
}

export function BeställningForm({
  open,
  onOpenChange,
  onSubmit,
  bedriftskunder,
  initialData,
  isEdit = false,
}: BeställningFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BeställningFormData>({
    resolver: zodResolver(beställningSchema),
    defaultValues: initialData ? {
      bedriftskunde_id: initialData.bedriftskunde_id,
      beskrivning: initialData.beskrivning,
      referanse: initialData.referanse || '',
      telefon: initialData.telefon || '',
    } : {
      bedriftskunde_id: '',
      beskrivning: '',
      referanse: '',
      telefon: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (initialData) {
        reset({
          bedriftskunde_id: initialData.bedriftskunde_id,
          beskrivning: initialData.beskrivning,
          referanse: initialData.referanse || '',
          telefon: initialData.telefon || '',
        });
      } else {
        reset({
          bedriftskunde_id: '',
          beskrivning: '',
          referanse: '',
          telefon: '',
        });
      }
    }
  }, [open, initialData, reset]);

  const selectedBedriftskunde = watch('bedriftskunde_id');

  const handleFormSubmit = async (data: BeställningFormData) => {
    const result = await onSubmit(data);
    if (result.success) {
      reset();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Redigera beställning' : 'Ny beställning'}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? 'Uppdatera beställningsinformation' : 'Skapa en beställning kopplad till en bedriftskunde'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bedriftskunde">Bedriftskunde *</Label>
            <Select
              value={selectedBedriftskunde}
              onValueChange={(value) => setValue('bedriftskunde_id', value)}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Välj bedriftskunde" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {bedriftskunder.map((kund) => (
                  <SelectItem key={kund.id} value={kund.id}>
                    {kund.firmanamn} ({kund.orgnr})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.bedriftskunde_id && (
              <p className="text-sm text-destructive">
                {errors.bedriftskunde_id.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="referanse">Referanse</Label>
            <Input
              id="referanse"
              {...register('referanse')}
              placeholder="Ex: Anna Svensson"
            />
            {errors.referanse && (
              <p className="text-sm text-destructive">
                {errors.referanse.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefon">Telefonnummer</Label>
            <Input
              id="telefon"
              {...register('telefon')}
              placeholder="Ex: 070-123 45 67"
            />
            {errors.telefon && (
              <p className="text-sm text-destructive">
                {errors.telefon.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="beskrivning">Beskrivning *</Label>
            <Textarea
              id="beskrivning"
              {...register('beskrivning')}
              placeholder="Beskriv beställningen..."
              rows={5}
            />
            {errors.beskrivning && (
              <p className="text-sm text-destructive">
                {errors.beskrivning.message}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Avbryt
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Sparar...' : isEdit ? 'Uppdatera' : 'Skapa beställning'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
