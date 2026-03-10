import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    db: { schema: "cron" },
  });

  // Try direct SQL via rest endpoint
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/delete_old_job_run_details_batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceRoleKey}`,
      "apikey": serviceRoleKey,
    },
    body: JSON.stringify({ batch_size: 500, older_than: "1 second" }),
  });

  const result = await response.json();
  
  return new Response(JSON.stringify({ 
    status: response.status,
    result,
    message: "Cleanup attempted" 
  }), {
    headers: { "Content-Type": "application/json" },
  });
});
