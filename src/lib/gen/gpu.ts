// Управление GPU-сервером в Yandex Cloud: включение по требованию, выключение после простоя,
// режим «по расписанию в пик», учёт минут. Сервер генерации — tools/gpu-server (FastAPI + Qwen).
import { createSign } from "node:crypto";
import { db } from "../db";
import { cfg, getSetting, saveSetting } from "../settings";

interface GpuState {
  status: "off" | "starting" | "up" | "stopping";
  startedAt?: string;
  lastUsedAt?: string;
}

const STATE_KEY = "gpu.state";
export const getGpuState = () => getSetting<GpuState>(STATE_KEY, { status: "off" });
const setState = (s: GpuState) => saveSetting(STATE_KEY, s);

// ── IAM-токен: из YC_IAM_TOKEN или по ключу сервисного аккаунта (YC_SA_KEY_JSON) ──
let iamCache: { token: string; exp: number } | null = null;

async function iamToken() {
  if (process.env.YC_IAM_TOKEN) return process.env.YC_IAM_TOKEN;
  if (iamCache && iamCache.exp > Date.now() + 60_000) return iamCache.token;
  const raw = process.env.YC_SA_KEY_JSON;
  if (!raw) throw new Error("GPU: не задан YC_SA_KEY_JSON (ключ сервисного аккаунта) или YC_IAM_TOKEN");
  const key = JSON.parse(raw) as { id: string; service_account_id: string; private_key: string };
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = b64({ typ: "JWT", alg: "PS256", kid: key.id });
  const body = b64({ iss: key.service_account_id, aud: "https://iam.api.cloud.yandex.net/iam/v1/tokens", iat: now, exp: now + 3600 });
  const sign = createSign("RSA-SHA256");
  sign.update(`${head}.${body}`);
  const sig = sign.sign({ key: key.private_key, padding: 6 /* RSA_PKCS1_PSS_PADDING */, saltLength: 32 }).toString("base64url");
  const r = await fetch("https://iam.api.cloud.yandex.net/iam/v1/tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jwt: `${head}.${body}.${sig}` }),
  });
  if (!r.ok) throw new Error(`IAM ${r.status}`);
  const j = (await r.json()) as { iamToken: string };
  iamCache = { token: j.iamToken, exp: Date.now() + 11 * 3600_000 };
  return j.iamToken;
}

async function compute(action: "start" | "stop") {
  const id = process.env.GPU_INSTANCE_ID;
  if (!id) return; // сервер включается вручную или работает постоянно
  const r = await fetch(`https://compute.api.cloud.yandex.net/compute/v1/instances/${id}:${action}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await iamToken()}` },
  });
  if (!r.ok && r.status !== 409) throw new Error(`Compute ${action}: ${r.status} ${(await r.text()).slice(0, 200)}`);
}

export async function gpuHealthy() {
  const url = process.env.GPU_SERVER_URL;
  if (!url) return false;
  try {
    const r = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000), headers: authHeader() });
    return r.ok;
  } catch {
    return false;
  }
}

export const authHeader = (): Record<string, string> =>
  process.env.GPU_INFERENCE_TOKEN ? { Authorization: `Bearer ${process.env.GPU_INFERENCE_TOKEN}` } : {};

/** Гарантирует, что сервер работает. Ждёт до 15 минут (загрузка ВМ и весов модели). */
export async function ensureGpuUp() {
  if (await gpuHealthy()) {
    await touchGpu();
    return;
  }
  const st = await getGpuState();
  if (st.status !== "starting") {
    await compute("start");
    await setState({ status: "starting", startedAt: new Date().toISOString(), lastUsedAt: new Date().toISOString() });
  }
  const deadline = Date.now() + 15 * 60_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 10_000));
    if (await gpuHealthy()) {
      await setState({ status: "up", startedAt: st.startedAt ?? new Date().toISOString(), lastUsedAt: new Date().toISOString() });
      return;
    }
  }
  throw new Error("GPU-сервер не запустился за 15 минут");
}

export async function touchGpu() {
  const st = await getGpuState();
  await setState({ ...st, status: "up", startedAt: st.startedAt ?? new Date().toISOString(), lastUsedAt: new Date().toISOString() });
}

function inSchedule(g: Awaited<ReturnType<typeof cfg<"gpu">>>, now = new Date()) {
  const msk = new Date(now.getTime() + 3 * 3600_000);
  const month = msk.getUTCMonth() + 1;
  if (g.scheduleMonths.length && !g.scheduleMonths.includes(month)) return false;
  const hm = msk.toISOString().slice(11, 16);
  return hm >= g.scheduleFrom && hm < g.scheduleTo;
}

/**
 * Каждые 5 минут: выключить после простоя (режим «по требованию»), держать включённым в часы пик
 * (режим «по расписанию»), учесть время работы в расходах.
 */
export async function gpuTick() {
  const g = await cfg("gpu");
  const st = await getGpuState();
  const now = Date.now();
  const wantAlwaysOn = g.mode === "always" || (g.mode === "schedule" && inSchedule(g));
  if (wantAlwaysOn && st.status === "off" && process.env.GPU_INSTANCE_ID) {
    await compute("start");
    await setState({ status: "starting", startedAt: new Date().toISOString(), lastUsedAt: new Date().toISOString() });
    return;
  }
  if (st.status !== "up" && st.status !== "starting") return;
  const idleMin = (now - Date.parse(st.lastUsedAt ?? st.startedAt ?? new Date().toISOString())) / 60_000;
  const busy = await db.book.count({ where: { status: { in: ["PREVIEW_QUEUED", "FULL_QUEUED"] } } });
  if (!wantAlwaysOn && busy === 0 && idleMin >= g.idleMinutes) {
    await compute("stop");
    const minutes = (now - Date.parse(st.startedAt ?? new Date().toISOString())) / 60_000;
    await setState({ status: "off" });
    // Время работы целиком (включая загрузку и простой) — в расходы как «накладные GPU»
    await recordGpuOverhead(minutes, g.hourlyRub);
  }
}

async function recordGpuOverhead(totalMinutes: number, hourlyRub: number) {
  const since = new Date(Date.now() - totalMinutes * 60_000);
  const scenes = await db.generationCost.aggregate({ where: { createdAt: { gte: since }, provider: "qwen" }, _sum: { gpuSeconds: true } });
  const busySec = scenes._sum.gpuSeconds ?? 0;
  const overheadSec = Math.max(0, Math.round(totalMinutes * 60 - busySec));
  await db.generationCost.create({
    data: { provider: "gpu", operation: "overhead", gpuSeconds: overheadSec, costKopecks: Math.round((overheadSec / 3600) * hourlyRub * 100) },
  });
}
