import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Building2, Calendar, User, Phone, Hash, DollarSign, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Beställning } from '@/hooks/useBeställningar';
import { cn } from '@/lib/utils';

interface BeställningCardProps {
  beställning: Beställning;
  onEdit?: (beställning: Beställning) => void;
  onDelete?: (beställning: Beställning) => void;
  showActions?: boolean;
}

const statusConfig = {
  ej_påbörjad: {
    label: 'Ej påbörjad',
    className: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100',
  },
  pågående: {
    label: 'Pågående',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
  },
  klar: {
    label: 'Klar',
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
  },
  levererad: {
    label: 'Levererad',
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
  },
};

export function BeställningCard({
  beställning,
  onEdit,
  onDelete,
  showActions = false,
}: BeställningCardProps) {
  const status = statusConfig[beställning.status as keyof typeof statusConfig] || statusConfig.ej_påbörjad;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="font-semibold truncate">
                {beställning.bedriftskunder?.firmanamn || 'Okänd'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {beställning.bedriftskunder?.orgnr || ''}
            </p>
          </div>
          <Badge className={cn(status.className)}>
            {status.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pb-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">Beskrivning</p>
          <p className="text-sm line-clamp-3">{beställning.beskrivning}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          {beställning.referanse && (
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{beställning.referanse}</span>
            </div>
          )}
          {beställning.telefon && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{beställning.telefon}</span>
            </div>
          )}
          {beställning.pris && (
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{beställning.pris.toLocaleString('sv-SE')} kr</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{format(new Date(beställning.created_at), 'PPP', { locale: sv })}</span>
          </div>
        </div>

        {beställning.profiles && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t">
            <User className="h-4 w-4" />
            <span>
              {beställning.profiles.first_name} {beställning.profiles.last_name}
            </span>
          </div>
        )}
      </CardContent>

      {showActions && (onEdit || onDelete) && (
        <CardFooter className="pt-0 pb-4">
          <div className="flex gap-2 ml-auto">
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(beställning)}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Redigera
              </Button>
            )}
            {onDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(beställning)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Ta bort
              </Button>
            )}
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
