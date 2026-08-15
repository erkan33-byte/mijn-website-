const P = (1n << 256n) - (1n << 32n) - 977n;
const GX = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798n;
const GY = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8n;
const G = { x: GX, y: GY };

function inv(a) {
  let [oldR, r, oldS, s] = [((a % P) + P) % P, P, 1n, 0n];
  while (r !== 0n) {
    const q = oldR / r;
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
  }
  return ((oldS % P) + P) % P;
}
function add(a, b) {
  if (a === null) return b;
  if (b === null) return a;
  if (a.x === b.x) {
    if ((a.y + b.y) % P === 0n) return null;
    const m = (3n * a.x * a.x * inv(2n * a.y)) % P;
    const x = (m * m - 2n * a.x) % P;
    const y = (m * (a.x - x) - a.y) % P;
    return { x: (x + P) % P, y: (y + P) % P };
  }
  const m = ((b.y - a.y) * inv(b.x - a.x)) % P;
  const x = (m * m - a.x - b.x) % P;
  const y = (m * (a.x - x) - a.y) % P;
  return { x: (x + P) % P, y: (y + P) % P };
}
function mul(n, base = G) {
  let acc = null;
  let cur = base;
  while (n > 0n) {
    if (n & 1n) acc = add(acc, cur);
    cur = add(cur, cur);
    n >>= 1n;
  }
  return acc;
}
function eq(a, b) { return a !== null && b !== null && a.x === b.x && a.y === b.y; }

const start = 0x123456789abcdefn;
const p0 = mul(start);
const g256 = mul(256n);
const g65536 = mul(65536n);
const g16777216 = mul(16777216n);
const samples = [0n, 1n, 255n, 256n, 257n, 65535n, 65536n, 131071n, 0x123456n, 0x20fffe7n];
for (const idx of samples) {
  const group = idx >> 8n;
  const lane = idx & 255n;
  let h = p0;
  const bytes = [group & 255n, (group >> 8n) & 255n, (group >> 16n) & 255n];
  const bases = [g256, g65536, g16777216];
  for (let i = 0; i < 3; i++) if (bytes[i] !== 0n) h = add(h, mul(bytes[i], bases[i]));
  if (lane !== 0n) h = add(h, mul(lane));
  const direct = mul(start + idx);
  if (!eq(h, direct)) throw new Error(`mismatch bij idx=0x${idx.toString(16)}`);
}
console.log(`OK: ${samples.length} hiërarchische decomposities zijn algebraïsch gelijk aan (start + idx)·G.`);
