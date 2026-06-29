import * as secp from 'https://esm.sh/@noble/secp256k1@2.0.0';
import { sha256 } from 'https://esm.sh/@noble/hashes@1.3.3/sha256';
import { ripemd160 } from 'https://esm.sh/@noble/hashes@1.3.3/ripemd160';
import { bytesToHex } from 'https://esm.sh/@noble/hashes@1.3.3/utils';

// Helpers voor conversie zonder overhead in de loop
function hexToBytes(hex) {
    let bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
}

function toBase58(hex) {
    const ALPHA = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    const bytes = hex.match(/.{2}/g).map(b => parseInt(b, 16));
    const digits = [0];
    for (let i = 0; i < bytes.length; i++) {
        let carry = bytes[i];
        for (let j = 0; j < digits.length; j++) {
            carry += digits[j] << 8;
            digits[j] = carry % 58;
            carry = (carry / 58) | 0;
        }
        while (carry > 0) {
            digits.push(carry % 58);
            carry = (carry / 58) | 0;
        }
    }
    let s = '';
    for (let i = 0; i < bytes.length && bytes[i] === 0; i++) s += ALPHA[0];
    for (let i = digits.length - 1; i >= 0; i--) s += ALPHA[digits[i]];
    return s;
}

self.onmessage = function(e) {
    const data = e.data;
    if (data.type === "ADDRESS_SCAN") {
        const startKey = BigInt("0x" + data.startHex);
        const endKey = BigInt("0x" + data.endHex);
        const targetBytes = hexToBytes(data.targetChecksumHex); // Pre-calculate bytes!
        const targetAddr = data.targetAddress;
        const method = data.method || 'random';
        const workerId = data.workerId;
        
        self.postMessage({ type: "WORKER_STARTED", workerId: workerId });

        if (method === 'linear') {
            // --- GEOPTIMALISEERDE POINT ADDITION ---
            const G = secp.ProjectivePoint.BASE;
            let currentKey = startKey;
            let currentPoint = G.multiply(currentKey);
            let count = 0;
            const PROGRESS_INTERVAL = 20000;
            
            const payload = new Uint8Array(21);
            payload[0] = 0x00; // Mainnet byte

            while (currentKey <= endKey) {
                // 1. Krijg ruwe public key bytes
                const pubKeyBytes = currentPoint.toRawBytes(true);
                
                // 2. Hash direct (geen strings!)
                const hash1 = sha256(pubKeyBytes);
                const h160 = ripemd160(hash1);
                
                // 3. Bouw netwerk payload
                payload.set(h160, 1);
                const check1 = sha256(payload);
                const checksum = sha256(check1);
                
                // 4. Extreem snelle byte vergelijking
                if (checksum[0] === targetBytes[0] &&
                    checksum[1] === targetBytes[1] &&
                    checksum[2] === targetBytes[2] &&
                    checksum[3] === targetBytes[3]) {
                    
                    const payloadHex = bytesToHex(payload);
                    const checksumHex = bytesToHex(checksum).slice(0, 8);
                    const fullAddr = toBase58(payloadHex + checksumHex);
                    
                    if (fullAddr === targetAddr) {
                        const privHex = currentKey.toString(16).padStart(64, '0');
                        const wifPayloadHex = "80" + privHex + "01";
                        const wifPayloadBytes = hexToBytes(wifPayloadHex);
                        const wifCheck1 = sha256(wifPayloadBytes);
                        const wifChecksum = sha256(wifCheck1);
                        const wifFullHex = wifPayloadHex + bytesToHex(wifChecksum).slice(0, 8);
                        const wif = toBase58(wifFullHex);
                        
                        self.postMessage({ type: "FOUND", privHex: privHex, wif: wif, address: fullAddr });
                        return;
                    }
                }
                
                // Stap vooruit op de curve
                currentPoint = currentPoint.add(G);
                currentKey++;
                count++;
                
                if (count >= PROGRESS_INTERVAL) {
                    self.postMessage({ type: "PROGRESS", count: count, workerId });
                    count = 0;
                }
            }
            if (count > 0) self.postMessage({ type: "PROGRESS", count: count, workerId });
            self.postMessage({ type: "SCAN_DONE", workerId });
        } else {
            // Random mode
            const RANDOM_BATCH_SIZE = 1000;
            const range = endKey - startKey + 1n;
            
            function randomLoop() {
                for(let i = 0; i < RANDOM_BATCH_SIZE; i++) {
                    const randBytes = new Uint8Array(32);
                    crypto.getRandomValues(randBytes);
                    let randOffset = 0n;
                    for (let b = 0; b < 32; b++) { randOffset = (randOffset << 8n) | BigInt(randBytes[b]); }
                    
                    const candidateKey = startKey + (randOffset % range);
                    const candidatePoint = secp.ProjectivePoint.BASE.multiply(candidateKey);
                    const pubKeyBytes = candidatePoint.toRawBytes(true);
                    
                    const payload = new Uint8Array(21);
                    payload[0] = 0x00;
                    payload.set(ripemd160(sha256(pubKeyBytes)), 1);
                    
                    const checksum = sha256(sha256(payload));
                    
                    if (checksum[0] === targetBytes[0] && checksum[1] === targetBytes[1] &&
                        checksum[2] === targetBytes[2] && checksum[3] === targetBytes[3]) {
                        const fullAddr = toBase58(bytesToHex(payload) + bytesToHex(checksum).slice(0, 8));
                        if (fullAddr === targetAddr) {
                            const privHex = candidateKey.toString(16).padStart(64, '0');
                            self.postMessage({ type: "FOUND", privHex: privHex, wif: "Gevonden via Random", address: fullAddr });
                            return;
                        }
                    }
                }
                self.postMessage({ type: "PROGRESS", count: RANDOM_BATCH_SIZE, workerId });
                setTimeout(randomLoop, 0);
            }
            randomLoop();
        }
    }
};
