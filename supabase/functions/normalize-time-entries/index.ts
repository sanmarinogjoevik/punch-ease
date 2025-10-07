import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { format, startOfDay, endOfDay } from 'https://esm.sh/date-fns@3.6.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Seed-based randomization for consistent variations
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function gaussianRandom(seed: number): number {
  // Box-Muller transform for gaussian distribution
  const u1 = seededRandom(seed);
  const u2 = seededRandom(seed + 1);
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0; // Standard normal (mean=0, stddev=1)
}

function getRealisticVariation(employeeId: string, date: string, type: 'in' | 'out'): number {
  const seed = hashString(employeeId + date + type);
  // Standard deviation = 4 minutes
  // This gives ~68% within ±4 min, ~95% within ±8 min, rest ±10 min
  const variation = gaussianRandom(seed) * 4;
  // Clamp to -10 and +10
  return Math.max(-10, Math.min(10, Math.round(variation)));
}

function applyVariation(timestamp: string, minutes: number): string {
  const date = new Date(timestamp);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { date: targetDate, force } = await req.json().catch(() => ({}));
    
    // Default to today if no date provided
    const now = new Date();
    const processDate = targetDate ? new Date(targetDate) : now;
    const dateStr = format(processDate, 'yyyy-MM-dd');
    
    console.log('Normalizing time entries for date:', dateStr, 'Force:', force);

    // Get date range
    const dayStart = startOfDay(processDate);
    const dayEnd = endOfDay(processDate);

    // Get all shifts for this date
    const { data: shifts, error: shiftsError } = await supabase
      .from('shifts')
      .select('id, employee_id, start_time, end_time, company_id')
      .gte('start_time', dayStart.toISOString())
      .lte('start_time', dayEnd.toISOString());

    if (shiftsError) {
      console.error('Error fetching shifts:', shiftsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch shifts' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!shifts || shifts.length === 0) {
      console.log('No shifts found for date:', dateStr);
      return new Response(
        JSON.stringify({ 
          message: 'No shifts found for date',
          date: dateStr,
          normalized: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${shifts.length} shifts for ${dateStr}`);

    let normalizedCount = 0;
    let skippedCount = 0;

    for (const shift of shifts) {
      // Delete existing time entries for this employee and date (if any)
      // This allows us to create fresh normalized entries based on the shift
      const { error: deleteError } = await supabase
        .from('time_entries')
        .delete()
        .eq('employee_id', shift.employee_id)
        .gte('timestamp', dayStart.toISOString())
        .lte('timestamp', dayEnd.toISOString());

      if (deleteError) {
        console.error(`Error deleting entries for employee ${shift.employee_id}:`, deleteError);
        continue;
      }

      // Generate variations
      const punchInVariation = getRealisticVariation(shift.employee_id, dateStr, 'in');
      const punchOutVariation = getRealisticVariation(shift.employee_id, dateStr, 'out');

      const normalizedPunchIn = applyVariation(shift.start_time, punchInVariation);
      const normalizedPunchOut = applyVariation(shift.end_time, punchOutVariation);

      console.log(`Employee ${shift.employee_id}: ${punchInVariation > 0 ? '+' : ''}${punchInVariation}min in, ${punchOutVariation > 0 ? '+' : ''}${punchOutVariation}min out`);

      // Create new normalized entries
      const { error: insertError } = await supabase
        .from('time_entries')
        .insert([
          {
            employee_id: shift.employee_id,
            company_id: shift.company_id,
            entry_type: 'punch_in',
            timestamp: normalizedPunchIn,
            is_automatic: true,
          },
          {
            employee_id: shift.employee_id,
            company_id: shift.company_id,
            entry_type: 'punch_out',
            timestamp: normalizedPunchOut,
            is_automatic: true,
          }
        ]);

      if (insertError) {
        console.error(`Error inserting normalized entries for employee ${shift.employee_id}:`, insertError);
        continue;
      }

      normalizedCount++;
      console.log(`Successfully normalized entries for employee ${shift.employee_id}`);
    }

    const result = {
      message: 'Time entry normalization complete',
      date: dateStr,
      totalShifts: shifts.length,
      normalized: normalizedCount,
      skipped: skippedCount,
      timestamp: new Date().toISOString(),
    };

    console.log('Normalization result:', result);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in normalize-time-entries function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
