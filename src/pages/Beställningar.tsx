import { useState, useMemo } from 'react';
import { ShoppingCart, Plus, Search, Building2, Package } from 'lucide-react';
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
import { CompanyOrdersDialog } from '@/components/CompanyOrdersDialog';
import { useBeställningar, Beställning } from '@/hooks/useBeställningar';
import { useBedriftskunder, Bedriftskunde } from '@/hooks/useBedriftskunder';
import { useAuth } from '@/hooks/useAuth';

export default function Beställningar() {
  const { userRole } = useAuth();
  const { beställningar, isLoading, createBeställning, updateBeställning, deleteBeställning } =
    useBeställningar();
  const { bedriftskunder, isLoading: isLoadingCompanies } = useBedriftskunder();

  const [formOpen, setFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBeställning, setSelectedBeställning] =
    useState<Beställning | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<Bedriftskunde | null>(null);
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);

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

  const handleViewCompanyOrders = (bedriftskunde: Bedriftskunde) => {
    setSelectedCompany(bedriftskunde);
    setCompanyDialogOpen(true);
  };

  const handleDeleteClick = (beställning: Beställning) => {
    setSelectedBeställning(beställning);
    setDeleteDialogOpen(true);
    setCompanyDialogOpen(false);
  };

  const handleDelete = async () => {
    if (selectedBeställning) {
      await deleteBeställning(selectedBeställning.id);
      setDeleteDialogOpen(false);
      setSelectedBeställning(null);
    }
  };

  const canManage = userRole === 'admin';

  // Calculate order counts per company
  const companiesWithOrderCounts = useMemo(() => {
    return bedriftskunder.map((company) => {
      const orderCount = beställningar.filter(
        (b) => b.bedriftskunde_id === company.id
      ).length;
      
      const totalValue = beställningar
        .filter((b) => b.bedriftskunde_id === company.id)
        .reduce((sum, b) => {
          const beställningTotal = b.varor?.reduce((s, v) => s + (v.pris || 0), 0) || 0;
          return sum + beställningTotal;
        }, 0);

      return {
        ...company,
        orderCount,
        totalValue,
      };
    });
  }, [bedriftskunder, beställningar]);

  // Filter companies by search
  const filteredCompanies = useMemo(() => {
    if (!searchQuery) return companiesWithOrderCounts;

    const query = searchQuery.toLowerCase();
    return companiesWithOrderCounts.filter(
      (c) =>
        c.firmanamn?.toLowerCase().includes(query) ||
        c.orgnr?.toLowerCase().includes(query) ||
        c.telefon?.toLowerCase().includes(query) ||
        c.epost?.toLowerCase().includes(query)
    );
  }, [companiesWithOrderCounts, searchQuery]);

  // Calculate statistics
  const totalOrders = beställningar.length;
  const totalCompanies = bedriftskunder.length;
  const totalValue = useMemo(() => {
    return beställningar.reduce((sum, b) => {
      const beställningTotal = b.varor?.reduce((s, v) => s + (v.pris || 0), 0) || 0;
      return sum + beställningTotal;
    }, 0);
  }, [beställningar]);

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
              ? 'Välj ett företag för att se deras beställningar'
              : 'Skapa och visa dina beställningar'}
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Ny beställning
        </Button>
      </div>

      {/* Statistics Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Totalt antal företag</CardDescription>
            <CardTitle className="text-3xl">{totalCompanies}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Totalt antal beställningar</CardDescription>
            <CardTitle className="text-3xl">{totalOrders}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Totalt värde</CardDescription>
            <CardTitle className="text-3xl">{totalValue.toLocaleString('sv-SE')} kr</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Companies Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Företag
          </CardTitle>
          <CardDescription>
            Klicka på ett företag för att se deras beställningar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Sök efter företagsnamn, org.nr, telefon, e-post..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {isLoadingCompanies ? (
            <div className="text-center py-12 text-muted-foreground">
              Laddar företag...
            </div>
          ) : filteredCompanies.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery
                ? 'Inga företag matchade din sökning'
                : 'Inga företag registrerade än'}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Firmanamn</TableHead>
                    <TableHead>Org.nr</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>E-post</TableHead>
                    <TableHead className="text-right">Beställningar</TableHead>
                    <TableHead className="text-right">Totalt värde</TableHead>
                    <TableHead className="text-right">Åtgärder</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompanies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell className="font-medium">{company.firmanamn}</TableCell>
                      <TableCell>{company.orgnr}</TableCell>
                      <TableCell>{company.telefon || '-'}</TableCell>
                      <TableCell>{company.epost || '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          {company.orderCount}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {company.totalValue.toLocaleString('sv-SE')} kr
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewCompanyOrders(company)}
                        >
                          Visa beställningar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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

      <CompanyOrdersDialog
        open={companyDialogOpen}
        onOpenChange={setCompanyDialogOpen}
        bedriftskunde={selectedCompany}
        onEdit={handleEdit}
        onDelete={handleDeleteClick}
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
