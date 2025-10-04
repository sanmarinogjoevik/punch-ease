import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as bcrypt from "https://esm.sh/bcryptjs@2.4.3";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return new Response(
        JSON.stringify({ error: 'Username and password are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create Supabase client with service role to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get company settings by tenant username
    const { data: settings, error: fetchError } = await supabase
      .from('company_settings')
      .select('id, company_id, tenant_password_hash')
      .eq('tenant_username', username)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching company settings:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Database error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!settings || !settings.tenant_password_hash) {
      console.log('No tenant found with username:', username);
      return new Response(
        JSON.stringify({ valid: false }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verify password
    const isValid = await bcrypt.compare(password, settings.tenant_password_hash);

    console.log('Password verification:', isValid ? 'success' : 'failed', 'for username:', username);

    return new Response(
      JSON.stringify({ 
        valid: isValid,
        companyId: isValid ? settings.company_id : undefined,
        tenantId: isValid ? settings.id : undefined,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error in verify-tenant-password:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
