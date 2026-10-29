// Маленький QR-кодировщик для демо-оплаты по СБП (версия 2, уровень L, байтовый режим, маска 0) —
// вместо библиотеки qrcode (≈23 КБ). Строка до 32 байт: «DEMO-SBP:<код заказа>:<сумма>».
// Алгоритм — по спецификации ISO/IEC 18004 (как в эталонной реализации Nayuki).

const SIZE = 25;
const DATA_CW = 34;
const EC_CW = 10;

const mul = (x: number, y: number) => {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
};

function ecc(data: number[]) {
  const div = new Array(EC_CW).fill(0);
  div[EC_CW - 1] = 1;
  let root = 1;
  for (let i = 0; i < EC_CW; i++) {
    for (let j = 0; j < EC_CW; j++) {
      div[j] = mul(div[j], root);
      if (j + 1 < EC_CW) div[j] ^= div[j + 1];
    }
    root = mul(root, 2);
  }
  const res = new Array(EC_CW).fill(0);
  for (const b of data) {
    const f = b ^ (res.shift() as number);
    res.push(0);
    div.forEach((c, i) => (res[i] ^= mul(c, f)));
  }
  return res;
}

export function qrSvg(text: string, px = 240): string {
  const bytes = Array.from(new TextEncoder().encode(text)).slice(0, 32);
  // Биты данных: режим 0100, длина 8 бит, байты, терминатор, выравнивание, заполнители
  const bits: number[] = [];
  const put = (v: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1);
  };
  put(4, 4);
  put(bytes.length, 8);
  bytes.forEach((b) => put(b, 8));
  put(0, Math.min(4, DATA_CW * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  for (let pad = 0xec; data.length < DATA_CW; pad ^= 0xec ^ 0x11) data.push(pad);
  const all = [...data, ...ecc(data)];

  const m: boolean[][] = Array.from({ length: SIZE }, () => new Array(SIZE).fill(false));
  const fn: boolean[][] = Array.from({ length: SIZE }, () => new Array(SIZE).fill(false));
  const set = (x: number, y: number, v: boolean) => {
    m[y][x] = v;
    fn[y][x] = true;
  };
  for (let i = 0; i < SIZE; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) set(x, y, d !== 2 && d !== 4);
      }
  };
  finder(3, 3);
  finder(SIZE - 4, 3);
  finder(3, SIZE - 4);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(18 + dx, 18 + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  // Формат: уровень L (01) + маска 0
  const fmtData = (1 << 3) | 0;
  let rem = fmtData;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const fb = ((fmtData << 10) | rem) ^ 0x5412;
  const bit = (i: number) => ((fb >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) set(8, i, bit(i));
  set(8, 7, bit(6));
  set(8, 8, bit(7));
  set(7, 8, bit(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) set(SIZE - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) set(8, SIZE - 15 + i, bit(i));
  set(8, SIZE - 8, true);
  // Данные зигзагом
  let k = 0;
  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let v = 0; v < SIZE; v++)
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const up = ((right + 1) & 2) === 0;
        const y = up ? SIZE - 1 - v : v;
        if (!fn[y][x] && k < all.length * 8) {
          m[y][x] = ((all[k >>> 3] >>> (7 - (k & 7))) & 1) === 1;
          k++;
        }
      }
  }
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (!fn[y][x] && (x + y) % 2 === 0) m[y][x] = !m[y][x];

  const q = 2;
  const n = SIZE + q * 2;
  let d = "";
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (m[y][x]) d += `M${x + q} ${y + q}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${px}" height="${px}" shape-rendering="crispEdges"><path fill="#ffffff" d="M0 0h${n}v${n}H0z"/><path fill="#000000" d="${d}"/></svg>`;
}
