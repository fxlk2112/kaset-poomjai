import { onRequest } from "../functions/api/[[path]].js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/") || url.pathname.startsWith("/photo/")) {
      let upstreamRequest = request;
      if (url.pathname === "/api/health" && request.method === "GET") {
        upstreamRequest = new Request(request.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "health" })
        });
      }
      const upstream = await onRequest({ request: upstreamRequest, env });
      const response = new Response(upstream.body, upstream);
      response.headers.set("Cache-Control", "no-store");
      response.headers.set("X-Content-Type-Options", "nosniff");
      return response;
    }
    return env.ASSETS.fetch(request);
  }
};
