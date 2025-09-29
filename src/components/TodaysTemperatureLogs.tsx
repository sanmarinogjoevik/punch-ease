import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Thermometer, Clock, User, AlertCircle } from "lucide-react";
import { useTemperatureLogs } from "@/hooks/useTemperatureLogs";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

export const TodaysTemperatureLogs = () => {
  const { temperatureLogs, isLoading, error } = useTemperatureLogs();

  const getTemperatureColor = (temperature: number): string => {
    if (temperature <= 0) return "text-blue-600 bg-blue-50 border-blue-200";
    if (temperature <= 5) return "text-cyan-600 bg-cyan-50 border-cyan-200";
    if (temperature >= 20) return "text-red-600 bg-red-50 border-red-200";
    return "text-green-600 bg-green-50 border-green-200";
  };

  const formatTemperature = (temp: number): string => {
    return `${temp}°C`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Thermometer className="h-5 w-5" />
            Dagens Temperaturer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Thermometer className="h-5 w-5" />
            Dagens Temperaturer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Thermometer className="h-5 w-5" />
          Dagens Temperaturer
        </CardTitle>
        <CardDescription>
          Temperaturloggar registrerade idag
        </CardDescription>
      </CardHeader>
      <CardContent>
        {temperatureLogs.length > 0 ? (
          <div className="space-y-3">
            {temperatureLogs.slice(0, 6).map((log) => (
              <div
                key={log.id}
                className={`p-3 rounded-lg border ${getTemperatureColor(log.temperature)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-sm">
                      {log.equipment_name}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs opacity-80">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(log.timestamp), 'HH:mm', { locale: nb })}
                      </div>
                      {log.profiles && (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {log.profiles.first_name} {log.profiles.last_name}
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="ml-2 font-mono">
                    {formatTemperature(log.temperature)}
                  </Badge>
                </div>
                {log.notes && (
                  <div className="text-xs mt-2 opacity-70">
                    💬 {log.notes}
                  </div>
                )}
              </div>
            ))}
            {temperatureLogs.length > 6 && (
              <div className="text-center text-sm text-muted-foreground py-2">
                ... och {temperatureLogs.length - 6} fler
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground py-6 justify-center">
            <AlertCircle className="h-4 w-4" />
            Inga temperaturer registrerade idag
          </div>
        )}
      </CardContent>
    </Card>
  );
};