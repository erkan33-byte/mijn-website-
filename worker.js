const WASM_PATH = '/mijn-website-/pkg/slice_sniper_wasm_bg.wasm';
import init, { scan_batch_linear } from './pkg/slice_sniper_wasm.js';

let wasmInitialized = false;

self.onmessage = async function(e) {
    const data = e.data;
    if (data.type === "ADDRESS_SCAN") {
        try {
            if (!wasmInitialized) {
                await init(WASM_PATH);
                wasmInitialized = true;
            }
        } catch (err) {
            self.postMessage({ type: "ERROR", message: "WASM Laad-fout: " + err.message });
            return;
        }

        let currentStartHex = data.startHex;
        const endKey = BigInt("0x" + data.endHex);
        const targetHash160Bytes = new Uint8Array(
            data.targetHash160Hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
        );
        const method = data.method || 'linear';
        const BATCH_SIZE = 50000;

        if (method === 'linear') {
            while (BigInt("0x" + currentStartHex) <= endKey) {
                const result = scan_batch_linear(currentStartHex, BATCH_SIZE, targetHash160Bytes);
                if (result.found) {
                    self.postMessage({ type: "FOUND", privHex: result.priv_hex, wif: result.wif });
                    return;
                }
                self.postMessage({ type: "PROGRESS", count: BATCH_SIZE });
                currentStartHex = (BigInt("0x" + currentStartHex) + BigInt(BATCH_SIZE)).toString(16).padStart(64, '0');
            }
            self.postMessage({ type: "SCAN_DONE" });
        }
    }
};
