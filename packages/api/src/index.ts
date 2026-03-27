import {
  listPostcards,
  getPostcard,
  createPostcard,
  updatePostcardStatus,
  deletePostcard,
} from "./routes/postcards";
import { handlePresign } from "./routes/uploads";
import { websocket, broadcast } from "./ws/handler";

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
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
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

      // DEV ONLY: fake postcard broadcast with a public image URL
      if (pathname === "/dev/fake-card" && method === "POST") {
        const body = (await req.json()) as {
          frontImageUrl?: string;
          latitude?: number;
          longitude?: number;
          senderName?: string;
          message?: string;
          country?: string;
        };
        const id = crypto.randomUUID();
        broadcast({
          event: "card:scanned",
          data: {
            postcard: {
              id,
              message: body.message ?? null,
              senderName: body.senderName ?? "Test",
              country: body.country ?? null,
              latitude: body.latitude ?? 51.2194,
              longitude: body.longitude ?? 4.4025,
              frontImageKey: "fake",
              backImageKey: null,
              frontImageUrl: body.frontImageUrl ?? "https://picsum.photos/400/267",
              backImageUrl: null,
              status: "scanned" as const,
              createdAt: new Date().toISOString(),
            },
          },
        });
        return Response.json({ ok: true, id });
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

      // DELETE /postcards/:id
      if (getMatch && method === "DELETE") {
        return deletePostcard(getMatch[1]);
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
