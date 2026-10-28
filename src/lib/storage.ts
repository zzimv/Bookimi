// Хранилище файлов: Yandex Object Storage (S3) в продакшне, локальная папка — для разработки.
// Бакеты: photos (lifecycle 7 дней), books (PDF, иллюстрации, аудио), backups.
// Наружу файлы отдаются только по подписанным ссылкам на 15 минут.
import { mkdir, readFile, rm, writeFile, stat } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { signPath } from "./crypto";

export type Bucket = "photos" | "books";

const bucketName = (b: Bucket) =>
  b === "photos" ? process.env.S3_BUCKET_PHOTOS ?? "bookimi-photos" : process.env.S3_BUCKET_BOOKS ?? "bookimi-books";

const driver = () => (process.env.STORAGE_DRIVER === "local" || !process.env.S3_ACCESS_KEY ? "local" : "s3");
const LOCAL_ROOT = process.env.LOCAL_STORAGE_DIR ?? join(process.cwd(), "storage");

function localPath(bucket: Bucket, key: string) {
  const p = normalize(join(LOCAL_ROOT, bucket, key));
  if (!p.startsWith(normalize(join(LOCAL_ROOT, bucket)))) throw new Error("bad key");
  return p;
}

let s3: import("@aws-sdk/client-s3").S3Client | null = null;
async function client() {
  if (!s3) {
    const { S3Client } = await import("@aws-sdk/client-s3");
    s3 = new S3Client({
      region: process.env.S3_REGION ?? "ru-central1",
      endpoint: process.env.S3_ENDPOINT ?? "https://storage.yandexcloud.net",
      credentials: { accessKeyId: process.env.S3_ACCESS_KEY!, secretAccessKey: process.env.S3_SECRET_KEY! },
    });
  }
  return s3;
}

export async function putFile(bucket: Bucket, key: string, body: Buffer, contentType: string) {
  if (driver() === "local") {
    const p = localPath(bucket, key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, body);
    return key;
  }
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  await (await client()).send(new PutObjectCommand({ Bucket: bucketName(bucket), Key: key, Body: body, ContentType: contentType }));
  return key;
}

export async function getFile(bucket: Bucket, key: string): Promise<Buffer> {
  if (driver() === "local") return readFile(localPath(bucket, key));
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const r = await (await client()).send(new GetObjectCommand({ Bucket: bucketName(bucket), Key: key }));
  return Buffer.from(await r.Body!.transformToByteArray());
}

export async function fileExists(bucket: Bucket, key: string) {
  if (driver() === "local") return stat(localPath(bucket, key)).then(() => true, () => false);
  try {
    const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
    await (await client()).send(new HeadObjectCommand({ Bucket: bucketName(bucket), Key: key }));
    return true;
  } catch {
    return false;
  }
}

export async function deleteFile(bucket: Bucket, key: string) {
  if (driver() === "local") return rm(localPath(bucket, key), { force: true });
  const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  await (await client()).send(new DeleteObjectCommand({ Bucket: bucketName(bucket), Key: key }));
}

/** Подписанная ссылка на 15 минут. Для S3 — presigned URL, для локального — /api/files с подписью. */
export async function signedUrl(bucket: Bucket, key: string, ttl = 900, downloadName?: string) {
  if (driver() === "local") return signPath(`${bucket}/${key}`, ttl) + (downloadName ? `&dl=${encodeURIComponent(downloadName)}` : "");
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  return getSignedUrl(
    await client(),
    new GetObjectCommand({
      Bucket: bucketName(bucket),
      Key: key,
      ResponseContentDisposition: downloadName ? `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}` : undefined,
    }),
    { expiresIn: ttl },
  );
}

export function localFile(fullKey: string) {
  const [bucket, ...rest] = fullKey.split("/");
  if (bucket !== "photos" && bucket !== "books") throw new Error("bad bucket");
  return readFile(localPath(bucket, rest.join("/")));
}
