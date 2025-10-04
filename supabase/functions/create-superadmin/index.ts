import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Create the superadmin user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: 'willysmansour@superadmin.com',
      password: 'superadmin123',
      email_confirm: true,
      user_metadata: {
        first_name: 'Willy',
        last_name: 'Mansour'
      }
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User created in auth:', authData.user.id);

    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        user_id: authData.user.id,
        first_name: 'Willy',
        last_name: 'Mansour',
        email: 'willysmansour@superadmin.com',
        company_id: '00000000-0000-0000-0000-000000000000' // Dummy company_id for superadmin
      });

    if (profileError) {
      console.error('Error creating profile:', profileError);
      return new Response(
        JSON.stringify({ error: profileError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Profile created for user:', authData.user.id);

    // Assign superadmin role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: 'superadmin'
      });

    if (roleError) {
      console.error('Error assigning role:', roleError);
      return new Response(
        JSON.stringify({ error: roleError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Superadmin role assigned to user:', authData.user.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Superadmin user created successfully',
        user: {
          id: authData.user.id,
          email: authData.user.email
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
