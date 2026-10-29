// Распаковка данных сюжетов, сжатых при сборке (deflate-raw + base64): текст сюжетов — самая тяжёлая часть
// бандла, в сжатом виде он втрое меньше. Небольшой синхронный inflate (RFC 1951) — без зависимостей.

function inflate(src: Uint8Array): Uint8Array {
  let out = new Uint8Array(src.length * 6);
  let op = 0;
  let pos = 0;
  let bit = 0;
  const need = (n: number) => {
    if (op + n > out.length) {
      const o = new Uint8Array(Math.max(out.length * 2, op + n));
      o.set(out);
      out = o;
    }
  };
  const bits = (n: number) => {
    let v = 0;
    for (let i = 0; i < n; i++) {
      v |= ((src[pos] >> bit) & 1) << i;
      if (++bit === 8) {
        bit = 0;
        pos++;
      }
    }
    return v;
  };
  // Таблица Хаффмана: counts[len], symbols по порядку
  type Tree = { counts: Uint16Array; symbols: Uint16Array };
  const build = (lengths: Uint8Array | number[], n: number): Tree => {
    const counts = new Uint16Array(16);
    const symbols = new Uint16Array(n);
    for (let i = 0; i < n; i++) counts[lengths[i]]++;
    counts[0] = 0;
    const offs = new Uint16Array(16);
    for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + counts[i - 1];
    for (let i = 0; i < n; i++) if (lengths[i]) symbols[offs[lengths[i]]++] = i;
    return { counts, symbols };
  };
  const decode = (t: Tree) => {
    let code = 0;
    let first = 0;
    let index = 0;
    for (let len = 1; len < 16; len++) {
      code |= bits(1);
      const count = t.counts[len];
      if (code - first < count) return t.symbols[index + code - first];
      index += count;
      first += count;
      first <<= 1;
      code <<= 1;
    }
    throw new Error("inflate: bad code");
  };
  const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  const CLORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

  let fixedL: Tree | null = null;
  let fixedD: Tree | null = null;
  let last = 0;
  while (!last) {
    last = bits(1);
    const type = bits(2);
    if (type === 0) {
      if (bit) {
        bit = 0;
        pos++;
      }
      const len = src[pos] | (src[pos + 1] << 8);
      pos += 4;
      need(len);
      out.set(src.subarray(pos, pos + len), op);
      op += len;
      pos += len;
      continue;
    }
    let lt: Tree;
    let dt: Tree;
    if (type === 1) {
      if (!fixedL) {
        const l = new Uint8Array(288);
        l.fill(8, 0, 144);
        l.fill(9, 144, 256);
        l.fill(7, 256, 280);
        l.fill(8, 280, 288);
        fixedL = build(l, 288);
        fixedD = build(new Uint8Array(30).fill(5), 30);
      }
      lt = fixedL;
      dt = fixedD!;
    } else {
      const hlit = bits(5) + 257;
      const hdist = bits(5) + 1;
      const hclen = bits(4) + 4;
      const cl = new Uint8Array(19);
      for (let i = 0; i < hclen; i++) cl[CLORDER[i]] = bits(3);
      const ct = build(cl, 19);
      const lens = new Uint8Array(hlit + hdist);
      for (let i = 0; i < hlit + hdist; ) {
        const sym = decode(ct);
        if (sym < 16) lens[i++] = sym;
        else {
          let rep = 0;
          let val = 0;
          if (sym === 16) {
            val = lens[i - 1];
            rep = 3 + bits(2);
          } else if (sym === 17) rep = 3 + bits(3);
          else rep = 11 + bits(7);
          while (rep--) lens[i++] = val;
        }
      }
      lt = build(lens.subarray(0, hlit), hlit);
      dt = build(lens.subarray(hlit), hdist);
    }
    for (;;) {
      const sym = decode(lt);
      if (sym < 256) {
        need(1);
        out[op++] = sym;
      } else if (sym === 256) break;
      else {
        const s = sym - 257;
        const len = LBASE[s] + bits(LEXT[s]);
        const d = decode(dt);
        const dist = DBASE[d] + bits(DEXT[d]);
        need(len);
        for (let i = 0; i < len; i++, op++) out[op] = out[op - dist];
      }
    }
  }
  return out.subarray(0, op);
}

export function unpack<T>(b64: string): T {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return JSON.parse(new TextDecoder().decode(inflate(bytes)));
}
