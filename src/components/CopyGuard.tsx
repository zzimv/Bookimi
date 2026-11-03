"use client";
// Мягкая защита от копирования (rev 19) — подробности и что сознательно НЕ делаем: src/lib/protect.ts.
import { useEffect } from "react";
import { installCopyGuard } from "@/lib/protect";

export function CopyGuard() {
  useEffect(() => installCopyGuard(), []);
  return null;
}
