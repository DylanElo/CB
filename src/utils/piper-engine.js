import * as tts from '@mintplex-labs/piper-tts-web';

// Piper voices - using high quality English voices
export const PIPER_VOICES = [
    { id: 'en_US-hfc_female-medium', name: 'HFC Female (US)', lang: 'en-US', provider: 'Piper' },
    { id: 'en_US-amy-medium', name: 'Amy (US Female)', lang: 'en-US', provider: 'Piper' },
    { id: 'en_US-lessac-medium', name: 'Lessac (US Natural)', lang: 'en-US', provider: 'Piper' },
    { id: 'en_GB-alan-medium', name: 'Alan (British Male)', lang: 'en-GB', provider: 'Piper' },
    { id: 'fr_FR-siwis-medium', name: 'Siwis (French)', lang: 'fr-FR', provider: 'Piper' },
];

let modelDownloaded = false;

export const loadPiperModel = async (voiceId = 'en_US-hfc_female-medium', onProgress = () => { }) => {
    if (modelDownloaded) return;

    try {
        console.log(`Downloading Piper voice: ${voiceId}`);
        await tts.download(voiceId, (progress) => {
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

    // predict() returns a WAV Blob
    const wav = await tts.predict({
        text: text,
        voiceId: voiceId
    });

    console.log(`Piper generation took ${Math.round(performance.now() - startTime)}ms`);
    return wav; // Already a Blob
};
