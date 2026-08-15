const P = (1n << 256n) - (1n << 32n) - 977n;
const N = 128;

function inv(a) {
  let r0 = ((a % P) + P) % P;
  let r1 = P;
  let s0 = 1n;
  let s1 = 0n;
  while (r1 !== 0n) {
    const q = r0 / r1;
    [r0, r1] = [r1, r0 - q * r1];
    [s0, s1] = [s1, s0 - q * s1];
  }
  return (s0 + P) % P;
}
function mul(a, b) { return (a * b) % P; }

const tree = Array.from({ length: 2 * N }, () => 0n);
const values = Array.from({ length: N }, (_, i) => BigInt((i + 1) * (i + 17) + 31));
for (let i = 0; i < N; i++) tree[N + i] = values[i];
for (let width = N / 2; width > 0; width >>= 1) {
  for (let lane = 0; lane < width; lane++) {
    const node = width + lane;
    tree[node] = mul(tree[node * 2], tree[node * 2 + 1]);
  }
}
tree[1] = inv(tree[1]);
for (let width = 1; width < N; width <<= 1) {
  for (let lane = 0; lane < width; lane++) {
    const node = width + lane;
    const parentInverse = tree[node];
    const leftProduct = tree[node * 2];
    const rightProduct = tree[node * 2 + 1];
    tree[node * 2] = mul(parentInverse, rightProduct);
    tree[node * 2 + 1] = mul(parentInverse, leftProduct);
  }
}
for (let i = 0; i < N; i++) {
  if (mul(values[i], tree[N + i]) !== 1n) throw new Error(`inverse mismatch bij lane ${i}`);
}
console.log(`OK: productboom retourneert ${N} correcte inversen met één modulaire inverse.`);
