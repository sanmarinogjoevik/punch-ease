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
    // Run multiple small batches in a loop
    for (let i = 0; i < 50; i++) {
      const result = await sql`
        DELETE FROM cron.job_run_details
        WHERE ctid IN (
          SELECT ctid FROM cron.job_run_details LIMIT 1000
        )
      `;
      totalDeleted += result.count;
      
      // If fewer than 1000 deleted, we're done
      if (result.count < 1000) break;
    }
    
    // Count remaining
    const remaining = await sql`SELECT count(*) as cnt FROM cron.job_run_details`;
    
    await sql.end();
    
    return new Response(JSON.stringify({ 
      success: true,
      totalDeleted,
      remaining: remaining[0].cnt,
      message: "Cleanup complete" 
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
