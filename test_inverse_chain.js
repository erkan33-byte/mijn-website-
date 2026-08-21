const P = (1n << 256n) - (1n << 32n) - 977n;
const E = P - 2n;

function modPow(a, e) {
  let r = 1n;
  for (; e > 0n; e >>= 1n, a = (a * a) % P) if (e & 1n) r = (r * a) % P;
  return r;
}
function sqrN(a, n) { for (let i = 0; i < n; i++) a = (a * a) % P; return a; }
function inverseChain(base) {
  const x1 = base;
  const x2 = (sqrN(x1, 1) * x1) % P;
  const x3 = (sqrN(x2, 1) * x1) % P;
  const x6 = (sqrN(x3, 3) * x3) % P;
  const x9 = (sqrN(x6, 3) * x3) % P;
  const x11 = (sqrN(x9, 2) * x2) % P;
  const x22 = (sqrN(x11, 11) * x11) % P;
  const x44 = (sqrN(x22, 22) * x22) % P;
  const x88 = (sqrN(x44, 44) * x44) % P;
  let r = (sqrN(x88, 88) * x88) % P;
  r = (sqrN(r, 44) * x44) % P;
  r = (sqrN(r, 3) * x3) % P;
  r = (sqrN(r, 23) * x22) % P;
  r = (sqrN(r, 5) * x1) % P;
  r = (sqrN(r, 3) * x2) % P;
  r = sqrN(r, 2);
  return (r * base) % P;
}
const bases = [1n, 2n, 3n, 17n, 0x17e2551en, P - 1n, 0x123456789abcdef0123456789abcdefn];
for (const x of bases) {
  const got = inverseChain(x);
  const expected = modPow(x, E);
  if (got !== expected || (x * got) % P !== 1n) throw new Error(`Mismatch for ${x.toString(16)}`);
}
console.log(JSON.stringify({status:'ok', testedBases:bases.length, exponent:E.toString(16), chainOps:{squares:255, multiplies:15}}));
