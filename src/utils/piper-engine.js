// Force single-threading to avoid SharedArrayBuffer/COOP issues on hosting platforms
// This prevents the "function signature mismatch" error in onnxruntime-web
try {
    if (typeof window !== 'undefined' && window.navigator) {
        Object.defineProperty(window.navigator, 'hardwareConcurrency', {
            get: () => 1,
            configurable: true
        });
    }
} catch (e) {
    console.warn("Could not patch hardwareConcurrency:", e);
}

import { TtsSession, download } from '@mintplex-labs/piper-tts-web';

let modelDownloaded = false;

// We need to define the WASM paths manually to force single-threaded execution
// for onnxruntime-web, avoiding the "function signature mismatch" error.
const WASM_PATHS = {
    // Point to local directory containing WASM files.
    // We provide an explicit map to ensure robust path resolution relative to the app base.
    onnxWasm: {
        'ort-wasm-simd.wasm': './ort-wasm-simd.wasm',
        'ort-wasm-simd-threaded.wasm': './ort-wasm-simd-threaded.wasm',
        'ort-wasm.wasm': './ort-wasm-simd.wasm'
    },
    // Default Piper WASM paths (copied from library source defaults)
    // In production, the app is served from /CB/, so we need to account for that if we use absolute paths or verify relative resolution.
    // However, ./ should resolve relative to the current module or HTML base.
    // Given the deployment structure, we might need to be careful.
    // But since ort-wasm uses ./, we'll stick with that.
    piperData: './piper_0.1.0.data',
    piperWasm: './piper_0.1.0.wasm'
};

export const loadPiperModel = async (voiceId = 'en_US-hfc_female-medium', onProgress = () => { }) => {
    if (modelDownloaded) return;

    try {
        console.log(`Downloading Piper voice: ${voiceId}`);
        // We use the exported download helper, which handles the model files (onnx/json)
        await download(voiceId, (progress) => {
            const pct = progress.total > 0 ? Math.round(progress.loaded * 100 / progress.total) : 50;
            onProgress(pct);
            console.log(`Downloading ${voiceId}: ${pct}%`);
        });
        modelDownloaded = true;
        console.log("Piper model ready!");
        onProgress(100);
    } catch (err) {
        console.error("Failed to download Piper model:", err);
        throw err;
    }
};

export const generatePiperAudio = async (text, voiceId = 'en_US-hfc_female-medium') => {
    const startTime = performance.now();

    // Create session manually to inject custom WASM paths
    const session = new TtsSession({
        voiceId: voiceId,
        wasmPaths: WASM_PATHS,
        logger: (msg) => console.log(`[Piper]: ${msg}`)
    });

    // predict() returns a WAV Blob
    const wav = await session.predict(text);

    console.log(`Piper generation took ${Math.round(performance.now() - startTime)}ms`);
    return wav; // Already a Blob
};
