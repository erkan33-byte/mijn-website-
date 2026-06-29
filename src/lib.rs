use wasm_bindgen::prelude::*;
use k256::{ProjectivePoint, Scalar};
use sha2::{Sha256, Digest};
use ripemd160::Ripemd160;
use hex::{decode, encode};

// Base58 alfabet
const ALPHABET: &[u8] = b"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

// Hulpfuncie voor Base58 encoderen
fn to_base58(bytes: &[u8]) -> String {
    let mut digits = vec![0u8];
    for &byte in bytes {
        let mut carry = byte as usize;
        for digit in &mut digits {
            carry += *digit as usize * 256;
            *digit = (carry % 58) as u8;
            carry /= 58;
        }
        while carry > 0 {
            digits.push((carry % 58) as u8);
            carry /= 58;
        }
    }
    // skip leading zeros
    let leading_zeros = bytes.iter().take_while(|&&b| b == 0).count();
    let mut result = String::with_capacity(digits.len() + leading_zeros);
    for _ in 0..leading_zeros {
        result.push(ALPHABET[0] as char);
    }
    for digit in digits.iter().rev() {
        result.push(ALPHABET[*digit as usize] as char);
    }
    result
}

// Callback voor progress (wordt door JS aangeroepen)
#[wasm_bindgen]
extern "C" {
    fn progress_callback(count: u32);
}

#[wasm_bindgen]
pub fn scan_linear(
    start_hex: &str,
    end_hex: &str,
    target_checksum_hex: &str,  // 8 hex chars (4 bytes)
) -> Option<String> {
    let start_bytes = decode(start_hex).unwrap();
    let end_bytes = decode(end_hex).unwrap();
    let target_bytes = decode(target_checksum_hex).unwrap(); // length 4

    let mut current_scalar = Scalar::from_bytes_mod_order(start_bytes.try_into().unwrap());
    let end_scalar = Scalar::from_bytes_mod_order(end_bytes.try_into().unwrap());
    let generator = ProjectivePoint::generator();
    let mut current_point = ProjectivePoint::generator() * current_scalar;

    let mut count = 0u32;
    while current_scalar <= end_scalar {
        // 1. Gecomprimeerde public key
        let pk_bytes = current_point.to_affine().to_bytes_compressed();

        // 2. SHA-256
        let hash1 = Sha256::digest(&pk_bytes);

        // 3. RIPEMD-160
        let h160 = Ripemd160::digest(&hash1);

        // 4. Payload: 0x00 + H160
        let mut payload = vec![0x00];
        payload.extend_from_slice(&h160);

        // 5. Checksum (dubbele SHA256)
        let check1 = Sha256::digest(&payload);
        let checksum = Sha256::digest(&check1);

        // 6. Vergelijk de eerste 4 bytes van checksum met target
        if checksum[0..4] == target_bytes[0..4] {
            // Volledige adres (Base58) genereren
            let mut full_addr_bytes = payload.clone();
            full_addr_bytes.extend_from_slice(&checksum[0..4]);
            let full_addr = to_base58(&full_addr_bytes);

            // Privésleutel (HEX)
            let priv_hex = format!("{:064x}", current_scalar);

            // WIF (compressed)
            let mut wif_payload = vec![0x80];
            wif_payload.extend_from_slice(&decode(&priv_hex).unwrap());
            wif_payload.push(0x01); // compressed flag
            let wif_check1 = Sha256::digest(&wif_payload);
            let wif_checksum = Sha256::digest(&wif_check1);
            wif_payload.extend_from_slice(&wif_checksum[0..4]);
            let wif = to_base58(&wif_payload);

            return Some(format!("{}|{}|{}", priv_hex, wif, full_addr));
        }

        // 7. Point addition (constant time)
        current_point = current_point + generator;
        current_scalar = current_scalar + Scalar::ONE;
        count += 1;

        // 8. Progress callback (elke 200.000 keys)
        if count >= 200_000 {
            progress_callback(count);
            count = 0;
        }
    }
    None
}
