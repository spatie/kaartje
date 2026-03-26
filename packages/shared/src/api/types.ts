export type PostcardStatus = "scanned" | "arriving" | "landed";

export interface Postcard {
  id: string;
  message: string | null;
  senderName: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  frontImageKey: string;
  backImageKey: string | null;
  frontImageUrl: string;
  backImageUrl: string | null;
  status: PostcardStatus;
  createdAt: string;
}

export interface CreatePostcardInput {
  frontImageKey: string;
  backImageKey?: string;
  message?: string;
  senderName?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

export interface PresignInput {
  filename: string;
  contentType: string;
}

export interface PresignResult {
  url: string;
  key: string;
}

export type WsEvent =
  | { event: "card:scanned"; data: { postcard: Postcard } }
  | { event: "card:arriving"; data: { postcardId: string } }
  | { event: "card:landed"; data: { postcardId: string } }
  | { event: "pong" };
