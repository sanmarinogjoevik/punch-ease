import { useState, useMemo, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Search, Calendar, ArrowLeft } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { BeställningCard } from '@/components/BeställningCard';
import { Beställning, fetchBeställningarByBedriftskunde } from '@/hooks/useBeställningar';
import { Bedriftskunde } from '@/hooks/useBedriftskunder';
import { useAuth } from '@/hooks/useAuth';

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
  onEdit,
  onDelete,
}: CompanyOrdersDialogProps) {
  const { userRole } = useAuth();
  const [companyBeställningar, setCompanyBeställningar] = useState<Beställning[]>([]);
  const [isLoadingCompany, setIsLoadingCompany] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'pris'>('date');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  const canManage = userRole === 'admin';

  useEffect(() => {
    if (open && bedriftskunde?.id) {
      setIsLoadingCompany(true);
      fetchBeställningarByBedriftskunde(bedriftskunde.id)
        .then(setCompanyBeställningar)
        .finally(() => setIsLoadingCompany(false));
    }
  }, [open, bedriftskunde?.id]);

  // Generate month options for the last 12 months
  const monthOptions = useMemo(() => {
    const options = [{ value: 'all', label: 'Alla månader' }];
    const currentDate = new Date();
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const value = format(date, 'yyyy-MM');
      const label = format(date, 'MMMM yyyy', { locale: sv });
      options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    
    return options;
  }, []);

  // Filter and sort beställningar
  const filteredAndSortedBeställningar = useMemo(() => {
    let filtered = companyBeställningar;

    // Apply month filter
    if (selectedMonth !== 'all') {
      const [year, month] = selectedMonth.split('-').map(Number);
      const monthStart = startOfMonth(new Date(year, month - 1));
      const monthEnd = endOfMonth(new Date(year, month - 1));
      
      filtered = filtered.filter((b) => {
        const createdDate = new Date(b.created_at);
        return isWithinInterval(createdDate, { start: monthStart, end: monthEnd });
      });
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (b) =>
          b.beskrivning?.toLowerCase().includes(query) ||
          b.referanse?.toLowerCase().includes(query)
      );
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
  }, [companyBeställningar, searchQuery, sortBy, selectedMonth]);

  // Calculate total price
  const totalPris = useMemo(() => {
    return filteredAndSortedBeställningar.reduce((sum, b) => {
      const beställningTotal = b.varor?.reduce((s, v) => s + (v.pris || 0), 0) || 0;
      return sum + beställningTotal;
    }, 0);
  }, [filteredAndSortedBeställningar]);

  if (!bedriftskunde) return null;

  return (
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

        <div className="space-y-6">
          {/* Filters and Search */}
          <Card>
            <CardHeader>
              <CardTitle>Filter och sök</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger>
                      <SelectValue placeholder="Välj månad" />
                    </SelectTrigger>
                    <SelectContent>
                      {monthOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            {option.value !== 'all' && <Calendar className="h-4 w-4" />}
                            {option.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Sök efter beskrivning, referanse..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
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

          {/* Statistics */}
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

          {/* Orders Grid */}
          <Card>
            <CardHeader>
              <CardTitle>Beställningar</CardTitle>
              <CardDescription>
                {filteredAndSortedBeställningar.length} av {companyBeställningar.length} beställningar
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingCompany ? (
                <div className="text-center py-12 text-muted-foreground">
                  Laddar beställningar...
                </div>
              ) : filteredAndSortedBeställningar.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {searchQuery
                    ? 'Inga beställningar matchade din sökning'
                    : 'Inga beställningar för detta företag'}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredAndSortedBeställningar.map((beställning) => (
                    <BeställningCard
                      key={beställning.id}
                      beställning={beställning}
                      onEdit={canManage ? onEdit : undefined}
                      onDelete={canManage ? onDelete : undefined}
                      showActions={canManage}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
