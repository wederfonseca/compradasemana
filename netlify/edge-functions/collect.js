export default async (request, context) => {

  try {

    /* ================= ENV ================= */

    const env =
      context?.env ||
      (typeof Deno !== "undefined" && Deno.env?.toObject?.()) ||
      {};

    const REDIS_URL = env.UPSTASH_REDIS_REST_URL;
    const REDIS_TOKEN = env.UPSTASH_REDIS_REST_TOKEN;

    if (!REDIS_URL || !REDIS_TOKEN) {

      console.log('[ERR] → missing env vars');

      return new Response(
        'Server Misconfigured',
        { status: 500 }
      );

    }

    /* ================= METHOD ================= */

    if (request.method !== 'POST') {

      return new Response(
        'Method Not Allowed',
        { status: 405 }
      );

    }

    /* ================= SECURITY ================= */

    if (request.headers.get('x-capi-signature') !== 'v1') {

      return new Response(
        'Forbidden',
        { status: 403 }
      );

    }

    /* ================= COUNTER ================= */

    const today = new Date()
      .toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
      .split('/')
      .reverse()
      .join('-');

    const counterKey = `click:counter:${today}`;

    const counterRes = await fetch(

      `${REDIS_URL}/incr/${counterKey}`,

      {
        headers: {
          Authorization: `Bearer ${REDIS_TOKEN}`
        }
      }

    );

    const counterJson = await counterRes.json();
    const dailyCount = counterJson.result || 0;

    /* ================= LOG ================= */

    console.log(`[${dailyCount}] → click`);

    /* ================= RESPONSE ================= */

    return new Response(

      JSON.stringify({ ok: true }),

      { status: 200 }

    );

  } catch (err) {

    console.log(`[ERR] → ${err.message}`);

    return new Response(
      'Server Error',
      { status: 500 }
    );

  }

};
