import { startOfDay } from "date-fns";
import { isAfterClosingTime } from "./timeUtils";

export interface TimeEntry {
  id: string;
  timestamp: string;
  entry_type: "punch_in" | "punch_out";
  is_automatic: boolean;
}

export interface Shift {
  id: string;
  start_time: string;
  end_time: string;
  employee_id: string;
}

export interface BusinessHours {
  day: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

export interface ProcessedTimeEntry {
  punchIn: string | null;
  punchOut: string | null;
  totalMinutes: number;
  lunchMinutes: number;
  hasData: boolean;
  isOngoing: boolean;
  source: 'schedule' | 'actual' | 'none';
}

/**
 * Processes time entry data for a given date, determining whether to use
 * actual punch times or scheduled times based on business hours and store status.
 * 
 * Logic:
 * - If store is closed (or it's a past day), use scheduled times if no punch data exists
 * - If store is open, use actual punch times
 * - Calculate lunch break and total work minutes
 * 
 * @param date - The date to process
 * @param shift - The scheduled shift for this date (if exists)
 * @param punchInEntry - Actual punch in entry (if exists)
 * @param punchOutEntry - Actual punch out entry (if exists)
 * @param businessHours - Business hours configuration
 * @param isToday - Whether this is today's date
 * @returns Processed time entry with standardized structure
 */
export function processTimeEntry(
  date: Date,
  shift: Shift | undefined,
  punchInEntry: TimeEntry | undefined,
  punchOutEntry: TimeEntry | undefined,
  businessHours: BusinessHours[] | undefined,
  isToday: boolean = false
): ProcessedTimeEntry {
  const now = new Date();

  // Priority 1: Complete punch-in/out pair (actual data)
  if (punchInEntry && punchOutEntry) {
    const punchIn = punchInEntry.timestamp;
    const punchOut = punchOutEntry.timestamp;
    const start = new Date(punchIn);
    const end = new Date(punchOut);
    const durationMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
    
    // Calculate lunch break (30 min if worked more than 5.5 hours)
    const lunchMinutes = durationMinutes > 330 ? 30 : 0;
    const totalMinutes = durationMinutes; // Include pause in total

    return {
      punchIn,
      punchOut,
      totalMinutes,
      lunchMinutes,
      hasData: true,
      isOngoing: false,
      source: 'actual'
    };
  }

  // Priority 2: Ongoing shift (only punch-in, today)
  if (punchInEntry && isToday) {
    const punchIn = punchInEntry.timestamp;
    const start = new Date(punchIn);
    const durationMinutes = Math.floor((now.getTime() - start.getTime()) / (1000 * 60));
    const lunchMinutes = durationMinutes > 330 ? 30 : 0;
    const totalMinutes = durationMinutes; // Include pause in total

    return {
      punchIn,
      punchOut: null,
      totalMinutes,
      lunchMinutes,
      hasData: true,
      isOngoing: true,
      source: 'actual'
    };
  }

  // Priority 3: Fallback to schedule (when store is closed or no punch data)
  if (shift) {
    const shiftStart = new Date(shift.start_time);
    const shiftEnd = new Date(shift.end_time);
    const durationMinutes = Math.floor((shiftEnd.getTime() - shiftStart.getTime()) / (1000 * 60));
    const lunchMinutes = durationMinutes > 330 ? 30 : 0;
    const totalMinutes = durationMinutes; // Include pause in total

    return {
      punchIn: shift.start_time,
      punchOut: shift.end_time,
      totalMinutes,
      lunchMinutes,
      hasData: true,
      isOngoing: false,
      source: 'schedule'
    };
  }

  // No data available
  return {
    punchIn: null,
    punchOut: null,
    totalMinutes: 0,
    lunchMinutes: 0,
    hasData: false,
    isOngoing: false,
    source: 'none'
  };
}
