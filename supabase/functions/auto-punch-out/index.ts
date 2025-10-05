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

interface CompanySettings {
  id: string;
  company_id: string;
  company_name: string;
  business_hours: BusinessHours[] | string;
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
    const todayStartCleanup = new Date(now);
    todayStartCleanup.setHours(0, 0, 0, 0);

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
          if (entryDate < todayStartCleanup) {
            console.log('Found old punch-in from', entry.timestamp, 'for employee', employeeId, '- cleaning up');
            
            // Get company_id from employee profile
            const { data: cleanupProfile } = await supabase
              .from('profiles')
              .select('company_id')
              .eq('user_id', employeeId)
              .single();

            if (!cleanupProfile?.company_id) {
              console.error(`No company_id found for employee ${employeeId} during cleanup`);
              continue;
            }

            const { error: cleanupError } = await supabase
              .from('time_entries')
              .insert({
                employee_id: employeeId,
                company_id: cleanupProfile.company_id,
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

    // Get ALL company settings (multi-tenant support)
    const { data: allCompanySettings, error: settingsError } = await supabase
      .from('company_settings')
      .select('id, company_id, company_name, business_hours');

    if (settingsError || !allCompanySettings || allCompanySettings.length === 0) {
      console.error('Error fetching company settings:', settingsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch company settings' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${allCompanySettings.length} companies for auto punch-out`);

    // Helper function to compare times with tolerance (extended to 5 minutes)
    const isWithinTimeWindow = (currentTime: string, targetTime: string, windowMinutes: number = 5): boolean => {
      const [currentHour, currentMin] = currentTime.split(':').map(Number);
      const [targetHour, targetMin] = targetTime.split(':').map(Number);
      
      const currentMinutes = currentHour * 60 + currentMin;
      const targetMinutes = targetHour * 60 + targetMin;
      
      // Check if current time is at or after target time, but within the window
      return currentMinutes >= targetMinutes && currentMinutes <= targetMinutes + windowMinutes;
    };

    // Helper function to check if time is significantly past closing (10+ minutes)
    const isLatePunchOut = (currentTime: string, targetTime: string): boolean => {
      const [currentHour, currentMin] = currentTime.split(':').map(Number);
      const [targetHour, targetMin] = targetTime.split(':').map(Number);
      
      const currentMinutes = currentHour * 60 + currentMin;
      const targetMinutes = targetHour * 60 + targetMin;
      
      // Check if current time is 10+ minutes past closing
      return currentMinutes >= targetMinutes + 10;
    };

    const currentDay = now.getDay();
    const currentTime = now.toTimeString().substring(0, 5); // HH:MM format
    console.log('Current day:', currentDay, 'Current time:', currentTime);

    let totalPunchedOut = 0;
    let totalPunchedOutNoShift = 0;
    let totalLatePunchOuts = 0;
    const processedCompanies: string[] = [];

    // Process each company
    for (const companySetting of allCompanySettings as CompanySettings[]) {
      console.log(`\n--- Processing company: ${companySetting.company_name} (${companySetting.company_id}) ---`);

      // Parse business hours
      let businessHours: BusinessHours[] = [];
      try {
        if (typeof companySetting.business_hours === 'string') {
          businessHours = JSON.parse(companySetting.business_hours);
        } else {
          businessHours = companySetting.business_hours as BusinessHours[];
        }
      } catch (error) {
        console.error(`Error parsing business hours for ${companySetting.company_name}:`, error);
        continue;
      }

      // Find today's business hours
      const todayHours = businessHours.find(bh => bh.day === currentDay);
      
      if (!todayHours) {
        console.log(`No business hours found for today for ${companySetting.company_name}`);
        continue;
      }

      console.log(`${companySetting.company_name} hours:`, todayHours);

      // Check if we need to handle closing time that goes into next day
      let shouldPunchOut = false;
      let isLatePunchOutTime = false;
      
      if (todayHours.closeTime < todayHours.openTime) {
        // Closing time is on the next day (e.g., opens 12:00, closes 03:00)
        if (currentTime <= todayHours.closeTime) {
          const yesterdayDay = (currentDay - 1 + 7) % 7;
          const yesterdayHours = businessHours.find(bh => bh.day === yesterdayDay);
          
          if (yesterdayHours && yesterdayHours.closeTime < yesterdayHours.openTime) {
            if (isWithinTimeWindow(currentTime, yesterdayHours.closeTime)) {
              shouldPunchOut = true;
              console.log('Punch out time: Yesterday\'s shift ending at', yesterdayHours.closeTime);
            }
            if (isLatePunchOut(currentTime, yesterdayHours.closeTime)) {
              isLatePunchOutTime = true;
              console.log('LATE punch out: More than 10 minutes past closing');
            }
          }
        }
      } else {
        // Normal case: closing time is on the same day
        if (isWithinTimeWindow(currentTime, todayHours.closeTime)) {
          shouldPunchOut = true;
          console.log('Punch out time: Store closing at', todayHours.closeTime);
        }
        if (isLatePunchOut(currentTime, todayHours.closeTime)) {
          isLatePunchOutTime = true;
          console.log('LATE punch out: More than 10 minutes past closing');
        }
      }

      if (!shouldPunchOut && !isLatePunchOutTime) {
        console.log(`Not punch-out time yet for ${companySetting.company_name}. Store closes at: ${todayHours.closeTime}`);
        continue;
      }

      // Get employees for this company who are currently punched in
      const { data: companyProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('company_id', companySetting.company_id);

      if (profilesError || !companyProfiles || companyProfiles.length === 0) {
        console.log(`No employees found for ${companySetting.company_name}`);
        continue;
      }

      const companyEmployeeIds = companyProfiles.map(p => p.user_id);
      console.log(`${companySetting.company_name} has ${companyEmployeeIds.length} employees`);

      // Get all time entries for this company's employees
      const { data: companyTimeEntries, error: entriesError } = await supabase
        .from('time_entries')
        .select('employee_id, entry_type, timestamp')
        .in('employee_id', companyEmployeeIds)
        .order('timestamp', { ascending: false });

      if (entriesError) {
        console.error(`Error fetching time entries for ${companySetting.company_name}:`, entriesError);
        continue;
      }

      // Group by employee and find latest entry for each
      const employeeLatestEntries = new Map();
      companyTimeEntries?.forEach(entry => {
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

      console.log(`${companySetting.company_name}: Found ${punchedInEmployeeIds.length} punched-in employees`);

      if (punchedInEmployeeIds.length === 0) {
        console.log(`No employees currently punched in for ${companySetting.company_name}`);
        continue;
      }

      // Get today's shifts for this company
      const todayStartShift = new Date(now);
      todayStartShift.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);

      const { data: todayShifts, error: shiftsError } = await supabase
        .from('shifts')
        .select('employee_id, start_time, end_time')
        .eq('company_id', companySetting.company_id)
        .gte('start_time', todayStartShift.toISOString())
        .lte('start_time', todayEnd.toISOString());

      if (shiftsError) {
        console.error(`Error fetching shifts for ${companySetting.company_name}:`, shiftsError);
      }

      const employeeShifts = new Map(todayShifts?.map(shift => [shift.employee_id, shift]) || []);
      console.log(`${companySetting.company_name}: ${employeeShifts.size} employees with shifts today`);

      let companyPunchedOut = 0;
      let companyNoShiftPunchedOut = 0;
      let companyLatePunchedOut = 0;

      // Process each punched-in employee
      for (const employeeId of punchedInEmployeeIds) {
        const shift = employeeShifts.get(employeeId);
        const hasShift = !!shift;

        // Fallback: Force punch-out if more than 10 minutes past closing
        if (isLatePunchOutTime) {
          console.log(`Employee ${employeeId}: LATE punch-out (10+ min past closing) - forcing punch-out`);
          
          const { error: insertError } = await supabase
            .from('time_entries')
            .insert({
              employee_id: employeeId,
              company_id: companySetting.company_id,
              entry_type: 'punch_out',
              timestamp: now.toISOString(),
              is_automatic: true,
            });

          if (insertError) {
            console.error('Error creating late punch-out for employee:', employeeId, insertError);
            continue;
          }

          companyLatePunchedOut++;
          totalLatePunchOuts++;
          console.log(`Successfully punched out employee (LATE): ${employeeId}`);
          continue;
        }

        // Normal processing
        if (!hasShift) {
          console.log(`Employee ${employeeId}: NO shift today - auto punching out`);
          
          const { error: insertError } = await supabase
            .from('time_entries')
            .insert({
              employee_id: employeeId,
              company_id: companySetting.company_id,
              entry_type: 'punch_out',
              timestamp: now.toISOString(),
              is_automatic: true,
            });

          if (insertError) {
            console.error('Error creating punch-out for employee:', employeeId, insertError);
            continue;
          }

          companyNoShiftPunchedOut++;
          totalPunchedOutNoShift++;
          console.log(`Successfully punched out employee (no shift): ${employeeId}`);
        } else if (shouldPunchOut) {
          console.log(`Employee ${employeeId}: Closing time - using shift end time`);

          const { error: insertError } = await supabase
            .from('time_entries')
            .insert({
              employee_id: employeeId,
              company_id: companySetting.company_id,
              entry_type: 'punch_out',
              timestamp: shift.end_time,
              is_automatic: true,
            });

          if (insertError) {
            console.error('Error creating punch-out for employee:', employeeId, insertError);
            continue;
          }

          companyPunchedOut++;
          totalPunchedOut++;
          console.log(`Successfully punched out employee (closing time): ${employeeId}`);
        }
      }

      console.log(`${companySetting.company_name} summary: ${companyPunchedOut} closing-time punch-outs, ${companyNoShiftPunchedOut} no-shift punch-outs, ${companyLatePunchedOut} late punch-outs`);
      processedCompanies.push(companySetting.company_name);
    }

    // Normalize time entries for today
    console.log('\n--- Normalizing time entries for today ---');
    const todayDateStr = now.toISOString().split('T')[0];
    
    try {
      const { error: normalizeError } = await supabase.functions.invoke('normalize-time-entries', {
        body: { date: todayDateStr }
      });

      if (normalizeError) {
        console.error('Error normalizing time entries:', normalizeError);
      } else {
        console.log('Time entries normalized successfully');
      }
    } catch (normalizeErr) {
      console.error('Failed to invoke normalize-time-entries:', normalizeErr);
    }

    const result = {
      message: 'Multi-tenant auto punch-out processing complete',
      currentTime,
      companiesProcessed: processedCompanies.length,
      companyNames: processedCompanies,
      totalPunchedOutAtClosing: totalPunchedOut,
      totalPunchedOutNoShift: totalPunchedOutNoShift,
      totalLatePunchOuts: totalLatePunchOuts,
      totalPunchedOut: totalPunchedOut + totalPunchedOutNoShift + totalLatePunchOuts,
      timestamp: now.toISOString(),
    };

    console.log('\n=== AUTO PUNCH-OUT RESULT ===');
    console.log(result);

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
