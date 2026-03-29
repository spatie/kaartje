import {
  listPostcards,
  getPostcard,
  createPostcard,
  updatePostcardStatus,
  deletePostcard,
} from "./routes/postcards";
import { handlePresign, handleUpload } from "./routes/uploads";
import { websocket, broadcast } from "./ws/handler";

const port = Number(process.env.PORT) || 3000;
const API_KEY = process.env.API_KEY;

// Routes that require API key authentication
const PROTECTED_PREFIXES = ["/postcards", "/uploads", "/images/"];

function requiresAuth(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isAuthorized(req: Request): boolean {
  if (!API_KEY) return true; // No key configured = no auth (local dev)
  // Check header (API/fetch calls)
  const header = req.headers.get("X-API-Key");
  if (header === API_KEY) return true;
  // Check query param (for <img> tags that can't set headers)
  const url = new URL(req.url);
  const queryKey = url.searchParams.get("key");
  return queryKey === API_KEY;
}

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
      "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
    };

    // Preflight
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // API key check for protected routes
    if (requiresAuth(pathname) && !isAuthorized(req)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
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

      // POST /uploads — direct upload with AVIF conversion
      if (pathname === "/uploads" && method === "POST") {
        return handleUpload(req);
      }

      // GET /images/* — proxy S3 images with authentication
      if (pathname.startsWith("/images/") && method === "GET") {
        const key = decodeURIComponent(pathname.slice("/images/".length));
        try {
          const { GetObjectCommand } = await import("@aws-sdk/client-s3");
          const { s3 } = await import("./storage/s3");
          const command = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET ?? "kaartje-postcards",
            Key: key,
          });
          const response = await s3.send(command);
          const body = response.Body;
          if (!body) {
            return Response.json({ error: "Image not found" }, { status: 404 });
          }
          return new Response(body as ReadableStream, {
            headers: {
              "Content-Type": response.ContentType ?? "image/avif",
              "Content-Length": String(response.ContentLength ?? ""),
              "Cache-Control": "public, max-age=31536000, immutable",
            },
          });
        } catch (err: any) {
          if (err?.name === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404) {
            return Response.json({ error: "Image not found" }, { status: 404 });
          }
          console.warn(`[images] Error fetching ${key}:`, err?.message);
          return Response.json({ error: "Image not found" }, { status: 404 });
        }
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
