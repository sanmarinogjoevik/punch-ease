import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

Deno.serve(async () => {
  const dbUrl = Deno.env.get("SUPABASE_DB_URL")!;
  
  const sql = postgres(dbUrl, { 
    connect_timeout: 30,
    idle_timeout: 5,
    max: 1,
  });

  let totalDeleted = 0;

  try {
    // 5 batches of 500 - should complete within 60s
    for (let i = 0; i < 5; i++) {
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
    
    return new Response(JSON.stringify({ success: true, totalDeleted }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    try { await sql.end(); } catch {}
    return new Response(JSON.stringify({ success: false, totalDeleted, error: error.message }), {
      headers: { "Content-Type": "application/json" },
    });
  }
});
