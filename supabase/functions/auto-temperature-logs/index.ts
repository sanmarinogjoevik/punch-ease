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

    // Get the request body to check if this is triggered by a punch-in
    const body = await req.json().catch(() => ({}));
    const { employee_id: punchInEmployeeId, timestamp: punchInTimestamp } = body;

    // Check if temperature logs already exist for today
    const { data: existingLogs } = await supabase
      .from('temperature_logs')
      .select('equipment_name')
      .gte('timestamp', todayStart.toISOString())
      .lte('timestamp', todayEnd.toISOString());

    if (existingLogs && existingLogs.length > 0) {
      console.log('Temperature logs already exist for today');
      return new Response(
        JSON.stringify({ message: 'Temperature logs already created today', logsCreated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`No temperature logs found for today, creating new logs`);

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

    // Determine employee and timestamp from punch-in or fallback
    let employeeId: string;
    let logTimestamp: Date;

    if (punchInEmployeeId && punchInTimestamp) {
      // Use the employee and timestamp from the punch-in event
      employeeId = punchInEmployeeId;
      logTimestamp = new Date(punchInTimestamp);
      console.log(`Using punch-in data: employee ${employeeId} at ${logTimestamp.toISOString()}`);
    } else {
      // Fallback: get today's first punch-in
      console.log('No punch-in data provided, finding today\'s first punch-in');
      const { data: firstPunchIn } = await supabase
        .from('time_entries')
        .select('employee_id, timestamp')
        .eq('entry_type', 'punch_in')
        .gte('timestamp', todayStart.toISOString())
        .lte('timestamp', todayEnd.toISOString())
        .order('timestamp', { ascending: true })
        .limit(1)
        .single();

      if (!firstPunchIn) {
        console.log('No punch-ins found for today, cannot create automatic logs');
        return new Response(
          JSON.stringify({ message: 'No employee has punched in today yet', logsCreated: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      employeeId = firstPunchIn.employee_id;
      logTimestamp = new Date(firstPunchIn.timestamp);
      console.log(`Using first punch-in of today: employee ${employeeId} at ${logTimestamp.toISOString()}`);
    }

    // Fetch employee profile to get company_id
    const { data: employeeProfile, error: profileError } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', employeeId)
      .single();

    if (profileError || !employeeProfile?.company_id) {
      console.error('Error fetching employee profile or no company_id found:', profileError);
      return new Response(
        JSON.stringify({ 
          message: 'No company found for employee', 
          logsCreated: 0,
          error: profileError?.message 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`Employee company_id: ${employeeProfile.company_id}`);

    // Generate temperature logs
    const logsToCreate = equipment.map(eq => {
      let temperature: number;
      
      if (eq.type === 'refrigerator') {
        // Kyl: -1 to 4°C
        temperature = Math.random() * 5 - 1; // Generates -1 to 4
      } else if (eq.type === 'freezer') {
        // Frys: -18 to -22°C
        temperature = -18 - Math.random() * 4; // Generates -18 to -22
      } else {
        // Default to fridge temperatures for unknown types
        temperature = Math.random() * 5 - 1; // -1 to 4
      }

      // Round to whole number (heltal)
      temperature = Math.round(temperature);

      console.log(`Creating log for ${eq.name} (${eq.type}): ${temperature}°C at ${logTimestamp.toISOString()}`);

      return {
        employee_id: employeeId,
        equipment_name: eq.name,
        temperature: temperature,
        timestamp: logTimestamp.toISOString(),
        company_id: employeeProfile.company_id,
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
        equipmentLogged: equipment.map(eq => eq.name),
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
