import { NextResponse } from "next/server";
import { verifyPath } from "@/lib/crypto";
import { localFile } from "@/lib/storage";

// Выдача файлов локального хранилища по подписанной ссылке (15 минут). В продакшне — presigned S3.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const key = u.searchParams.get("key") ?? "";
  if (!verifyPath(key, u.searchParams.get("exp") ?? "", u.searchParams.get("sig") ?? "")) {
    return new NextResponse("Ссылка устарела", { status: 403 });
  }
  try {
    const data = await localFile(key);
    const ext = key.split(".").pop() ?? "";
    const type =
      { svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", pdf: "application/pdf", mp3: "audio/mpeg", wav: "audio/wav", webm: "audio/webm", ogg: "audio/ogg" }[ext] ??
      "application/octet-stream";
    const dl = u.searchParams.get("dl");
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "private, max-age=600",
        "X-Content-Type-Options": "nosniff",
        ...(ext === "svg" ? { "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" } : {}),
        ...(dl ? { "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(dl)}` } : {}),
      },
    });
  } catch {
    return new NextResponse("Не найдено", { status: 404 });
  }
}
