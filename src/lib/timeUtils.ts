import { format as dateFnsFormat, parseISO } from 'date-fns';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { nb } from 'date-fns/locale';

// Norge/Oslo tidszon
const TIMEZONE = 'Europe/Oslo';

/**
 * Konverterar en UTC-tidsstämpel från databasen till norsk tid
 */
export function toNorwegianTime(utcDate: string | Date): Date {
  const date = typeof utcDate === 'string' ? parseISO(utcDate) : utcDate;
  return toZonedTime(date, TIMEZONE);
}

/**
 * Konverterar en lokal norsk tid till UTC för databaslagring
 */
export function toUTC(localDate: Date): Date {
  return fromZonedTime(localDate, TIMEZONE);
}

/**
 * Formaterar en UTC-tidsstämpel som norsk tid (HH:mm format)
 */
export function formatTimeNorway(utcDate: string | Date): string {
  const date = typeof utcDate === 'string' ? parseISO(utcDate) : utcDate;
  return formatInTimeZone(date, TIMEZONE, 'HH:mm');
}

/**
 * Formaterar en UTC-tidsstämpel som norsk datum (dd.MM.yyyy format)
 */
export function formatDateNorway(utcDate: string | Date): string {
  const date = typeof utcDate === 'string' ? parseISO(utcDate) : utcDate;
  return formatInTimeZone(date, TIMEZONE, 'dd.MM.yyyy', { locale: nb });
}

/**
 * Formaterar en UTC-tidsstämpel som norsk datum och tid (dd.MM.yyyy HH:mm)
 */
export function formatDateTimeNorway(utcDate: string | Date): string {
  const date = typeof utcDate === 'string' ? parseISO(utcDate) : utcDate;
  return formatInTimeZone(date, TIMEZONE, 'dd.MM.yyyy HH:mm', { locale: nb });
}

/**
 * Formaterar en UTC-tidsstämpel med custom format i norsk tidszon
 */
export function formatInNorway(utcDate: string | Date, formatStr: string): string {
  const date = typeof utcDate === 'string' ? parseISO(utcDate) : utcDate;
  return formatInTimeZone(date, TIMEZONE, formatStr, { locale: nb });
}

/**
 * Skapar en UTC ISO-sträng från norska tid-komponenter (yyyy-MM-dd + HH:mm)
 */
export function createUTCFromNorwegianTime(dateStr: string, timeStr: string): string {
  // Skapa en lokal tid i Norge (ingen timezone-konvertering)
  const localDateTime = `${dateStr}T${timeStr}:00`;
  const localDate = parseISO(localDateTime);
  
  // Konvertera till UTC
  const utcDate = fromZonedTime(localDate, TIMEZONE);
  return utcDate.toISOString();
}

/**
 * Hämtar aktuell norsk tid
 */
export function getNorwegianNow(): Date {
  return toZonedTime(new Date(), TIMEZONE);
}

/**
 * Extraherar tiden (HH:mm) från en ISO-sträng utan timezone-konvertering
 * Detta är användbart när databasen lagrar tid som redan är i norsk tid
 */
export function extractTime(isoString: string): string {
  return isoString.substring(11, 16); // "HH:mm"
}

/**
 * Extraherar datum (yyyy-MM-dd) från en ISO-sträng
 */
export function extractDate(isoString: string): string {
  return isoString.substring(0, 10); // "yyyy-MM-dd"
}

/**
 * Beräknar varaktighet i timmar mellan två tidpunkter
 */
export function calculateDuration(startTime: string | Date, endTime: string | Date): number {
  const start = typeof startTime === 'string' ? parseISO(startTime) : startTime;
  const end = typeof endTime === 'string' ? parseISO(endTime) : endTime;
  
  const diffMs = end.getTime() - start.getTime();
  return Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10; // Round to 1 decimal
}

/**
 * Beräknar varaktighet i minuter mellan två tidpunkter
 */
export function calculateDurationMinutes(startTime: string | Date, endTime: string | Date): number {
  const start = typeof startTime === 'string' ? parseISO(startTime) : startTime;
  const end = typeof endTime === 'string' ? parseISO(endTime) : endTime;
  
  const diffMs = end.getTime() - start.getTime();
  return Math.round(diffMs / (1000 * 60)); // minutes
}

/**
 * Formaterar duration i timmar och minuter (t.ex. "2h 30m")
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

/**
 * Kontrollerar om butiken är stängd baserat på business hours
 */
export function isAfterClosingTime(
  date: Date,
  businessHours?: Array<{
    day: number;
    isOpen: boolean;
    openTime: string;
    closeTime: string;
  }>
): boolean {
  if (!businessHours) return false;
  
  const norwayDate = toNorwegianTime(date);
  const dayOfWeek = norwayDate.getDay();
  const currentTime = formatInTimeZone(norwayDate, TIMEZONE, 'HH:mm');
  
  const todayHours = businessHours.find(h => h.day === dayOfWeek);
  if (!todayHours || !todayHours.isOpen) {
    return true; // Stängt hela dagen
  }
  
  return currentTime >= todayHours.closeTime;
}
