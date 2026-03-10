import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

Deno.serve(async () => {
  const dbUrl = Deno.env.get("SUPABASE_DB_URL")!;
  const sql = postgres(dbUrl, { connect_timeout: 30, idle_timeout: 5, max: 1 });

  try {
    const cronResult = await sql`
      DELETE FROM cron.job_run_details
      WHERE ctid IN (
        SELECT ctid FROM cron.job_run_details LIMIT 10000
      )
    `;
    const httpResult = await sql`
      DELETE FROM net._http_response
      WHERE ctid IN (
        SELECT ctid FROM net._http_response LIMIT 10000
      )
    `;
    await sql.end();
    return new Response(JSON.stringify({ success: true, deleted: result.count }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    try { await sql.end(); } catch {}
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { "Content-Type": "application/json" },
    });
  }
});
