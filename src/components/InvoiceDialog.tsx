import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import html2pdf from "html2pdf.js";
import { useRef } from "react";

interface Vara {
  vara: string;
  pris: number;
}

interface InvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  beställning: {
    id: string;
    beskrivning: string;
    referanse?: string;
    telefon?: string;
    created_at: string;
    varor?: Vara[];
    bedriftskunder?: {
      firmanamn: string;
      orgnr: string;
      adress?: string;
      postnummer?: string;
      stad?: string;
      telefon?: string;
      epost?: string;
    };
    profiles?: {
      first_name?: string;
      last_name?: string;
      email?: string;
    };
  } | null;
}

export function InvoiceDialog({ open, onOpenChange, beställning }: InvoiceDialogProps) {
  const { data: companySettings } = useCompanySettings();
  const invoiceRef = useRef<HTMLDivElement>(null);

  if (!beställning) return null;

  const varor = (beställning.varor || []) as Vara[];
  const subtotal = varor.reduce((sum, vara) => sum + vara.pris, 0);
  const moms = subtotal * 0.25;
  const total = subtotal + moms;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!invoiceRef.current) return;

    const opt = {
      margin: 10,
      filename: `faktura_${beställning.referanse || beställning.id}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
    };

    html2pdf().set(opt).from(invoiceRef.current).save();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="print:hidden">
          <DialogTitle>Faktura - {beställning.referanse || `#${beställning.id.slice(0, 8)}`}</DialogTitle>
          <div className="flex gap-2 mt-4">
            <Button onClick={handlePrint} variant="outline" size="sm">
              <Printer className="mr-2 h-4 w-4" />
              Skriv ut
            </Button>
            <Button onClick={handleDownloadPDF} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Ladda ner PDF
            </Button>
          </div>
        </DialogHeader>

        <div ref={invoiceRef} className="bg-background p-8 print:p-0">
          {/* Header */}
          <div className="flex justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">FAKTURA</h1>
              <p className="text-muted-foreground">
                Fakturanummer: {beställning.referanse || `#${beställning.id.slice(0, 8)}`}
              </p>
              <p className="text-muted-foreground">
                Datum: {format(new Date(beställning.created_at), "d MMMM yyyy", { locale: sv })}
              </p>
            </div>
            <div className="text-right">
              {companySettings && (
                <>
                  <h2 className="text-xl font-semibold">{companySettings.company_name}</h2>
                  {companySettings.address && <p>{companySettings.address}</p>}
                  {(companySettings.postal_code || companySettings.city) && (
                    <p>{companySettings.postal_code} {companySettings.city}</p>
                  )}
                  {companySettings.org_number && <p>Org.nr: {companySettings.org_number}</p>}
                  {companySettings.phone && <p>Tel: {companySettings.phone}</p>}
                  {companySettings.email && <p>E-post: {companySettings.email}</p>}
                </>
              )}
            </div>
          </div>

          {/* Customer info */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-2">Faktureras till:</h3>
            <div className="bg-muted/30 p-4 rounded-lg">
              {beställning.bedriftskunder && (
                <>
                  <p className="font-semibold">{beställning.bedriftskunder.firmanamn}</p>
                  <p>Org.nr: {beställning.bedriftskunder.orgnr}</p>
                  {beställning.bedriftskunder.adress && <p>{beställning.bedriftskunder.adress}</p>}
                  {(beställning.bedriftskunder.postnummer || beställning.bedriftskunder.stad) && (
                    <p>{beställning.bedriftskunder.postnummer} {beställning.bedriftskunder.stad}</p>
                  )}
                  {beställning.bedriftskunder.telefon && <p>Tel: {beställning.bedriftskunder.telefon}</p>}
                  {beställning.bedriftskunder.epost && <p>E-post: {beställning.bedriftskunder.epost}</p>}
                </>
              )}
            </div>
            {beställning.profiles && (
              <div className="mt-2">
                <p className="text-sm text-muted-foreground">
                  Kontaktperson: {beställning.profiles.first_name} {beställning.profiles.last_name}
                  {beställning.telefon && ` | Tel: ${beställning.telefon}`}
                </p>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Beskrivning:</h3>
            <p className="text-muted-foreground">{beställning.beskrivning}</p>
          </div>

          {/* Items table */}
          <div className="mb-8">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-border">
                  <th className="text-left py-3 px-2">Produkt/Tjänst</th>
                  <th className="text-right py-3 px-2 w-32">Pris</th>
                </tr>
              </thead>
              <tbody>
                {varor.length > 0 ? (
                  varor.map((vara, index) => (
                    <tr key={index} className="border-b border-border">
                      <td className="py-3 px-2">{vara.vara}</td>
                      <td className="text-right py-3 px-2 font-semibold">
                        {vara.pris.toLocaleString('sv-SE')} kr
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="py-4 text-center text-muted-foreground">
                      Inga varor specificerade
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end mb-8">
            <div className="w-80">
              <div className="flex justify-between py-2 border-b border-border">
                <span>Subtotal:</span>
                <span>{subtotal.toLocaleString('sv-SE')} kr</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span>Moms (25%):</span>
                <span>{moms.toLocaleString('sv-SE')} kr</span>
              </div>
              <div className="flex justify-between py-3 text-xl font-bold">
                <span>Totalt:</span>
                <span>{total.toLocaleString('sv-SE')} kr</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-sm text-muted-foreground pt-8 border-t border-border">
            <p>Tack för er beställning!</p>
            {companySettings?.website && <p>{companySettings.website}</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
