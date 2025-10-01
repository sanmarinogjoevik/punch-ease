import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BusinessHours {
  day: number; // 0-6 (söndag-lördag)
  dayName: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
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

    const now = new Date();
    console.log('Auto punch-out function triggered at:', now.toISOString());

    // Get business hours from company settings
    const { data: companySettings, error: settingsError } = await supabase
      .from('company_settings')
      .select('business_hours')
      .single();

    if (settingsError || !companySettings) {
      console.error('Error fetching company settings:', settingsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch company settings' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse business hours
    let businessHours: BusinessHours[] = [];
    try {
      if (typeof companySettings.business_hours === 'string') {
        businessHours = JSON.parse(companySettings.business_hours);
      } else {
        businessHours = companySettings.business_hours as BusinessHours[];
      }
    } catch (error) {
      console.error('Error parsing business hours:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to parse business hours' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current day (0 = Sunday, 6 = Saturday)
    const currentDay = now.getDay();
    const currentTime = now.toTimeString().substring(0, 5); // HH:MM format

    console.log('Current day:', currentDay, 'Current time:', currentTime);

    // Find today's business hours
    const todayHours = businessHours.find(bh => bh.day === currentDay);
    
    if (!todayHours) {
      console.log('No business hours found for today');
      return new Response(
        JSON.stringify({ message: 'No business hours configured for today' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Today\'s hours:', todayHours);

    // Helper function to compare times with tolerance (within 2 minutes)
    const isWithinTimeWindow = (currentTime: string, targetTime: string, windowMinutes: number = 2): boolean => {
      const [currentHour, currentMin] = currentTime.split(':').map(Number);
      const [targetHour, targetMin] = targetTime.split(':').map(Number);
      
      const currentMinutes = currentHour * 60 + currentMin;
      const targetMinutes = targetHour * 60 + targetMin;
      
      // Check if current time is at or after target time, but within the window
      return currentMinutes >= targetMinutes && currentMinutes <= targetMinutes + windowMinutes;
    };

    // Check if we need to handle closing time that goes into next day
    // For example, Saturday closes at 03:00 (which is Sunday morning)
    let shouldPunchOut = false;
    
    if (todayHours.closeTime < todayHours.openTime) {
      // Closing time is on the next day (e.g., opens 12:00, closes 03:00)
      // We should punch out if current time is >= closeTime and we're early in the day
      
      // Check if it's past midnight and before closing time
      if (currentTime <= todayHours.closeTime) {
        // We're in the early morning of today, but this is actually yesterday's closing
        const yesterdayDay = (currentDay - 1 + 7) % 7;
        const yesterdayHours = businessHours.find(bh => bh.day === yesterdayDay);
        
        if (yesterdayHours && yesterdayHours.closeTime < yesterdayHours.openTime) {
          // Yesterday's closing time extends into today
          if (isWithinTimeWindow(currentTime, yesterdayHours.closeTime)) {
            shouldPunchOut = true;
            console.log('Punch out time: Yesterday\'s shift ending at', yesterdayHours.closeTime);
          }
        }
      }
    } else {
      // Normal case: closing time is on the same day
      if (isWithinTimeWindow(currentTime, todayHours.closeTime)) {
        shouldPunchOut = true;
        console.log('Punch out time: Store closing at', todayHours.closeTime);
      }
    }

    if (!shouldPunchOut) {
      console.log('Not punch-out time yet. Store closes at:', todayHours.closeTime);
      return new Response(
        JSON.stringify({ 
          message: 'Not punch-out time yet',
          currentTime,
          closingTime: todayHours.closeTime
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // It's closing time! Find all employees who are currently punched in
    console.log('It\'s closing time! Finding all punched-in employees...');

    // Get all employees
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id');

    if (profilesError || !profiles) {
      console.error('Error fetching profiles:', profilesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch employee profiles' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let punchedOutCount = 0;
    let alreadyPunchedOutCount = 0;

    for (const profile of profiles) {
      // Get the most recent time entry for this employee
      const { data: latestEntry, error: entryError } = await supabase
        .from('time_entries')
        .select('*')
        .eq('employee_id', profile.user_id)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (entryError) {
        console.error('Error fetching time entry for employee:', profile.user_id, entryError);
        continue;
      }

      // If no entry or last entry is punch_out, skip
      if (!latestEntry || latestEntry.entry_type === 'punch_out') {
        console.log('Employee', profile.user_id, 'is already punched out');
        alreadyPunchedOutCount++;
        continue;
      }

      // Employee is punched in, create automatic punch out
      console.log('Creating automatic punch-out for employee:', profile.user_id);

      const { error: insertError } = await supabase
        .from('time_entries')
        .insert({
          employee_id: profile.user_id,
          entry_type: 'punch_out',
          timestamp: now.toISOString(),
          is_automatic: true,
        });

      if (insertError) {
        console.error('Error creating punch-out for employee:', profile.user_id, insertError);
        continue;
      }

      punchedOutCount++;
      console.log('Successfully punched out employee:', profile.user_id);
    }

    const result = {
      message: 'Auto punch-out processing complete',
      currentTime,
      closingTime: todayHours.closeTime,
      employeesChecked: profiles.length,
      punchedOutCount,
      alreadyPunchedOutCount,
      timestamp: now.toISOString(),
    };

    console.log('Auto punch-out result:', result);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in auto-punch-out function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
