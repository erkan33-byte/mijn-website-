const P = (1n << 256n) - (1n << 32n) - 977n;
const G = {
  x: 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798n,
  y: 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8n
};
const mod = a => ((a % P) + P) % P;
function pow(a,e){let r=1n;for(;e;e>>=1n,a=mod(a*a))if(e&1n)r=mod(r*a);return r;}
function add(A,B){if(!A)return B;if(!B)return A;if(A.x===B.x){if(mod(A.y+B.y)===0n)return null;return dbl(A);}const l=mod((B.y-A.y)*pow(mod(B.x-A.x),P-2n));const x=mod(l*l-A.x-B.x);return{x,y:mod(l*(A.x-x)-A.y)};}
function dbl(A){if(!A||A.y===0n)return null;const l=mod(3n*A.x*A.x*pow(2n*A.y,P-2n));const x=mod(l*l-2n*A.x);return{x,y:mod(l*(A.x-x)-A.y)};}
function mul(k){let r=null,a=G;for(;k;k>>=1n,a=dbl(a))if(k&1n)r=add(r,a);return r;}
const starts=[G];for(let i=1;i<3;i++){let b=starts[i-1];for(let d=0;d<8;d++)b=dbl(b);starts.push(b);}
const table=starts.map((base,i)=>{const t=[null];let a=null;for(let j=1;j<(i===2?32:256);j++){a=add(a,base);t.push(a);}return t;});
function fromWindows(idx){let r=null;const b0=idx&255,b1=(idx>>>8)&255,b2=(idx>>>16)&31;if(b0)r=add(r,table[0][b0]);if(b1)r=add(r,table[1][b1]);if(b2)r=add(r,table[2][b2]);return r;}
const samples=[1,2,255,256,257,65535,65536,1048575,2097151];
for(const n of samples){const a=fromWindows(n),b=mul(BigInt(n));if(!a||a.x!==b.x||a.y!==b.y)throw Error('window mismatch '+n);}
console.log(JSON.stringify({status:'ok',samples:samples.length,entries:256+256+32,maximumOffset:2097151}));
