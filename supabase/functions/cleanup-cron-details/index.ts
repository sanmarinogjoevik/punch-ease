import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

Deno.serve(async () => {
  const dbUrl = Deno.env.get("SUPABASE_DB_URL")!;
  
  const sql = postgres(dbUrl, { 
    connect_timeout: 55,
    idle_timeout: 10,
    max: 1,
  });

  try {
    // Very small batch with direct SQL
    const result = await sql`
      DELETE FROM cron.job_run_details
      WHERE ctid IN (
        SELECT ctid FROM cron.job_run_details LIMIT 100
      )
    `;
    
    await sql.end();
    
    return new Response(JSON.stringify({ 
      success: true,
      deleted: result.count,
      message: "Deleted batch" 
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
