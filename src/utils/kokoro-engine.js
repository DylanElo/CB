let worker = null;
let modelLoaded = false;
let loadPromise = null;

// Popula voices for Kokoro
export const KOKORO_VOICES = [
    { id: 'af_heart', name: 'Heart (American Female)', provider: 'Local' },
    { id: 'af_bella', name: 'Bella (American Soft)', provider: 'Local' },
    { id: 'af_sarah', name: 'Sarah (American Direct)', provider: 'Local' },
    { id: 'af_nicole', name: 'Nicole (American Professional)', provider: 'Local' },
    { id: 'am_adam', name: 'Adam (American Male)', provider: 'Local' },
    { id: 'bf_emma', name: 'Emma (British Female)', provider: 'Local' },
    { id: 'bm_george', name: 'George (British Male)', provider: 'Local' }
];

const getWorker = () => {
    if (!worker) {
        // Standard Vite worker import
        worker = new Worker(new URL('./kokoro-worker.js', import.meta.url), { type: 'module' });
    }
    return worker;
};

export const loadKokoroModel = async (onProgress = () => { }) => {
    if (modelLoaded) return;
    if (loadPromise) return loadPromise;

    const w = getWorker();
    loadPromise = new Promise((resolve, reject) => {
        const handler = (e) => {
            const { type, items, error } = e.data;
            if (type === 'progress') {
                if (Array.isArray(items)) {
                    const item = items.find(i => i.status === 'progress');
                    if (item) onProgress(Math.floor(item.progress));
                }
            } else if (type === 'loaded') {
                modelLoaded = true;
                w.removeEventListener('message', handler);
                resolve();
            } else if (type === 'error') {
                w.removeEventListener('message', handler);
                loadPromise = null;
                reject(new Error(error));
            }
        };
        w.addEventListener('message', handler);
        w.postMessage({ type: 'load' });
    });

    return loadPromise;
};

export const generateKokoroAudio = async (text, voiceId = 'af_heart') => {
    await loadKokoroModel(); // Ensure loaded
    const w = getWorker();

    return new Promise((resolve, reject) => {
        const handler = (e) => {
            const { type, wav, error } = e.data;
            if (type === 'audio') {
                w.removeEventListener('message', handler);
                // Robustness: Ensure we return a Blob
                let blob = wav;
                if (!(wav instanceof Blob)) {
                    blob = new Blob([wav], { type: 'audio/wav' });
                }
                resolve(blob);
            } else if (type === 'error') {
                w.removeEventListener('message', handler);
                reject(new Error(error));
            }
        };
        w.addEventListener('message', handler);
        w.postMessage({ type: 'generate', text, voiceId });
    });
};

/**
 * Legacy helper - no longer needed as generateKokoroAudio returns Blob directly
 */
export const kokoroAudioToBlob = (audio) => {
    if (audio instanceof Blob) return audio;
    return new Blob([audio], { type: 'audio/wav' });
};
