import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Building2, Calendar, User, Phone, Hash, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Beställning } from '@/hooks/useBeställningar';

interface BeställningCardProps {
  beställning: Beställning;
  onEdit?: (beställning: Beställning) => void;
  onDelete?: (beställning: Beställning) => void;
  showActions?: boolean;
}

export function BeställningCard({
  beställning,
  onEdit,
  onDelete,
  showActions = false,
}: BeställningCardProps) {
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
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pb-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">Beskrivning</p>
          <p className="text-sm line-clamp-3">{beställning.beskrivning}</p>
        </div>

        {beställning.varor && beställning.varor.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Varor</p>
            <div className="space-y-1">
              {beställning.varor.map((vara, index) => (
                <div key={index} className="flex justify-between text-sm border-b pb-1">
                  <span>{vara.vara}</span>
                  <span className="font-medium">{vara.pris.toLocaleString('sv-SE')} kr</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-semibold pt-1">
                <span>Totalt</span>
                <span>
                  {beställning.varor.reduce((sum, v) => sum + v.pris, 0).toLocaleString('sv-SE')} kr
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t">
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
