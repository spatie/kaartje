import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const bucket = process.env.S3_BUCKET ?? "kaartje-postcards";

export const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
  region: process.env.S3_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "minioadmin",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "minioadmin",
  },
  forcePathStyle: true, // Required for MinIO
});

export async function createPresignedUploadUrl(key: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(s3, command, { expiresIn: 600 }); // 10 minutes
  return url;
}

export async function createPresignedDownloadUrl(key: string) {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(s3, command, { expiresIn: 3600 }); // 1 hour
}

export function getPublicUrl(key: string) {
  // If the key is already an absolute URL, return it directly
  if (key.startsWith("http://") || key.startsWith("https://")) return key;
  // Serve via API proxy — bucket is private, only the server has S3 credentials
  const apiUrl = process.env.PUBLIC_API_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
  const apiKey = process.env.API_KEY;
  const token = apiKey ? `?key=${apiKey}` : "";
  return `${apiUrl}/images/${key}${token}`;
}
