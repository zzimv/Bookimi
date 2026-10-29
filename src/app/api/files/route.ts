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
      { svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", pdf: "application/pdf", mp3: "audio/mpeg", wav: "audio/wav", webm: "audio/webm", ogg: "audio/ogg", mp4: "video/mp4", m4a: "audio/mp4", aac: "audio/aac" }[ext] ??
      "application/octet-stream";
    const dl = u.searchParams.get("dl");
    // Видео и аудио: частичная выдача (Range) — плеер в Safari иначе не начинает воспроизведение и не перематывает
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
    if (range && (range[1] || range[2])) {
      const size = data.length;
      const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(size - 1, Number(range[2])) : size - 1;
      if (start >= size || start > end) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      return new NextResponse(new Uint8Array(data.subarray(start, end + 1)), {
        status: 206,
        headers: {
          "Content-Type": type,
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(end - start + 1),
          "Cache-Control": "private, max-age=600",
          "X-Content-Type-Options": "nosniff",
          "X-Robots-Tag": "noindex, nofollow",
        },
      });
    }
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Accept-Ranges": "bytes",
        "X-Robots-Tag": "noindex, nofollow",
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
