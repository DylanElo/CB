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

// Piper voices - using high quality English voices
export const PIPER_VOICES = [
    { id: 'en_US-hfc_female-medium', name: 'HFC Female (US)', lang: 'en-US', provider: 'Piper' },
    { id: 'en_US-amy-medium', name: 'Amy (US Female)', lang: 'en-US', provider: 'Piper' },
    { id: 'en_US-lessac-medium', name: 'Lessac (US Natural)', lang: 'en-US', provider: 'Piper' },
    { id: 'en_GB-alan-medium', name: 'Alan (British Male)', lang: 'en-GB', provider: 'Piper' },
    { id: 'fr_FR-siwis-medium', name: 'Siwis (French)', lang: 'fr-FR', provider: 'Piper' },
];

let modelDownloaded = false;

// We need to define the WASM paths manually to force single-threaded execution
// for onnxruntime-web, avoiding the "function signature mismatch" error.
const WASM_PATHS = {
    // Point to local single-threaded WASM file.
    // We pass an object map to ensure onnxruntime loads strictly this file for SIMD.
    // Note: The library passes this to ort.env.wasm.wasmPaths.
    onnxWasm: {
        'ort-wasm-simd.wasm': 'ort-wasm-simd.wasm',
        'ort-wasm-simd-threaded.wasm': 'ort-wasm-simd.wasm', // Fallback just in case
        'ort-wasm.wasm': 'ort-wasm-simd.wasm'
    },
    // Default Piper WASM paths (copied from library source defaults)
    piperData: 'https://huggingface.co/rhasspy/piper-neural-strip/resolve/main/piper_0.1.0.data',
    piperWasm: 'https://huggingface.co/rhasspy/piper-neural-strip/resolve/main/piper_0.1.0.wasm'
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
