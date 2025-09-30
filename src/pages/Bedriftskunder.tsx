import { useState } from 'react';
import { Building2, Plus, Pencil, Trash2, Eye, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { BedriftskundeForm } from '@/components/BedriftskundeForm';
import { BeställningarDialog } from '@/components/BeställningarDialog';
import { useBedriftskunder, Bedriftskunde } from '@/hooks/useBedriftskunder';
import { useAuth } from '@/hooks/useAuth';

export default function Bedriftskunder() {
  const { userRole } = useAuth();
  const {
    bedriftskunder,
    isLoading,
    createBedriftskunde,
    updateBedriftskunde,
    deleteBedriftskunde,
  } = useBedriftskunder();

  const [formOpen, setFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedKund, setSelectedKund] = useState<Bedriftskunde | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [beställningarDialogOpen, setBeställningarDialogOpen] = useState(false);

  if (userRole !== 'admin') {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Åtkomst nekad</CardTitle>
            <CardDescription>
              Du har inte behörighet att visa denna sida.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleCreate = () => {
    setSelectedKund(null);
    setFormOpen(true);
  };

  const handleEdit = (kund: Bedriftskunde) => {
    setSelectedKund(kund);
    setFormOpen(true);
  };

  const handleView = (kund: Bedriftskunde) => {
    setSelectedKund(kund);
    setViewDialogOpen(true);
  };

  const handleViewBeställningar = (kund: Bedriftskunde) => {
    setSelectedKund(kund);
    setBeställningarDialogOpen(true);
  };

  const handleDeleteClick = (kund: Bedriftskunde) => {
    setSelectedKund(kund);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (selectedKund) {
      await deleteBedriftskunde(selectedKund.id);
      setDeleteDialogOpen(false);
      setSelectedKund(null);
    }
  };

  const handleSubmit = async (data: any) => {
    if (selectedKund) {
      return await updateBedriftskunde(selectedKund.id, data);
    } else {
      return await createBedriftskunde(data);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            Bedriftskunder
          </h1>
          <p className="text-muted-foreground mt-2">
            Hantera företagskunder som vill ha faktura
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Ny bedriftskunde
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alla bedriftskunder</CardTitle>
          <CardDescription>
            {bedriftskunder.length} bedriftskunder registrerade
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Laddar...
            </div>
          ) : bedriftskunder.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Inga bedriftskunder registrerade än
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Firmanamn</TableHead>
                  <TableHead>Org.nr</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>E-post</TableHead>
                  <TableHead className="text-right">Åtgärder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bedriftskunder.map((kund) => (
                  <TableRow key={kund.id}>
                    <TableCell className="font-medium">
                      {kund.firmanamn}
                    </TableCell>
                    <TableCell>{kund.orgnr}</TableCell>
                    <TableCell>{kund.telefon || '-'}</TableCell>
                    <TableCell>{kund.epost || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewBeställningar(kund)}
                          title="Visa beställningar"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(kund)}
                          title="Visa detaljer"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(kund)}
                          title="Redigera"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(kund)}
                          title="Ta bort"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <BedriftskundeForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleSubmit}
        initialData={selectedKund || undefined}
        isEdit={!!selectedKund}
      />

      <AlertDialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Företagsinformation</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {selectedKund && (
                  <>
                    <div>
                      <strong>Firmanamn:</strong> {selectedKund.firmanamn}
                    </div>
                    <div>
                      <strong>Organisationsnummer:</strong> {selectedKund.orgnr}
                    </div>
                    <div>
                      <strong>Adress:</strong> {selectedKund.adress}
                    </div>
                    <div>
                      <strong>Telefon:</strong> {selectedKund.telefon || '-'}
                    </div>
                    <div>
                      <strong>E-post:</strong> {selectedKund.epost || '-'}
                    </div>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stäng</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedKund && (
        <BeställningarDialog
          open={beställningarDialogOpen}
          onOpenChange={setBeställningarDialogOpen}
          bedriftskunde={selectedKund}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bekräfta borttagning</AlertDialogTitle>
            <AlertDialogDescription>
              Är du säker på att du vill ta bort {selectedKund?.firmanamn}?
              Alla beställningar kopplade till detta företag kommer också att tas bort.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
