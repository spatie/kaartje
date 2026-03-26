import type {
  Postcard,
  PostcardStatus,
  CreatePostcardInput,
  PresignInput,
  PresignResult,
  WsEvent,
} from "./types";

export interface ApiClientOptions {
  baseUrl: string;
}

export class ApiClient {
  private baseUrl: string;

  constructor({ baseUrl }: ApiClientOptions) {
    // Strip trailing slash
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  // ---------------------------------------------------------------------------
  // HTTP helpers
  // ---------------------------------------------------------------------------

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const message = (body as any)?.error ?? res.statusText;
      throw new ApiError(res.status, message);
    }

    return res.json() as Promise<T>;
  }

  // ---------------------------------------------------------------------------
  // Postcards
  // ---------------------------------------------------------------------------

  async listPostcards(status?: PostcardStatus): Promise<Postcard[]> {
    const query = status ? `?status=${status}` : "";
    return this.request<Postcard[]>(`/postcards${query}`);
  }

  async getPostcard(id: string): Promise<Postcard> {
    return this.request<Postcard>(`/postcards/${id}`);
  }

  async createPostcard(input: CreatePostcardInput): Promise<Postcard> {
    return this.request<Postcard>("/postcards", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async updatePostcardStatus(id: string, status: "arriving" | "landed"): Promise<Postcard> {
    return this.request<Postcard>(`/postcards/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }

  // ---------------------------------------------------------------------------
  // Uploads
  // ---------------------------------------------------------------------------

  async presignUpload(input: PresignInput): Promise<PresignResult> {
    return this.request<PresignResult>("/uploads/presign", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  // ---------------------------------------------------------------------------
  // WebSocket
  // ---------------------------------------------------------------------------

  connectWebSocket(options: {
    onEvent: (event: WsEvent) => void;
    onError?: (error: Event) => void;
    onClose?: () => void;
  }): WebSocketConnection {
    const wsUrl = this.baseUrl.replace(/^http/, "ws") + "/ws";
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data as string) as WsEvent;
        options.onEvent(event);
      } catch {
        // Ignore malformed messages
      }
    };

    if (options.onError) ws.onerror = options.onError;
    if (options.onClose) ws.onclose = options.onClose;

    return new WebSocketConnection(ws);
  }
}

export class WebSocketConnection {
  constructor(private ws: WebSocket) {}

  ping() {
    this.send({ event: "ping" });
  }

  send(data: unknown) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  close() {
    this.ws.close();
  }

  get readyState() {
    return this.ws.readyState;
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
