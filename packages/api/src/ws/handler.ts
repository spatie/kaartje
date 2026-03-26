import type { ServerWebSocket } from "bun";
import type { Postcard } from "../db/schema";

const clients = new Set<ServerWebSocket<unknown>>();

export type WsEvent =
  | { event: "card:scanned"; data: { postcard: Postcard } }
  | { event: "card:arriving"; data: { postcardId: string } }
  | { event: "card:landed"; data: { postcardId: string } };

export function broadcast(message: WsEvent) {
  const payload = JSON.stringify(message);
  for (const client of clients) {
    client.send(payload);
  }
}

export const websocket = {
  open(ws: ServerWebSocket<unknown>) {
    clients.add(ws);
  },

  message(ws: ServerWebSocket<unknown>, message: string | Buffer) {
    const text = typeof message === "string" ? message : message.toString();

    try {
      const parsed = JSON.parse(text);
      if (parsed.event === "ping") {
        ws.send(JSON.stringify({ event: "pong" }));
      }
    } catch {
      // Ignore malformed messages
    }
  },

  close(ws: ServerWebSocket<unknown>) {
    clients.delete(ws);
  },
};
