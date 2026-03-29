import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { postcards } from "../db/schema";
import type { NewPostcard } from "../db/schema";
import { getPublicUrl } from "../storage/s3";
import { broadcast } from "../ws/handler";
import { coordsForCountry } from "../geo";

export async function listPostcards(_req: Request): Promise<Response> {
  const url = new URL(_req.url);
  const status = url.searchParams.get("status");

  const rows = status
    ? await db
        .select()
        .from(postcards)
        .where(eq(postcards.status, status as "scanned" | "arriving" | "landed"))
    : await db.select().from(postcards);

  const result = rows.map((row) => ({
    id: row.id,
    frontImageUrl: getPublicUrl(row.frontImageKey),
    latitude: row.latitude != null ? Math.round(row.latitude * 100) / 100 : null,
    longitude: row.longitude != null ? Math.round(row.longitude * 100) / 100 : null,
    senderName: row.senderName,
    message: row.message,
    country: row.country,
  }));

  return Response.json(result);
}

export async function getPostcard(id: string): Promise<Response> {
  const [row] = await db.select().from(postcards).where(eq(postcards.id, id));

  if (!row) {
    return Response.json({ error: "Postcard not found" }, { status: 404 });
  }

  return Response.json({
    id: row.id,
    frontImageUrl: getPublicUrl(row.frontImageKey),
    latitude: row.latitude != null ? Math.round(row.latitude * 100) / 100 : null,
    longitude: row.longitude != null ? Math.round(row.longitude * 100) / 100 : null,
    senderName: row.senderName,
    message: row.message,
    country: row.country,
  });
}

export async function createPostcard(req: Request): Promise<Response> {
  const body = (await req.json()) as {
    frontImageKey: string;
    backImageKey?: string;
    message?: string;
    senderName?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };

  if (!body.frontImageKey) {
    return Response.json({ error: "frontImageKey is required" }, { status: 400 });
  }

  // Fall back to country-based coords, then Antwerp as default
  let { latitude, longitude } = body;
  if (latitude == null || longitude == null) {
    const coords = body.country ? coordsForCountry(body.country) : null;
    if (coords) {
      latitude = coords.latitude;
      longitude = coords.longitude;
    } else {
      // Default to Spatie HQ in Antwerp
      latitude = 51.2194;
      longitude = 4.4025;
    }
  }

  const id = crypto.randomUUID();
  const newPostcard: NewPostcard = {
    id,
    frontImageKey: body.frontImageKey,
    backImageKey: body.backImageKey ?? null,
    message: body.message ?? null,
    senderName: body.senderName ?? null,
    country: body.country ?? null,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    status: "scanned",
  };

  await db.insert(postcards).values(newPostcard);

  const [created] = await db.select().from(postcards).where(eq(postcards.id, id));

  const publicPostcard = {
    id: created.id,
    frontImageUrl: getPublicUrl(created.frontImageKey),
    latitude: created.latitude != null ? Math.round(created.latitude * 100) / 100 : null,
    longitude: created.longitude != null ? Math.round(created.longitude * 100) / 100 : null,
    senderName: created.senderName,
    message: created.message,
    country: created.country,
  };

  broadcast({
    event: "card:scanned",
    data: { postcard: publicPostcard },
  });

  return Response.json(publicPostcard, { status: 201 });
}

export async function updatePostcardStatus(id: string, req: Request): Promise<Response> {
  const body = (await req.json()) as { status: "arriving" | "landed" };

  if (!body.status || !["arriving", "landed"].includes(body.status)) {
    return Response.json({ error: 'status must be "arriving" or "landed"' }, { status: 400 });
  }

  const [existing] = await db.select().from(postcards).where(eq(postcards.id, id));

  if (!existing) {
    return Response.json({ error: "Postcard not found" }, { status: 404 });
  }

  await db.update(postcards).set({ status: body.status }).where(eq(postcards.id, id));

  const event = body.status === "arriving" ? "card:arriving" : "card:landed";
  broadcast({ event, data: { postcardId: id } });

  return Response.json({ ...existing, status: body.status });
}

export async function deletePostcard(id: string): Promise<Response> {
  const [existing] = await db.select().from(postcards).where(eq(postcards.id, id));

  if (!existing) {
    return Response.json({ error: "Postcard not found" }, { status: 404 });
  }

  await db.delete(postcards).where(eq(postcards.id, id));
  return Response.json({ deleted: true });
}
