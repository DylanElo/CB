import meSpeak from 'mespeak';
import meSpeakConfig from 'mespeak/src/mespeak_config.json';
import enUSVoice from 'mespeak/voices/en/en-us.json';

let initialized = false;

// meSpeak voices
export const MESPEAK_VOICES = [
    { id: 'en/en-us', name: 'English (US)', provider: 'meSpeak' },
    { id: 'en/en', name: 'English (UK)', provider: 'meSpeak' },
    { id: 'fr', name: 'Français', provider: 'meSpeak' },
];

export const loadMeSpeakModel = async (voiceId = 'en/en-us', onProgress = () => { }) => {
    if (initialized) return;

    try {
        console.log("Initializing meSpeak...");
        onProgress(30);

        meSpeak.loadConfig(meSpeakConfig);
        onProgress(60);

        meSpeak.loadVoice(enUSVoice);
        onProgress(90);

        initialized = true;
        console.log("meSpeak ready!");
        onProgress(100);
    } catch (err) {
        console.error("Failed to initialize meSpeak:", err);
        throw err;
    }
};

export const generateMeSpeakAudio = async (text, voiceId = 'en/en-us') => {
    if (!initialized) {
        await loadMeSpeakModel();
    }

    const startTime = performance.now();

    // Generate WAV as ArrayBuffer
    const wavData = meSpeak.speak(text, {
        amplitude: 100,
        pitch: 50,
        speed: 175,
        rawdata: 'array' // Returns as array
    });

    console.log(`meSpeak generation took ${Math.round(performance.now() - startTime)}ms`);

    if (!wavData) {
        throw new Error("Failed to generate audio");
    }

    // Convert to Blob
    const blob = new Blob([new Uint8Array(wavData)], { type: 'audio/wav' });
    return blob;
};
