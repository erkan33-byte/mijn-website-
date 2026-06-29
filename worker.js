// We importeren de WASM initialisatie via de absolute URL die index.html ons heeft meegegeven
import init, { scan_batch_linear } from './pkg/slice_sniper_wasm.js';

let wasmInitialized = false;

self.onmessage = async function(e) {
    const data = e.data;
    if (data.type === "ADDRESS_SCAN") {
        if (!wasmInitialized) {
            // Gebruik de geïnjecteerde absolute basis-URL om de .wasm-binary direct aan te spreken
            const wasmPath = WORKER_BASE_URL + 'pkg/slice_sniper_wasm_bg.wasm';
            await init(wasmPath);
            wasmInitialized = true;
        }

        let currentStartHex = data.startHex;
        const endKey = BigInt("0x" + data.endHex);
        const range = endKey - BigInt("0x" + data.startHex) + 1n;
        const targetHash160Bytes = new Uint8Array(
            data.targetHash160Hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
        );
        const method = data.method || 'linear';
        const workerId = data.workerId;
        
        // Grote batch-grootte zorgt dat Rust ononderbroken kan knallen
        const BATCH_SIZE = 50000; 

        self.postMessage({ type: "WORKER_STARTED", workerId: workerId });

        if (method === 'linear') {
            while (BigInt("0x" + currentStartHex) <= endKey) {
                const result = scan_batch_linear(currentStartHex, BATCH_SIZE, targetHash160Bytes);
                
                if (result.found) {
                    self.postMessage({ type: "FOUND", privHex: result.priv_hex, wif: result.wif, workerId });
                    return;
                }
                
                self.postMessage({ type: "PROGRESS", count: BATCH_SIZE, workerId });
                currentStartHex = (BigInt("0x" + currentStartHex) + BigInt(BATCH_SIZE)).toString(16).padStart(64, '0');
            }
            self.postMessage({ type: "SCAN_DONE", workerId });
        } else {
            // Geoptimaliseerde WASM Random modus
            while (true) {
                const randBytes = new Uint8Array(32);
                crypto.getRandomValues(randBytes);
                let randOffset = 0n;
                for (let b = 0; b < 32; b++) { randOffset = (randOffset << 8n) | BigInt(randBytes[b]); }
                const candidateKey = BigInt("0x" + data.startHex) + (randOffset % range);
                const candidateHex = candidateKey.toString(16).padStart(64, '0');

                const result = scan_batch_linear(candidateHex, 1, targetHash160Bytes);
                if (result.found) {
                    self.postMessage({ type: "FOUND", privHex: result.priv_hex, wif: result.wif, workerId });
                    return;
                }
                self.postMessage({ type: "PROGRESS", count: 1, workerId });
            }
        }
    }
};
