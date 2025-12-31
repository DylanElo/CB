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
let currentSession = null;
let currentVoiceId = null;

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

    // Optimization: Reuse existing session if the voice hasn't changed.
    // Creating a new TtsSession is expensive as it initializes the ONNX runtime and loads the model.
    if (!currentSession || currentVoiceId !== voiceId) {
        console.log(`[Piper] Initializing new session for voice: ${voiceId}`);
        // Create session manually to inject custom WASM paths
        currentSession = new TtsSession({
            voiceId: voiceId,
            wasmPaths: WASM_PATHS,
            logger: (msg) => console.log(`[Piper]: ${msg}`)
        });
        currentVoiceId = voiceId;
    } else {
        console.log(`[Piper] Reusing existing session for voice: ${voiceId}`);
    }

    try {
        // predict() returns a WAV Blob
        const wav = await currentSession.predict(text);
        console.log(`Piper generation took ${Math.round(performance.now() - startTime)}ms`);
        return wav; // Already a Blob
    } catch (err) {
        // If prediction fails, invalidate the session so we try fresh next time
        console.error("[Piper] Generation failed, invalidating session.", err);
        currentSession = null;
        currentVoiceId = null;
        throw err;
    }
};
