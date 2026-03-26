# @kaartje/api

Bun HTTP server with WebSockets that bridges the mobile scanner app and the web globe viewer. Stores postcard data in Turso (libSQL), handles image uploads via presigned URLs to S3-compatible storage (MinIO locally), and pushes real-time events over WebSockets.

## Prerequisites

- [Bun](https://bun.sh) installed
- [Docker](https://docs.docker.com/get-docker/) for local services (MinIO + libSQL)

## Getting started

```bash
# From the repo root
docker compose up -d          # Start MinIO + libSQL
npm run db:migrate --workspace=@kaartje/api   # Run database migrations
npm run dev:api               # Start the dev server (port 3000)
```

Copy `.env.example` to `.env` to customize settings. The defaults work out of the box with Docker Compose.

## Services (Docker Compose)

| Service       | Port                       | Purpose                        |
| ------------- | -------------------------- | ------------------------------ |
| MinIO         | 9000 (API), 9001 (console) | S3-compatible file storage     |
| libSQL (sqld) | 8080                       | Turso-compatible SQLite server |

MinIO console is available at `http://localhost:9001` (login: `minioadmin` / `minioadmin`).

## API endpoints

### Health

```
GET /health
```

Returns `{ "status": "ok" }`.

### Postcards

```
GET    /postcards              # List all postcards (optional ?status=scanned|arriving|landed)
GET    /postcards/:id          # Get a single postcard
POST   /postcards              # Create a new postcard
PATCH  /postcards/:id/status   # Update postcard status
```

#### Create a postcard

```bash
curl -X POST http://localhost:3000/postcards \
  -H "Content-Type: application/json" \
  -d '{
    "frontImageKey": "postcards/abc123.jpg",
    "backImageKey": "postcards/def456.jpg",
    "message": "Greetings from Antwerp!",
    "senderName": "Nick",
    "country": "Belgium",
    "latitude": 51.22,
    "longitude": 4.40
  }'
```

`latitude` and `longitude` are optional — if omitted, the server derives approximate coordinates from the `country` field.

#### Update postcard status

```bash
curl -X PATCH http://localhost:3000/postcards/<id>/status \
  -H "Content-Type: application/json" \
  -d '{ "status": "arriving" }'
```

Status transitions: `scanned` → `arriving` → `landed`. Each update broadcasts a WebSocket event.

### Uploads

```
POST /uploads/presign
```

Generates a presigned PUT URL for uploading an image directly to MinIO/S3.

```bash
curl -X POST http://localhost:3000/uploads/presign \
  -H "Content-Type: application/json" \
  -d '{ "filename": "front.jpg", "contentType": "image/jpeg" }'
```

Response:

```json
{
  "url": "http://localhost:9000/kaartje-postcards/postcards/uuid.jpg?X-Amz-...",
  "key": "postcards/uuid.jpg"
}
```

Upload the file directly to the returned `url` with a PUT request, then use the `key` when creating the postcard.

## WebSocket

Connect to `ws://localhost:3000/ws` to receive real-time events.

### Events (server → client)

```json
{ "event": "card:scanned",  "data": { "postcard": { ... } } }
{ "event": "card:arriving", "data": { "postcardId": "..." } }
{ "event": "card:landed",   "data": { "postcardId": "..." } }
```

### Keep-alive (client → server)

```json
{ "event": "ping" }
```

Server responds with `{ "event": "pong" }`.

## Database

Uses [Drizzle ORM](https://orm.drizzle.team) with Turso (libSQL). Schema is defined in `src/db/schema.ts`.

```bash
npm run db:generate --workspace=@kaartje/api   # Generate a new migration after schema changes
npm run db:migrate --workspace=@kaartje/api    # Apply migrations
npm run db:studio --workspace=@kaartje/api     # Open Drizzle Studio (DB browser)
```

## Environment variables

| Variable               | Default                 | Description                                            |
| ---------------------- | ----------------------- | ------------------------------------------------------ |
| `PORT`                 | `3000`                  | Server port                                            |
| `TURSO_DATABASE_URL`   | `http://127.0.0.1:8080` | libSQL / Turso database URL                            |
| `TURSO_AUTH_TOKEN`     | (empty)                 | Auth token (empty for local, required for Turso cloud) |
| `S3_ENDPOINT`          | `http://localhost:9000` | S3-compatible storage endpoint                         |
| `S3_REGION`            | `us-east-1`             | S3 region                                              |
| `S3_BUCKET`            | `kaartje-postcards`     | Bucket name                                            |
| `S3_ACCESS_KEY_ID`     | `minioadmin`            | S3 access key                                          |
| `S3_SECRET_ACCESS_KEY` | `minioadmin`            | S3 secret key                                          |

## File structure

```
src/
├── index.ts            # Bun.serve() entry — routing, CORS, WS upgrade
├── geo.ts              # Country → lat/lng fallback lookup
├── db/
│   ├── client.ts       # libSQL connection + Drizzle instance
│   ├── schema.ts       # Drizzle table definitions
│   └── migrations/     # Generated SQL migrations
├── routes/
│   ├── postcards.ts    # Postcard CRUD handlers
│   └── uploads.ts      # Presigned URL generation
├── storage/
│   └── s3.ts           # S3/MinIO client + presigned URL helpers
└── ws/
    └── handler.ts      # WebSocket connection registry + broadcast
```
