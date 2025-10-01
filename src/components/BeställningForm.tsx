import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
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
  varor: z.array(
    z.object({
      vara: z.string().min(1, 'Vara är obligatoriskt'),
      pris: z.string().min(1, 'Pris är obligatoriskt'),
    })
  ).min(1, 'Lägg till minst en vara'),
});

type BeställningFormData = z.infer<typeof beställningSchema>;

interface BeställningFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => Promise<{ success: boolean }>;
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
  const isMobile = useIsMobile();
  
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<BeställningFormData>({
    resolver: zodResolver(beställningSchema),
    defaultValues: {
      bedriftskunde_id: '',
      beskrivning: '',
      referanse: '',
      telefon: '',
      varor: [{ vara: '', pris: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'varor',
  });

  useEffect(() => {
    if (open) {
      if (initialData) {
        const varor = initialData.varor && Array.isArray(initialData.varor) && initialData.varor.length > 0
          ? initialData.varor.map((v: any) => ({
              vara: v.vara || '',
              pris: v.pris?.toString() || '',
            }))
          : [{ vara: '', pris: '' }];

        reset({
          bedriftskunde_id: initialData.bedriftskunde_id,
          beskrivning: initialData.beskrivning,
          referanse: initialData.referanse || '',
          telefon: initialData.telefon || '',
          varor,
        });
      } else {
        reset({
          bedriftskunde_id: '',
          beskrivning: '',
          referanse: '',
          telefon: '',
          varor: [{ vara: '', pris: '' }],
        });
      }
    }
  }, [open, initialData, reset]);

  const selectedBedriftskunde = watch('bedriftskunde_id');

  const handleFormSubmit = async (data: BeställningFormData) => {
    const submitData = {
      ...data,
      varor: data.varor.map(v => ({
        vara: v.vara,
        pris: parseFloat(v.pris),
      })),
    };
    const result = await onSubmit(submitData);
    if (result.success) {
      reset();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`sm:max-w-[600px] ${isMobile ? 'max-h-[70vh]' : 'max-h-[90vh]'} overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Redigera beställning' : 'Ny beställning'}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? 'Uppdatera beställningsinformation' : 'Skapa en beställning kopplad till en bedriftskunde'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 pb-6"  style={{ WebkitOverflowScrolling: 'touch' }}>
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

          <div className="grid grid-cols-2 gap-4">
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="beskrivning">Beskrivning *</Label>
            <Textarea
              id="beskrivning"
              {...register('beskrivning')}
              placeholder="Beskriv beställningen..."
              rows={3}
            />
            {errors.beskrivning && (
              <p className="text-sm text-destructive">
                {errors.beskrivning.message}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Varor *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ vara: '', pris: '' })}
              >
                <Plus className="h-4 w-4 mr-1" />
                Lägg till vara
              </Button>
            </div>

            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-[1fr_auto_auto] gap-2 items-start">
                <div className="space-y-1">
                  <Input
                    {...register(`varor.${index}.vara`)}
                    placeholder="Vara/tjänst"
                  />
                  {errors.varor?.[index]?.vara && (
                    <p className="text-xs text-destructive">
                      {errors.varor[index]?.vara?.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1 w-32">
                  <Input
                    {...register(`varor.${index}.pris`)}
                    placeholder="Pris (kr)"
                    type="number"
                    step="0.01"
                  />
                  {errors.varor?.[index]?.pris && (
                    <p className="text-xs text-destructive">
                      {errors.varor[index]?.pris?.message}
                    </p>
                  )}
                </div>
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    className="h-10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {errors.varor && typeof errors.varor.message === 'string' && (
              <p className="text-sm text-destructive">
                {errors.varor.message}
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
