import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is superadmin
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || roleData?.role !== 'superadmin') {
      console.error('Role check failed:', roleError);
      return new Response(
        JSON.stringify({ error: 'Only superadmins can create companies' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { 
      companyName, 
      email, 
      phone, 
      address, 
      postalCode, 
      city, 
      orgNumber,
      adminEmail,
      adminPassword,
      adminFirstName,
      adminLastName,
      tenantUsername,
      tenantPassword
    } = await req.json();

    // Validate required fields
    if (!companyName || !adminEmail || !adminPassword || !adminFirstName || !adminLastName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Creating company:', companyName);

    // Create company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({
        name: companyName,
        email,
        phone,
        address,
        postal_code: postalCode,
        city,
        org_number: orgNumber
      })
      .select()
      .single();

    if (companyError) {
      console.error('Company creation error:', companyError);
      return new Response(
        JSON.stringify({ error: 'Failed to create company', details: companyError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Company created:', company.id);

    // Hash tenant password if provided
    let tenantPasswordHash = null;
    if (tenantUsername && tenantPassword) {
      const { data: hashData, error: hashError } = await supabase.functions.invoke(
        'hash-tenant-password',
        {
          body: { password: tenantPassword }
        }
      );

      if (!hashError && hashData?.hash) {
        tenantPasswordHash = hashData.hash;
      }
    }

    // Create company settings
    const { error: settingsError } = await supabase
      .from('company_settings')
      .insert({
        company_id: company.id,
        company_name: companyName,
        email,
        phone,
        address,
        postal_code: postalCode,
        city,
        org_number: orgNumber,
        tenant_username: tenantUsername || null,
        tenant_password_hash: tenantPasswordHash
      });

    if (settingsError) {
      console.error('Settings creation error:', settingsError);
      // Don't fail the whole operation, just log
    }

    // Create admin user
    const { data: authData, error: authCreateError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        first_name: adminFirstName,
        last_name: adminLastName
      }
    });

    if (authCreateError) {
      console.error('Admin user creation error:', authCreateError);
      return new Response(
        JSON.stringify({ error: 'Failed to create admin user', details: authCreateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Admin user created:', authData.user?.id);

    // Update profile with company_id
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ company_id: company.id })
      .eq('user_id', authData.user!.id);

    if (profileError) {
      console.error('Profile update error:', profileError);
    }

    // Update user role to admin
    const { error: roleUpdateError } = await supabase
      .from('user_roles')
      .update({ role: 'admin' })
      .eq('user_id', authData.user!.id);

    if (roleUpdateError) {
      console.error('Role update error:', roleUpdateError);
      return new Response(
        JSON.stringify({ error: 'Failed to set admin role', details: roleUpdateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Company setup complete');

    return new Response(
      JSON.stringify({
        success: true,
        company_id: company.id,
        company_name: companyName,
        admin_email: adminEmail
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});