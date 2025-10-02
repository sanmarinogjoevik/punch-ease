import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { ArrowLeft, FileText, Package } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Beställning, fetchBeställningarByBedriftskunde } from '@/hooks/useBeställningar';
import { Bedriftskunde } from '@/hooks/useBedriftskunder';
import { InvoiceDialog } from '@/components/InvoiceDialog';

interface CompanyOrdersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bedriftskunde: Bedriftskunde | null;
  onEdit?: (beställning: Beställning) => void;
  onDelete?: (beställning: Beställning) => void;
}

export function CompanyOrdersDialog({
  open,
  onOpenChange,
  bedriftskunde,
}: CompanyOrdersDialogProps) {
  const [companyBeställningar, setCompanyBeställningar] = useState<Beställning[]>([]);
  const [isLoadingCompany, setIsLoadingCompany] = useState(false);
  const [selectedBeställning, setSelectedBeställning] = useState<Beställning | null>(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);

  const handleViewInvoice = (beställning: Beställning) => {
    setSelectedBeställning(beställning);
    setInvoiceDialogOpen(true);
  };

  useEffect(() => {
    if (open && bedriftskunde?.id) {
      setIsLoadingCompany(true);
      fetchBeställningarByBedriftskunde(bedriftskunde.id)
        .then(setCompanyBeställningar)
        .finally(() => setIsLoadingCompany(false));
    }
  }, [open, bedriftskunde?.id]);

  if (!bedriftskunde) return null;

  return (
    <>
      <InvoiceDialog 
        open={invoiceDialogOpen}
        onOpenChange={setInvoiceDialogOpen}
        beställning={selectedBeställning!}
      />
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 p-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <DialogTitle className="text-2xl">
                {bedriftskunde.firmanamn}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Org.nr: {bedriftskunde.orgnr}
              </p>
            </div>
          </div>
        </DialogHeader>

        {isLoadingCompany ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : companyBeställningar.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Inga beställningar för detta företag</p>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Referens</TableHead>
                  <TableHead>Beskrivning</TableHead>
                  <TableHead className="text-right">Totalt pris</TableHead>
                  <TableHead className="text-right">Åtgärd</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companyBeställningar.map((beställning) => {
                  const varor = (beställning.varor || []) as { vara: string; pris: number }[];
                  const totalPris = varor.reduce((sum, vara) => sum + vara.pris, 0);
                  const totalMedMoms = totalPris * 1.25;
                  
                  return (
                    <TableRow key={beställning.id}>
                      <TableCell>
                        {format(new Date(beställning.created_at), "d MMM yyyy", { locale: sv })}
                      </TableCell>
                      <TableCell>
                        {beställning.referanse || `#${beställning.id.slice(0, 8)}`}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {beställning.beskrivning}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {totalMedMoms.toLocaleString('sv-SE')} kr
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          onClick={() => handleViewInvoice(beställning)}
                          variant="ghost"
                          size="sm"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Visa faktura
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        </DialogContent>
      </Dialog>
    </>
  );
}
