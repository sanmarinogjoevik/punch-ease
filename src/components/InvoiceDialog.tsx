import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, Edit, Save, X, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import html2pdf from "html2pdf.js";
import { useRef, useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useBeställningar } from "@/hooks/useBeställningar";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

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

const formSchema = z.object({
  beskrivning: z.string().min(1, "Beskrivning krävs").max(1000),
  referanse: z.string().max(100).optional(),
  telefon: z.string().max(20).optional(),
  varor: z.array(z.object({
    vara: z.string().min(1, "Varunamn krävs").max(200),
    pris: z.number().min(0, "Pris måste vara positivt")
  }))
});

type FormValues = z.infer<typeof formSchema>;

export function InvoiceDialog({ open, onOpenChange, beställning }: InvoiceDialogProps) {
  const { data: companySettings } = useCompanySettings();
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const { updateBeställning } = useBeställningar();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      beskrivning: beställning?.beskrivning || "",
      referanse: beställning?.referanse || "",
      telefon: beställning?.telefon || "",
      varor: (beställning?.varor || []) as Vara[]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "varor"
  });

  // Reset form when beställning changes
  useEffect(() => {
    if (beställning) {
      form.reset({
        beskrivning: beställning.beskrivning || "",
        referanse: beställning.referanse || "",
        telefon: beställning.telefon || "",
        varor: (beställning.varor || []) as Vara[]
      });
    }
  }, [beställning, form]);

  if (!beställning) return null;

  const varor = isEditing ? fields.map(f => ({ vara: f.vara, pris: f.pris })) : ((beställning.varor || []) as Vara[]);
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

  const handleSave = async (data: FormValues) => {
    try {
      await updateBeställning(beställning.id, {
        beskrivning: data.beskrivning,
        referanse: data.referanse || null,
        telefon: data.telefon || null,
        varor: data.varor as any
      });
      
      toast({
        title: "Faktura uppdaterad",
        description: "Ändringarna har sparats."
      });
      
      setIsEditing(false);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Fel",
        description: "Kunde inte spara ändringar. Försök igen.",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="print:hidden">
          <DialogTitle>Faktura - {beställning.referanse || `#${beställning.id.slice(0, 8)}`}</DialogTitle>
          <div className="flex gap-2 mt-4">
            {!isEditing ? (
              <>
                <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
                  <Edit className="mr-2 h-4 w-4" />
                  Redigera
                </Button>
                <Button onClick={handlePrint} variant="outline" size="sm">
                  <Printer className="mr-2 h-4 w-4" />
                  Skriv ut
                </Button>
                <Button onClick={handleDownloadPDF} variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Ladda ner PDF
                </Button>
              </>
            ) : (
              <>
                <Button onClick={form.handleSubmit(handleSave)} size="sm">
                  <Save className="mr-2 h-4 w-4" />
                  Spara
                </Button>
                <Button onClick={() => {
                  setIsEditing(false);
                  form.reset();
                }} variant="outline" size="sm">
                  <X className="mr-2 h-4 w-4" />
                  Avbryt
                </Button>
              </>
            )}
          </div>
        </DialogHeader>

        <Form {...form}>
          <div ref={invoiceRef} className="bg-background p-8 print:p-0">
            {/* Header */}
            <div className="flex justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold mb-2">FAKTURA</h1>
                {isEditing ? (
                  <FormField
                    control={form.control}
                    name="referanse"
                    render={({ field }) => (
                      <FormItem className="mb-2">
                        <FormLabel className="text-sm">Referensnummer</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Referensnummer" className="max-w-xs" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <p className="text-muted-foreground">
                    Fakturanummer: {beställning.referanse || `#${beställning.id.slice(0, 8)}`}
                  </p>
                )}
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
                    {isEditing ? (
                      <FormField
                        control={form.control}
                        name="telefon"
                        render={({ field }) => (
                          <FormItem className="inline-block ml-2">
                            <FormControl>
                              <Input {...field} placeholder="Telefon" className="max-w-xs inline-block" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      beställning.telefon && ` | Tel: ${beställning.telefon}`
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Beskrivning:</h3>
              {isEditing ? (
                <FormField
                  control={form.control}
                  name="beskrivning"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea {...field} placeholder="Beskrivning av beställning" rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <p className="text-muted-foreground">{beställning.beskrivning}</p>
              )}
            </div>

            {/* Items table */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold">Varor:</h3>
                {isEditing && (
                  <Button
                    type="button"
                    onClick={() => append({ vara: "", pris: 0 })}
                    size="sm"
                    variant="outline"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Lägg till vara
                  </Button>
                )}
              </div>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-border">
                    <th className="text-left py-3 px-2">Produkt/Tjänst</th>
                    <th className="text-right py-3 px-2 w-32">Pris</th>
                    {isEditing && <th className="w-16"></th>}
                  </tr>
                </thead>
                <tbody>
                  {fields.length > 0 ? (
                    fields.map((field, index) => (
                      <tr key={field.id} className="border-b border-border">
                        <td className="py-3 px-2">
                          {isEditing ? (
                            <FormField
                              control={form.control}
                              name={`varor.${index}.vara`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input {...field} placeholder="Varunamn" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          ) : (
                            field.vara
                          )}
                        </td>
                        <td className="text-right py-3 px-2">
                          {isEditing ? (
                            <FormField
                              control={form.control}
                              name={`varor.${index}.pris`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      type="number"
                                      placeholder="Pris"
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          ) : (
                            <span className="font-semibold">{field.pris.toLocaleString('sv-SE')} kr</span>
                          )}
                        </td>
                        {isEditing && (
                          <td className="py-3 px-2">
                            <Button
                              type="button"
                              onClick={() => remove(index)}
                              size="sm"
                              variant="ghost"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={isEditing ? 3 : 2} className="py-4 text-center text-muted-foreground">
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
        </Form>
      </DialogContent>
    </Dialog>
  );
}
