import { useState } from 'react';
import { ShoppingCart, Plus, Trash2, Pencil } from 'lucide-react';
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
import { BeställningForm } from '@/components/BeställningForm';
import { useBeställningar, Beställning } from '@/hooks/useBeställningar';
import { useBedriftskunder } from '@/hooks/useBedriftskunder';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

export default function Beställningar() {
  const { userRole } = useAuth();
  const { beställningar, isLoading, createBeställning, updateBeställning, deleteBeställning } =
    useBeställningar();
  const { bedriftskunder } = useBedriftskunder();

  const [formOpen, setFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBeställning, setSelectedBeställning] =
    useState<Beställning | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const handleCreate = () => {
    setIsEditing(false);
    setSelectedBeställning(null);
    setFormOpen(true);
  };

  const handleEdit = (beställning: Beställning) => {
    setIsEditing(true);
    setSelectedBeställning(beställning);
    setFormOpen(true);
  };

  const handleFormSubmit = async (data: any) => {
    if (isEditing && selectedBeställning) {
      return await updateBeställning(selectedBeställning.id, data);
    } else {
      return await createBeställning(data);
    }
  };

  const handleDeleteClick = (beställning: Beställning) => {
    setSelectedBeställning(beställning);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (selectedBeställning) {
      await deleteBeställning(selectedBeställning.id);
      setDeleteDialogOpen(false);
      setSelectedBeställning(null);
    }
  };

  const canDelete = (beställning: Beställning) => {
    return userRole === 'admin';
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-8 w-8" />
            Beställningar
          </h1>
          <p className="text-muted-foreground mt-2">
            {userRole === 'admin'
              ? 'Visa alla beställningar'
              : 'Skapa och visa dina beställningar'}
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Ny beställning
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {userRole === 'admin' ? 'Alla beställningar' : 'Mina beställningar'}
          </CardTitle>
          <CardDescription>
            {beställningar.length} beställningar
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Laddar...
            </div>
          ) : beställningar.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Inga beställningar än
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bedriftskunde</TableHead>
                  <TableHead>Beskrivning</TableHead>
                  <TableHead>Referanse</TableHead>
                  <TableHead>Telefon</TableHead>
                  {userRole === 'admin' && <TableHead>Skapad av</TableHead>}
                  <TableHead>Datum</TableHead>
                  {userRole === 'admin' && (
                    <TableHead className="text-right">Åtgärder</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {beställningar.map((beställning) => (
                  <TableRow key={beställning.id}>
                    <TableCell className="font-medium">
                      {beställning.bedriftskunder?.firmanamn || '-'}
                      <div className="text-xs text-muted-foreground">
                        {beställning.bedriftskunder?.orgnr || ''}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <div className="truncate">{beställning.beskrivning}</div>
                    </TableCell>
                    <TableCell>
                      {beställning.referanse || '-'}
                    </TableCell>
                    <TableCell>
                      {beställning.telefon || '-'}
                    </TableCell>
                    {userRole === 'admin' && (
                      <TableCell>
                        {beställning.profiles?.first_name}{' '}
                        {beställning.profiles?.last_name}
                      </TableCell>
                    )}
                    <TableCell>
                      {format(
                        new Date(beställning.created_at),
                        'PPP',
                        { locale: sv }
                      )}
                    </TableCell>
                    {userRole === 'admin' && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(beställning)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {canDelete(beställning) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(beställning)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <BeställningForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleFormSubmit}
        bedriftskunder={bedriftskunder}
        initialData={isEditing ? selectedBeställning || undefined : undefined}
        isEdit={isEditing}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bekräfta borttagning</AlertDialogTitle>
            <AlertDialogDescription>
              Är du säker på att du vill ta bort denna beställning?
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
