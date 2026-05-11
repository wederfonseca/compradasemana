export default async (request, context) => {

  try {

    /* ================= ENV ================= */

    const env =
      context?.env ||
      (typeof Deno !== "undefined" && Deno.env?.toObject?.()) ||
      {};

    const META_PIXEL_ID = env.META_PIXEL_ID;
    const META_ACCESS_TOKEN = env.META_ACCESS_TOKEN;

    const REDIS_URL = env.UPSTASH_REDIS_REST_URL;
    const REDIS_TOKEN = env.UPSTASH_REDIS_REST_TOKEN;

    if (
      !META_PIXEL_ID ||
      !META_ACCESS_TOKEN ||
      !REDIS_URL ||
      !REDIS_TOKEN
    ) {

      console.error('[CAPI] missing env vars');

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

    /* ================= BODY ================= */

    const body = await request.json().catch(() => null);

    if (!body || !body.event_id) {

      return new Response(
        'Bad Request',
        { status: 400 }
      );

    }

    /* ================= DEDUP ================= */

    const dedupeKey = `capi:event:${body.event_id}`;

    const dedupeCheck = await fetch(
      `${REDIS_URL}/get/${dedupeKey}`,
      {
        headers: {
          Authorization: `Bearer ${REDIS_TOKEN}`
        }
      }
    );

    const dedupeJson = await dedupeCheck.json();

    if (dedupeJson.result !== null) {

      return new Response(
        JSON.stringify({
          ok: true,
          deduped: true
        }),
        { status: 200 }
      );

    }

    // salva por 48h
    await fetch(
      `${REDIS_URL}/set/${dedupeKey}/1?ex=172800`,
      {
        headers: {
          Authorization: `Bearer ${REDIS_TOKEN}`
        }
      }
    );

    /* ================= USER DATA ================= */

    const userData = {

      client_ip_address:
        request.headers.get('x-nf-client-connection-ip') ||
        request.headers.get('x-forwarded-for') ||
        null,

      client_user_agent:
        request.headers.get('user-agent') || null

    };

    if (body.fbp) userData.fbp = body.fbp;
    if (body.fbc) userData.fbc = body.fbc;

    if (body.external_id) {
      userData.external_id = [body.external_id];
    }

    /* ================= META PAYLOAD ================= */

    const capiPayload = {

      data: [

        {

          event_name: 'Lead',

          event_time: Math.floor(Date.now() / 1000),

          event_id: body.event_id,

          event_source_url: body.event_source_url,

          action_source: 'website',

          user_data: userData,

          custom_data: body.custom_data || {}

        }

      ]

    };

    /* ================= SEND META ================= */

    const metaRes = await fetch(

      `https://graph.facebook.com/v18.0/${META_PIXEL_ID}/events?access_token=${META_ACCESS_TOKEN}`,

      {

        method: 'POST',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify(capiPayload)

      }

    );

    console.log(
      `[CAPI] Lead status=${metaRes.status}`
    );

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200 }
    );

  } catch (err) {

    console.error('[CAPI] handler error', err);

    return new Response(
      'Server Error',
      { status: 500 }
    );

  }

};