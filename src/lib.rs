use wasm_bindgen::prelude::*;
use k256::{ProjectivePoint, Scalar};
use k256::elliptic_curve::sec1::ToEncodedPoint;
use k256::elliptic_curve::PrimeField;
use sha2::{Sha256, Digest};
use ripemd::Ripemd160;

#[wasm_bindgen]
pub struct ScanResult {
    found: bool,
    priv_hex: String,
    wif: String,
}

#[wasm_bindgen]
impl ScanResult {
    #[wasm_bindgen(getter)]
    pub fn found(&self) -> bool { self.found }
    #[wasm_bindgen(getter)]
    pub fn priv_hex(&self) -> String { self.priv_hex.clone() }
    #[wasm_bindgen(getter)]
    pub fn wif(&self) -> String { self.wif.clone() }
}

#[wasm_bindgen]
pub fn scan_batch_linear(start_hex: &str, steps: u32, target_hash160: &[u8]) -> ScanResult {
    let mut bytes = [0u8; 32];
    let hex_bytes = match hex_decode(start_hex) {
        Some(b) => b,
        None => return ScanResult { found: false, priv_hex: String::new(), wif: String::new() }
    };
    
    let offset = 32 - hex_bytes.len();
    bytes[offset..].copy_from_slice(&hex_bytes);

    let scalar_opt = Scalar::from_repr(bytes.into());
    if scalar_opt.is_none().into() {
        return ScanResult { found: false, priv_hex: String::new(), wif: String::new() };
    }
    let mut scalar = scalar_opt.unwrap();

    let g = ProjectivePoint::GENERATOR;
    let mut current_point = g * scalar;

    let mut target = [0u8; 20];
    if target_hash160.len() == 20 {
        target.copy_from_slice(target_hash160);
    }

    for _ in 0..steps {
        // Genereer gecomprimeerde public key (33 bytes) direct uit ProjectivePoint
        let encoded = current_point.to_affine().to_encoded_point(true);
        let pubkey_bytes = encoded.as_bytes();

        // Stap 1: SHA256
        let mut sha = Sha256::new();
        sha.update(pubkey_bytes);
        let sha_res = sha.finalize();

        // Stap 2: RIPEMD160
        let mut rip = Ripemd160::new();
        rip.update(&sha_res);
        let rip_res = rip.finalize();

        // Snelle 20-byte vergelijking
        if rip_res.as_slice() == target {
            let priv_bytes = scalar.to_bytes();
            let priv_hex = hex_encode(&priv_bytes);
            
            // Match! Bereken nu pas de WIF om CPU-tijd in de loop te besparen
            let mut wif_payload = Vec::with_capacity(34);
            wif_payload.push(0x80);
            wif_payload.extend_from_slice(&priv_bytes);
            wif_payload.push(0x01); // Compressed marker
            
            let mut s1 = Sha256::new();
            s1.update(&wif_payload);
            let r1 = s1.finalize();
            
            let mut s2 = Sha256::new();
            s2.update(&r1);
            let r2 = s2.finalize();
            
            let mut wif_bytes = wif_payload;
            wif_bytes.extend_from_slice(&r2[0..4]);
            let wif = to_base58(&wif_bytes);
            
            return ScanResult { found: true, priv_hex, wif };
        }

        // Wiskundige snelweg: Point Addition (P + G)
        current_point += g;
        scalar += Scalar::ONE;
    }

    ScanResult { found: false, priv_hex: String::new(), wif: String::new() }
}

fn hex_decode(s: &str) -> Option<Vec<u8>> {
    let mut res = Vec::with_capacity(s.len() / 2);
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if i + 1 >= bytes.len() { return None; }
        let hi = nxt(bytes[i])?;
        let lo = nxt(bytes[i+1])?;
        res.push((hi << 4) | lo);
        i += 2;
    }
    Some(res)
}

fn nxt(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None
    }
}

fn hex_encode(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for &b in bytes {
        s.push(char::from_digit((b >> 4) as u32, 16).unwrap());
        s.push(char::from_digit((b & 0xf) as u32, 16).unwrap());
    }
    s
}

fn to_base58(bytes: &[u8]) -> String {
    const ALPHA: &[u8] = b"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let mut digits = vec![0u32];
    for &b in bytes {
        let mut carry = b as u32;
        for d in digits.iter_mut() {
            carry += *d << 8;
            *d = carry % 58;
            carry /= 58;
        }
        while carry > 0 {
            digits.push(carry % 58);
            carry /= 58;
        }
    }
    let mut s = String::new();
    for &b in bytes {
        if b == 0 { s.push('1'); } else { break; }
    }
    for &d in digits.iter().rev() {
        s.push(ALPHA[d as usize] as char);
    }
    s
}
