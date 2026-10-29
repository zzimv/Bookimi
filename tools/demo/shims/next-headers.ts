// next/headers для демо: cookies и заголовки пусты (сессия — в хранилище браузера, см. api.ts).
export async function cookies() {
  return { get: (_: string) => undefined as { value: string } | undefined, set() {}, delete() {} };
}
export async function headers() {
  return new Headers();
}
