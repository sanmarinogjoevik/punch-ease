import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate random time within ±10 minutes of scheduled time
const getRandomPunchTime = (scheduledTime: string): string => {
  const scheduled = new Date(scheduledTime);
  const variation = Math.floor(Math.random() * 21) - 10; // -10 to +10 minutes
  const adjusted = new Date(scheduled.getTime() + variation * 60 * 1000);
  return adjusted.toISOString();
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Auto punch-in function triggered at:', new Date().toISOString());

    // Create Supabase client with service role for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current time and time 5 minutes from now
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    console.log('Checking for shifts starting between:', now.toISOString(), 'and', fiveMinutesFromNow.toISOString());
    console.log('Also checking for ongoing shifts that have already started');

    // Find all shifts that:
    // 1. Start within the next 5 minutes OR
    // 2. Are currently ongoing (started but not ended yet)
    // 3. Have auto_punch_in enabled
    const { data: upcomingShifts, error: shiftsError } = await supabase
      .from('shifts')
      .select('id, employee_id, start_time, end_time, location')
      .eq('auto_punch_in', true)
      .or(`and(start_time.gte.${now.toISOString()},start_time.lte.${fiveMinutesFromNow.toISOString()}),and(start_time.lte.${now.toISOString()},end_time.gte.${now.toISOString()})`);

    if (shiftsError) {
      console.error('Error fetching shifts:', shiftsError);
      throw shiftsError;
    }

    console.log(`Found ${upcomingShifts?.length || 0} upcoming shifts with auto punch-in enabled`);

    if (!upcomingShifts || upcomingShifts.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No upcoming shifts found', processedCount: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let processedCount = 0;
    let alreadyPunchedInCount = 0;

    // Process each shift
    for (const shift of upcomingShifts) {
      console.log(`Processing shift ${shift.id} for employee ${shift.employee_id}`);

      // Check if employee already has a punch-in today (same date as shift start)
      const shiftDate = new Date(shift.start_time);
      const startOfShiftDay = new Date(shiftDate.setHours(0, 0, 0, 0));
      const endOfShiftDay = new Date(shiftDate.setHours(23, 59, 59, 999));

      const { data: todayPunchIns, error: entryError } = await supabase
        .from('time_entries')
        .select('*')
        .eq('employee_id', shift.employee_id)
        .eq('entry_type', 'punch_in')
        .gte('timestamp', startOfShiftDay.toISOString())
        .lte('timestamp', endOfShiftDay.toISOString());

      if (entryError) {
        console.error(`Error checking time entries for employee ${shift.employee_id}:`, entryError);
        continue;
      }

      // If employee already has a punch-in today, skip automatic punch-in
      if (todayPunchIns && todayPunchIns.length > 0) {
        console.log(`Employee ${shift.employee_id} already has a punch-in today, skipping automatic punch-in`);
        alreadyPunchedInCount++;
        continue;
      }

      // Check if we already created an automatic punch-in for this shift
      const { data: existingAutoPunch, error: autoPunchError } = await supabase
        .from('time_entries')
        .select('*')
        .eq('employee_id', shift.employee_id)
        .eq('entry_type', 'punch_in')
        .eq('is_automatic', true)
        .gte('timestamp', shift.start_time)
        .lte('timestamp', new Date(new Date(shift.start_time).getTime() + 10 * 60 * 1000).toISOString())
        .maybeSingle();

      if (autoPunchError) {
        console.error(`Error checking existing auto punch for employee ${shift.employee_id}:`, autoPunchError);
        continue;
      }

      if (existingAutoPunch) {
        console.log(`Automatic punch-in already exists for employee ${shift.employee_id} at shift start time`);
        continue;
      }

      // Get company_id from employee profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', shift.employee_id)
        .single();

      if (profileError || !profileData?.company_id) {
        console.error(`No company_id found for employee ${shift.employee_id}:`, profileError);
        continue;
      }

      // Create automatic punch-in with ±10 minutes variation
      const { error: insertError } = await supabase
        .from('time_entries')
        .insert({
          employee_id: shift.employee_id,
          company_id: profileData.company_id,
          entry_type: 'punch_in',
          timestamp: getRandomPunchTime(shift.start_time),
          is_automatic: true,
        });

      if (insertError) {
        console.error(`Error creating automatic punch-in for employee ${shift.employee_id}:`, insertError);
        continue;
      }

      console.log(`✅ Successfully created automatic punch-in for employee ${shift.employee_id} at ${shift.start_time}`);
      processedCount++;

      // Trigger automatic temperature logs for the first punch-in of the day
      try {
        console.log(`Triggering automatic temperature logs for employee ${shift.employee_id}`);
        const { error: tempLogError } = await supabase.functions.invoke('auto-temperature-logs', {
          body: {
            employee_id: shift.employee_id,
            timestamp: shift.start_time,
          }
        });

        if (tempLogError) {
          console.error(`Failed to create temperature logs for employee ${shift.employee_id}:`, tempLogError);
        } else {
          console.log(`✅ Successfully triggered temperature logs for employee ${shift.employee_id}`);
        }
      } catch (tempError) {
        console.error(`Error triggering temperature logs for employee ${shift.employee_id}:`, tempError);
        // Don't fail the punch-in process if temperature logging fails
      }
    }

    const result = {
      message: 'Auto punch-in processing complete',
      shiftsChecked: upcomingShifts.length,
      processedCount,
      alreadyPunchedInCount,
      timestamp: now.toISOString(),
    };

    console.log('Auto punch-in result:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in auto-punch-in function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
