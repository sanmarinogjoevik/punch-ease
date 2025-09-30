import { useEffect } from 'react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useBeställningar } from '@/hooks/useBeställningar';
import { Bedriftskunde } from '@/hooks/useBedriftskunder';

interface BeställningarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bedriftskunde: Bedriftskunde;
}

export function BeställningarDialog({
  open,
  onOpenChange,
  bedriftskunde,
}: BeställningarDialogProps) {
  const { companyBeställningar, isLoadingCompany, fetchBeställningarByBedriftskunde } = useBeställningar();

  useEffect(() => {
    if (open && bedriftskunde) {
      fetchBeställningarByBedriftskunde(bedriftskunde.id);
    }
  }, [open, bedriftskunde, fetchBeställningarByBedriftskunde]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Beställningar för {bedriftskunde.firmanamn}
          </DialogTitle>
          <DialogDescription>
            {isLoadingCompany
              ? 'Laddar beställningar...'
              : `${companyBeställningar.length} beställningar totalt`}
          </DialogDescription>
        </DialogHeader>

        {isLoadingCompany ? (
          <div className="text-center py-8 text-muted-foreground">
            Laddar beställningar...
          </div>
        ) : companyBeställningar.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Inga beställningar har gjorts från detta företag än
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Beskrivning</TableHead>
                <TableHead>Skapad av</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companyBeställningar.map((beställning) => (
                <TableRow key={beställning.id}>
                  <TableCell>
                    {format(new Date(beställning.created_at), 'PPP', {
                      locale: sv,
                    })}
                  </TableCell>
                  <TableCell className="max-w-md">
                    {beställning.beskrivning}
                  </TableCell>
                  <TableCell>
                    {beställning.profiles
                      ? `${beställning.profiles.first_name} ${beställning.profiles.last_name}`
                      : 'Okänd'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
