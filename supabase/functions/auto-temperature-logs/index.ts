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
      // Fallback: get the most recent employee from any temperature log
      console.log('No punch-in data provided, using fallback employee');
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
      logTimestamp = new Date();
      console.log(`Using fallback: employee ${employeeId} at current time`);
    }

    // Generate temperature logs
    const logsToCreate = equipment.map(eq => {
      let temperature: number;
      
      if (eq.type === 'refrigerator') {
        // Kyl: 0.0 to 8.0°C
        temperature = Math.random() * 8; // Generates 0 to 8
      } else if (eq.type === 'freezer') {
        // Frys: -22.0 to -18.0°C
        temperature = Math.random() * 4 - 22; // Generates -22 to -18
      } else {
        // Default to fridge temperatures for unknown types
        temperature = Math.random() * 8;
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
