import { useState, useMemo } from 'react';
import { ShoppingCart, Plus, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { BeställningCard } from '@/components/BeställningCard';
import { useBeställningar, Beställning } from '@/hooks/useBeställningar';
import { useBedriftskunder } from '@/hooks/useBedriftskunder';
import { useAuth } from '@/hooks/useAuth';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('alla');
  const [sortBy, setSortBy] = useState<'date' | 'pris'>('date');

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

  const canManage = userRole === 'admin';

  // Filter and sort beställningar
  const filteredAndSortedBeställningar = useMemo(() => {
    let filtered = beställningar;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (b) =>
          b.bedriftskunder?.firmanamn?.toLowerCase().includes(query) ||
          b.beskrivning?.toLowerCase().includes(query) ||
          b.referanse?.toLowerCase().includes(query) ||
          b.bedriftskunder?.orgnr?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== 'alla') {
      filtered = filtered.filter((b) => b.status === statusFilter);
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else if (sortBy === 'pris') {
        const aPris = a.varor?.reduce((sum, v) => sum + (v.pris || 0), 0) || 0;
        const bPris = b.varor?.reduce((sum, v) => sum + (v.pris || 0), 0) || 0;
        return bPris - aPris;
      }
      return 0;
    });

    return sorted;
  }, [beställningar, searchQuery, statusFilter, sortBy]);

  // Calculate total price
  const totalPris = useMemo(() => {
    return filteredAndSortedBeställningar.reduce((sum, b) => {
      const beställningTotal = b.varor?.reduce((s, v) => s + (v.pris || 0), 0) || 0;
      return sum + beställningTotal;
    }, 0);
  }, [filteredAndSortedBeställningar]);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
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

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Filter och sök</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Sök efter företag, beskrivning, referanse..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filtrera status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alla">Alla status</SelectItem>
                  <SelectItem value="ej_påbörjad">Ej påbörjad</SelectItem>
                  <SelectItem value="pågående">Pågående</SelectItem>
                  <SelectItem value="klar">Klar</SelectItem>
                  <SelectItem value="levererad">Levererad</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'date' | 'pris')}>
                <SelectTrigger>
                  <SelectValue placeholder="Sortera efter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Senaste först</SelectItem>
                  <SelectItem value="pris">Högsta pris först</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Totalt antal</CardDescription>
            <CardTitle className="text-3xl">{filteredAndSortedBeställningar.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Totalt värde</CardDescription>
            <CardTitle className="text-3xl">{totalPris.toLocaleString('sv-SE')} kr</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Genomsnittligt pris</CardDescription>
            <CardTitle className="text-3xl">
              {filteredAndSortedBeställningar.length > 0
                ? (totalPris / filteredAndSortedBeställningar.length).toLocaleString('sv-SE', {
                    maximumFractionDigits: 0,
                  })
                : 0}{' '}
              kr
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Beställningar Grid */}
      <Card>
        <CardHeader>
          <CardTitle>
            {userRole === 'admin' ? 'Alla beställningar' : 'Mina beställningar'}
          </CardTitle>
          <CardDescription>
            {filteredAndSortedBeställningar.length} av {beställningar.length} beställningar
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Laddar...
            </div>
          ) : filteredAndSortedBeställningar.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery || statusFilter !== 'alla'
                ? 'Inga beställningar matchade din sökning'
                : 'Inga beställningar än'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAndSortedBeställningar.map((beställning) => (
                <BeställningCard
                  key={beställning.id}
                  beställning={beställning}
                  onEdit={canManage ? handleEdit : undefined}
                  onDelete={canManage ? handleDeleteClick : undefined}
                  showActions={canManage}
                />
              ))}
            </div>
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
