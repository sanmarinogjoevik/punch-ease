import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

Deno.serve(async () => {
  const dbUrl = Deno.env.get("SUPABASE_DB_URL")!;
  
  const sql = postgres(dbUrl, { 
    connect_timeout: 55,
    idle_timeout: 10,
    max: 1,
  });

  let totalDeleted = 0;

  try {
    // Run 10 batches of 500
    for (let i = 0; i < 10; i++) {
      const result = await sql`
        DELETE FROM cron.job_run_details
        WHERE ctid IN (
          SELECT ctid FROM cron.job_run_details LIMIT 500
        )
      `;
      totalDeleted += result.count;
      if (result.count < 500) break;
    }
    
    await sql.end();
    
    return new Response(JSON.stringify({ 
      success: true,
      totalDeleted,
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    await sql.end();
    return new Response(JSON.stringify({ 
      success: false,
      totalDeleted,
      error: error.message 
    }), {
      headers: { "Content-Type": "application/json" },
    });
  }
});
