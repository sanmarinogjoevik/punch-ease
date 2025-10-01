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

    // First, clean up any old punch-ins from previous days
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // Get all time entries to find old punch-ins
    const { data: allEntries, error: allEntriesError } = await supabase
      .from('time_entries')
      .select('employee_id, entry_type, timestamp')
      .order('timestamp', { ascending: false });

    if (!allEntriesError && allEntries) {
      const employeeLatestEntries = new Map();
      allEntries.forEach(entry => {
        if (!employeeLatestEntries.has(entry.employee_id)) {
          employeeLatestEntries.set(entry.employee_id, entry);
        }
      });

      // Find employees with old punch-ins (before today)
      let oldPunchInsCleanedUp = 0;
      for (const [employeeId, entry] of employeeLatestEntries.entries()) {
        if (entry.entry_type === 'punch_in') {
          const entryDate = new Date(entry.timestamp);
          if (entryDate < todayStart) {
            console.log('Found old punch-in from', entry.timestamp, 'for employee', employeeId, '- cleaning up');
            
            const { error: cleanupError } = await supabase
              .from('time_entries')
              .insert({
                employee_id: employeeId,
                entry_type: 'punch_out',
                timestamp: new Date(entryDate.getTime() + 1000).toISOString(), // 1 second after punch-in
                is_automatic: true,
              });

            if (!cleanupError) {
              oldPunchInsCleanedUp++;
              console.log('Cleaned up old punch-in for employee:', employeeId);
            }
          }
        }
      }

      if (oldPunchInsCleanedUp > 0) {
        console.log('Cleaned up', oldPunchInsCleanedUp, 'old punch-in entries');
      }
    }

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

    // Get all employees who are currently punched in
    const { data: allTimeEntries, error: entriesError } = await supabase
      .from('time_entries')
      .select('employee_id, entry_type, timestamp')
      .order('timestamp', { ascending: false });

    if (entriesError) {
      console.error('Error fetching time entries:', entriesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch time entries' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group by employee and find latest entry for each
    const employeeLatestEntries = new Map();
    allTimeEntries?.forEach(entry => {
      if (!employeeLatestEntries.has(entry.employee_id)) {
        employeeLatestEntries.set(entry.employee_id, entry);
      }
    });

    // Find employees who are currently punched in
    const punchedInEmployeeIds: string[] = [];
    employeeLatestEntries.forEach(entry => {
      if (entry.entry_type === 'punch_in') {
        punchedInEmployeeIds.push(entry.employee_id);
      }
    });

    console.log('Found', punchedInEmployeeIds.length, 'punched-in employees');

    if (punchedInEmployeeIds.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No employees currently punched in',
          currentTime,
          closingTime: todayHours.closeTime
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get today's date range for shift check
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // Get all active shifts for today
    const { data: todayShifts, error: shiftsError } = await supabase
      .from('shifts')
      .select('employee_id, start_time, end_time')
      .gte('start_time', todayStart.toISOString())
      .lte('start_time', todayEnd.toISOString());

    if (shiftsError) {
      console.error('Error fetching shifts:', shiftsError);
    }

    // Create a set of employee IDs who have shifts today
    const employeesWithShifts = new Set(todayShifts?.map(shift => shift.employee_id) || []);
    console.log('Employees with shifts today:', employeesWithShifts.size);

    let punchedOutCount = 0;
    let alreadyPunchedOutCount = 0;
    let noShiftPunchedOut = 0;

    for (const employeeId of punchedInEmployeeIds) {
      // Check if employee has a shift today
      const hasShift = employeesWithShifts.has(employeeId);

      // Punch out if: 
      // 1. It's closing time (shouldPunchOut = true), OR
      // 2. Employee doesn't have a shift today
      if (!hasShift) {
        console.log('Employee', employeeId, 'has NO shift today - auto punching out');
        
        const { error: insertError } = await supabase
          .from('time_entries')
          .insert({
            employee_id: employeeId,
            entry_type: 'punch_out',
            timestamp: now.toISOString(),
            is_automatic: true,
          });

        if (insertError) {
          console.error('Error creating punch-out for employee:', employeeId, insertError);
          continue;
        }

        noShiftPunchedOut++;
        console.log('Successfully punched out employee (no shift):', employeeId);
      } else if (shouldPunchOut) {
        // Employee has a shift but it's closing time
        console.log('Creating automatic punch-out for employee:', employeeId);

        const { error: insertError } = await supabase
          .from('time_entries')
          .insert({
            employee_id: employeeId,
            entry_type: 'punch_out',
            timestamp: now.toISOString(),
            is_automatic: true,
          });

        if (insertError) {
          console.error('Error creating punch-out for employee:', employeeId, insertError);
          continue;
        }

        punchedOutCount++;
        console.log('Successfully punched out employee (closing time):', employeeId);
      }
    }

    const result = {
      message: 'Auto punch-out processing complete',
      currentTime,
      closingTime: todayHours.closeTime,
      totalPunchedIn: punchedInEmployeeIds.length,
      punchedOutAtClosing: punchedOutCount,
      punchedOutNoShift: noShiftPunchedOut,
      totalPunchedOut: punchedOutCount + noShiftPunchedOut,
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
