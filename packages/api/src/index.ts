import {
  listPostcards,
  getPostcard,
  createPostcard,
  updatePostcardStatus,
} from "./routes/postcards";
import { handlePresign } from "./routes/uploads";
import { websocket } from "./ws/handler";

const port = Number(process.env.PORT) || 3000;

const server = Bun.serve({
  port,

  fetch(req, server) {
    const url = new URL(req.url);
    const { pathname } = url;
    const method = req.method;

    // WebSocket upgrade
    if (pathname === "/ws") {
      const upgraded = server.upgrade(req, { data: {} });
      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      return undefined as unknown as Response;
    }

    // CORS headers for all responses
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Preflight
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Route matching
    const respond = async (): Promise<Response> => {
      // Health check
      if (pathname === "/health" && method === "GET") {
        return Response.json({ status: "ok" });
      }

      // POST /uploads/presign
      if (pathname === "/uploads/presign" && method === "POST") {
        return handlePresign(req);
      }

      // GET /postcards
      if (pathname === "/postcards" && method === "GET") {
        return listPostcards(req);
      }

      // POST /postcards
      if (pathname === "/postcards" && method === "POST") {
        return createPostcard(req);
      }

      // GET /postcards/:id
      const getMatch = pathname.match(/^\/postcards\/([^/]+)$/);
      if (getMatch && method === "GET") {
        return getPostcard(getMatch[1]);
      }

      // PATCH /postcards/:id/status
      const statusMatch = pathname.match(/^\/postcards\/([^/]+)\/status$/);
      if (statusMatch && method === "PATCH") {
        return updatePostcardStatus(statusMatch[1], req);
      }

      return Response.json({ error: "Not Found" }, { status: 404 });
    };

    return respond().then((res) => {
      // Attach CORS headers to every response
      const headers = new Headers(res.headers);
      for (const [key, value] of Object.entries(corsHeaders)) {
        headers.set(key, value);
      }
      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers,
      });
    });
  },

  websocket,
});

console.log(`API running at http://localhost:${server.port}`);
