import { KokoroTTS } from 'kokoro-js';

let tts = null;

self.onmessage = async (e) => {
    const { type, text, voiceId, modelId, dtype } = e.data;

    try {
        if (type === 'load') {
            if (!tts) {
                // Try WebGPU first for speed, fallback to WASM
                let device = "webgpu";
                try {
                    // Check WebGPU availability
                    if (!navigator.gpu) {
                        console.log("WebGPU not available, falling back to WASM");
                        device = "wasm";
                    }
                } catch (e) {
                    device = "wasm";
                }

                console.log(`Loading Kokoro with device: ${device}`);
                tts = await KokoroTTS.from_pretrained(modelId || "onnx-community/Kokoro-82M-ONNX", {
                    dtype: dtype || "q4", // Use q4 for faster inference
                    device: device,
                    progress_callback: (items) => {
                        try {
                            if (Array.isArray(items)) {
                                const minimalItems = items.map(item => ({
                                    status: item.status,
                                    progress: item.progress,
                                    file: item.file
                                }));
                                self.postMessage({ type: 'progress', items: minimalItems });
                            }
                        } catch (pErr) {
                            self.postMessage({ type: 'progress', message: 'loading' });
                        }
                    }
                });
                console.log("Kokoro model loaded successfully");
            }
            self.postMessage({ type: 'loaded' });
        } else if (type === 'generate') {
            if (!tts) {
                throw new Error("Model not loaded");
            }

            const startTime = performance.now();
            const audio = await tts.generate(text, { voice: voiceId });
            console.log(`Generation took ${Math.round(performance.now() - startTime)}ms`);

            const wav = audio.toWav();

            if (wav instanceof Blob) {
                self.postMessage({ type: 'audio', wav });
            } else if (ArrayBuffer.isView(wav)) {
                const buffer = wav.buffer.slice(0);
                self.postMessage({ type: 'audio', wav: buffer }, [buffer]);
            } else if (wav instanceof ArrayBuffer) {
                const copy = wav.slice(0);
                self.postMessage({ type: 'audio', wav: copy }, [copy]);
            } else {
                self.postMessage({ type: 'audio', wav });
            }
        }
    } catch (err) {
        console.error("Worker error:", err);
        self.postMessage({ type: 'error', error: err.message || String(err) });
    }
};
