function unavailable(status, code) {
  return Response.json(
    { ok: false, error: code },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      }
    }
  );
}

export async function onRequest(context) {
  const upstream = context && context.env && context.env.FARMULTIMATE_API;
  if (!upstream || typeof upstream.fetch !== "function") {
    return unavailable(503, "API_SERVICE_UNAVAILABLE");
  }

  try {
    return await upstream.fetch(context.request);
  } catch (error) {
    return unavailable(502, "API_UPSTREAM_FAILED");
  }
}
