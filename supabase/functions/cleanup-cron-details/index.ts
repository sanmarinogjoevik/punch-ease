import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

Deno.serve(async () => {
  const dbUrl = Deno.env.get("SUPABASE_DB_URL")!;
  
  const sql = postgres(dbUrl, { 
    connect_timeout: 55,
    idle_timeout: 10,
    max: 1,
  });

  try {
    await sql`TRUNCATE cron.job_run_details`;
    await sql.end();
    
    return new Response(JSON.stringify({ 
      success: true,
      message: "Table truncated successfully" 
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    await sql.end();
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      headers: { "Content-Type": "application/json" },
    });
  }
});
