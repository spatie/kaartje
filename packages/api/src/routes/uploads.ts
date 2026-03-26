import { createPresignedUploadUrl } from "../storage/s3";

export async function handlePresign(req: Request): Promise<Response> {
  const body = await req.json();
  const { filename, contentType } = body as {
    filename: string;
    contentType: string;
  };

  if (!filename || !contentType) {
    return Response.json({ error: "filename and contentType are required" }, { status: 400 });
  }

  const ext = filename.split(".").pop() ?? "jpg";
  const key = `postcards/${crypto.randomUUID()}.${ext}`;
  const url = await createPresignedUploadUrl(key, contentType);

  return Response.json({ url, key });
}
