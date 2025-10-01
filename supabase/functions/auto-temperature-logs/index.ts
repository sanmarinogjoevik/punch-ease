import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    console.log(`Auto temperature logs function triggered at: ${now.toISOString()}`);
    console.log(`Checking for logs between: ${todayStart.toISOString()} and ${todayEnd.toISOString()}`);

    // Get all active equipment
    const { data: equipment, error: equipmentError } = await supabase
      .from('equipment')
      .select('*')
      .eq('is_active', true);

    if (equipmentError) {
      console.error('Error fetching equipment:', equipmentError);
      throw equipmentError;
    }

    if (!equipment || equipment.length === 0) {
      console.log('No active equipment found');
      return new Response(
        JSON.stringify({ message: 'No active equipment to log', logsCreated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`Found ${equipment.length} active equipment items`);

    // Check which equipment already has logs today
    const { data: existingLogs } = await supabase
      .from('temperature_logs')
      .select('equipment_name')
      .gte('timestamp', todayStart.toISOString())
      .lte('timestamp', todayEnd.toISOString());

    const loggedEquipmentToday = new Set(existingLogs?.map(log => log.equipment_name) || []);
    const equipmentToLog = equipment.filter(eq => !loggedEquipmentToday.has(eq.name));

    if (equipmentToLog.length === 0) {
      console.log('All equipment already has logs for today');
      return new Response(
        JSON.stringify({ message: 'All equipment already logged today', logsCreated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`Need to create logs for ${equipmentToLog.length} equipment items`);

    // Find the first employee working today
    const { data: shifts, error: shiftsError } = await supabase
      .from('shifts')
      .select('employee_id, start_time')
      .gte('start_time', todayStart.toISOString())
      .lte('start_time', todayEnd.toISOString())
      .order('start_time', { ascending: true })
      .limit(1);

    if (shiftsError) {
      console.error('Error fetching shifts:', shiftsError);
      throw shiftsError;
    }

    let employeeId: string;
    let logTimestamp: Date;

    if (!shifts || shifts.length === 0) {
      console.log('No shifts found for today, using most recent employee');
      
      // Fallback: get the most recent employee from any temperature log
      const { data: recentLog } = await supabase
        .from('temperature_logs')
        .select('employee_id')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!recentLog) {
        console.log('No recent logs found, cannot create automatic logs');
        return new Response(
          JSON.stringify({ message: 'No employee found to assign logs', logsCreated: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      employeeId = recentLog.employee_id;
      // Fallback to 08:00 if no shifts
      logTimestamp = new Date(todayStart);
      logTimestamp.setHours(8, 0, 0);
      console.log(`No shifts found, using fallback time: ${logTimestamp.toISOString()}`);
    } else {
      employeeId = shifts[0].employee_id;
      // Use the actual shift start time
      logTimestamp = new Date(shifts[0].start_time);
      console.log(`Using employee ${employeeId} from first shift starting at: ${logTimestamp.toISOString()}`);
    }

    // Generate temperature logs
    const logsToCreate = equipmentToLog.map(eq => {
      let temperature: number;
      
      if (eq.type === 'fridge') {
        // Kyl: -1.0 to 4.0°C
        temperature = Math.random() * 5 - 1; // Generates -1 to 4
      } else {
        // Frys: -22.0 to -18.0°C
        temperature = Math.random() * 4 - 22; // Generates -22 to -18
      }

      // Round to 1 decimal place
      temperature = Math.round(temperature * 10) / 10;

      console.log(`Creating log for ${eq.name} (${eq.type}): ${temperature}°C at ${logTimestamp.toISOString()}`);

      return {
        employee_id: employeeId,
        equipment_name: eq.name,
        temperature: temperature,
        timestamp: logTimestamp.toISOString(),
        notes: 'Automatisk logg'
      };
    });

    // Insert all logs at once
    const { data: createdLogs, error: insertError } = await supabase
      .from('temperature_logs')
      .insert(logsToCreate)
      .select();

    if (insertError) {
      console.error('Error creating temperature logs:', insertError);
      throw insertError;
    }

    console.log(`Successfully created ${createdLogs?.length || 0} temperature logs`);

    return new Response(
      JSON.stringify({
        message: 'Automatic temperature logs created',
        logsCreated: createdLogs?.length || 0,
        equipmentLogged: equipmentToLog.map(eq => eq.name),
        timestamp: now.toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in auto-temperature-logs function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
