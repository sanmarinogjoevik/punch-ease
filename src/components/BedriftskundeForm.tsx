import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Bedriftskunde } from '@/hooks/useBedriftskunder';

const bedriftskundeSchema = z.object({
  firmanamn: z.string().min(1, 'Firmanamn är obligatoriskt'),
  orgnr: z.string().min(6, 'Organisationsnummer är obligatoriskt'),
  adress: z.string().min(1, 'Adress är obligatoriskt'),
  postnummer: z.string().optional(),
  stad: z.string().optional(),
  postboks: z.string().optional(),
  telefon: z.string().optional(),
  epost: z.string().email('Ogiltig e-postadress').optional().or(z.literal('')),
});

type BedriftskundeFormData = z.infer<typeof bedriftskundeSchema>;

interface BedriftskundeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: BedriftskundeFormData) => Promise<{ success: boolean }>;
  initialData?: Bedriftskunde;
  isEdit?: boolean;
}

export function BedriftskundeForm({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  isEdit = false,
}: BedriftskundeFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BedriftskundeFormData>({
    resolver: zodResolver(bedriftskundeSchema),
    defaultValues: initialData || {
      firmanamn: '',
      orgnr: '',
      adress: '',
      postnummer: '',
      stad: '',
      postboks: '',
      telefon: '',
      epost: '',
    },
  });

  useEffect(() => {
    if (open) {
      reset(initialData || {
        firmanamn: '',
        orgnr: '',
        adress: '',
        postnummer: '',
        stad: '',
        postboks: '',
        telefon: '',
        epost: '',
      });
    }
  }, [open, initialData, reset]);

  const handleFormSubmit = async (data: BedriftskundeFormData) => {
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
            {isEdit ? 'Redigera bedriftskunde' : 'Ny bedriftskunde'}
          </DialogTitle>
          <DialogDescription>
            Fyll i företagets information
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="firmanamn">Firmanamn *</Label>
            <Input
              id="firmanamn"
              {...register('firmanamn')}
              placeholder="Ex: Företag AB"
            />
            {errors.firmanamn && (
              <p className="text-sm text-destructive">{errors.firmanamn.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="orgnr">Organisationsnummer *</Label>
            <Input
              id="orgnr"
              {...register('orgnr')}
              placeholder="Ex: 556677-8899"
            />
            {errors.orgnr && (
              <p className="text-sm text-destructive">{errors.orgnr.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="adress">Adress *</Label>
            <Input
              id="adress"
              {...register('adress')}
              placeholder="Ex: Storgatan 1"
            />
            {errors.adress && (
              <p className="text-sm text-destructive">{errors.adress.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="postnummer">Postnummer</Label>
              <Input
                id="postnummer"
                {...register('postnummer')}
                placeholder="Ex: 123 45"
              />
              {errors.postnummer && (
                <p className="text-sm text-destructive">{errors.postnummer.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="stad">Stad</Label>
              <Input
                id="stad"
                {...register('stad')}
                placeholder="Ex: Stockholm"
              />
              {errors.stad && (
                <p className="text-sm text-destructive">{errors.stad.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="postboks">Postboks</Label>
            <Input
              id="postboks"
              {...register('postboks')}
              placeholder="Ex: Postboks 123"
            />
            {errors.postboks && (
              <p className="text-sm text-destructive">{errors.postboks.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefon">Telefon</Label>
            <Input
              id="telefon"
              {...register('telefon')}
              placeholder="Ex: 08-123 45 67"
            />
            {errors.telefon && (
              <p className="text-sm text-destructive">{errors.telefon.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="epost">E-post</Label>
            <Input
              id="epost"
              type="email"
              {...register('epost')}
              placeholder="Ex: info@företag.se"
            />
            {errors.epost && (
              <p className="text-sm text-destructive">{errors.epost.message}</p>
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
              {isSubmitting ? 'Sparar...' : isEdit ? 'Uppdatera' : 'Skapa'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
