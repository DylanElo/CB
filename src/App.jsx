import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Book,
  Settings,
  Play,
  Pause,
  Square,
  X,
  Volume2,
  Sparkles,
  Loader2
} from 'lucide-react';
import './App.css';
import TextViewer from './TextViewer';
import { PIPER_VOICES, KOKORO_VOICES } from './utils/voices';
import { sanitizeInputText } from './utils/security';

// Using only Standard Web Speech API for reliability

const COLORS = {
  primary: '#4A90E2',
  background: '#FDFBF7',
  text: '#2D2D2D',
  textLight: '#7F8C8D',
  card: '#FFFFFF',
  error: '#FF6B6B',
  local: '#00897B'
};

const VERSION = "1.3.3"; // PWA Cache Buster Version

const GEMINI_VOICES = []; // Removed

// Security: Limit input size to prevent denial of service (browser crash)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TEXT_LENGTH = 1000000; // 1 Million characters (~1MB raw text) to prevent DOM freeze

// Helper functions moved outside component to prevent recreation on render
const sortVoices = (vList) => {
  return [...vList].sort((a, b) => {
    const langA = (a.lang || '').toLowerCase();
    const langB = (b.lang || '').toLowerCase();
    if (langA.includes('fr') && !langB.includes('fr')) return -1;
    if (!langA.includes('fr') && langB.includes('fr')) return 1;
    return a.name.localeCompare(b.name);
  });
};

const setDefaultVoice = (vList) => {
  return vList.find(v => v.lang.includes('fr')) ||
    vList.find(v => v.lang.includes('en')) ||
    vList[0];
};

/**
 * Optimized text chunking
 * Uses iterative scanning instead of regex match to avoid memory spikes with large texts.
 * Also correctly preserves leading terminators (e.g. "...") which were stripped by the previous regex.
 */
const chunkText = (str, provider) => {
  const isPremium = provider === 'local';
  const maxLength = isPremium ? 200 : 250; // Smaller chunks for Local AI results in better UI responsiveness
  const finalChunks = [];

  // Helper to split long text segments safely
  const processLongPart = (part) => {
    const result = [];
    let remaining = part;

    while (remaining.length > maxLength) {
      // Try to split at the last space within the limit to preserve words
      let splitIndex = remaining.lastIndexOf(' ', maxLength);

      // If no space found, or space is at the very beginning (prevention of infinite loop), hard split
      if (splitIndex <= 0) {
        splitIndex = maxLength;
      }

      result.push(remaining.slice(0, splitIndex).trim());
      remaining = remaining.slice(splitIndex);
    }
    if (remaining.trim().length > 0) {
      result.push(remaining.trim());
    }
    return result;
  };

  let scanIndex = 0;
  let chunkBuilder = "";

  // Match one or more terminators, or end of string
  const re = /[.!?]+|$/g;
  let match;

  while (scanIndex < str.length) {
    re.lastIndex = scanIndex;
    match = re.exec(str);

    if (match) {
      const endOfPart = match.index + match[0].length;
      let part;

      if (match[0].length === 0 && match.index === str.length) {
        // End of string matched
        part = str.slice(scanIndex);
        if (part === "") break;
      } else {
        // Terminator matched
        part = str.slice(scanIndex, endOfPart);
      }

      // Security Fix: Prevent huge chunks from blocking the thread/TTS
      if (part.length > maxLength) {
        if (chunkBuilder.length > 0) {
          finalChunks.push(chunkBuilder.trim());
          chunkBuilder = "";
        }
        const subChunks = processLongPart(part);
        subChunks.forEach(c => finalChunks.push(c));
      } else if ((chunkBuilder.length + part.length) > maxLength && chunkBuilder.length > 0) {
        finalChunks.push(chunkBuilder.trim());
        chunkBuilder = part;
      } else {
        chunkBuilder += part;
      }

      scanIndex = endOfPart;
      if (scanIndex >= str.length) break;
    } else {
      // Fallback (should not happen due to |$)
      const part = str.slice(scanIndex);
      if (part.length > maxLength) {
        if (chunkBuilder.length > 0) {
          finalChunks.push(chunkBuilder.trim());
          chunkBuilder = "";
        }
        const subChunks = processLongPart(part);
        subChunks.forEach(c => finalChunks.push(c));
      } else if ((chunkBuilder.length + part.length) > maxLength && chunkBuilder.length > 0) {
        finalChunks.push(chunkBuilder.trim());
        chunkBuilder = part;
      } else {
        chunkBuilder += part;
      }
      break;
    }
  }

  if (chunkBuilder) finalChunks.push(chunkBuilder.trim());
  return finalChunks.filter(c => c.length > 0);
};

function App() {
  const [text, setText] = useState("");
  const [paraList, setParaList] = useState([]);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Provider Settings (simplified - Standard only for now)
  const [provider] = useState('standard');

  const synth = window.speechSynthesis;
  const currentChunkIndex = useRef(0);
  const chunks = useRef([]);
  const audioRef = useRef(null);

  // Optimization: specific refs for lazy memoization of chunks
  const lastChunkedText = useRef(null);
  const lastProvider = useRef(null);
  const cachedChunks = useRef([]);

  useEffect(() => {
    const loadVoices = () => {
      const standardVoices = synth.getVoices().map(v => ({
        name: v.name,
        lang: v.lang,
        voiceURI: v.voiceURI,
        provider: 'standard',
        original: v
      }));

      const allVoices = [
        ...standardVoices,
        ...PIPER_VOICES,
        ...KOKORO_VOICES
      ];

      if (allVoices.length > 0) {
        const sorted = sortVoices(allVoices);
        setVoices(sorted);

        if (!selectedVoice) {
          setSelectedVoice(setDefaultVoice(sorted));
        }
      }
    };

    loadVoices();
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = loadVoices;
    }

    return () => stopReading();
  }, []);

  useEffect(() => {
    localStorage.setItem('tts_provider', provider);
  }, [provider]);

  const stopReading = useCallback(() => {
    synth.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsSpeaking(false);
    setIsPaused(false);
    currentChunkIndex.current = 0;
    setProgress(0);
  }, [synth]);

  const processText = useCallback((rawText) => {
    // Security: Sanitize text to remove control characters, normalize unicode, and strip dangerous sequences
    const sanitized = sanitizeInputText(rawText);

    if (sanitized.length > MAX_TEXT_LENGTH) {
      alert(`Le texte est trop long (${sanitized.length} caractères). Il a été tronqué à ${MAX_TEXT_LENGTH} pour éviter de bloquer le navigateur.`);
      setText(sanitized.slice(0, MAX_TEXT_LENGTH));
      const filteredPara = sanitized.slice(0, MAX_TEXT_LENGTH).split('\n').filter(p => p.trim().length > 0);
      setParaList(filteredPara);
    } else {
      setText(sanitized);
      const filteredPara = sanitized.split('\n').filter(p => p.trim().length > 0);
      setParaList(filteredPara);
    }
  }, []);

  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      alert("Le fichier est trop volumineux. La limite est de 10MB pour éviter de bloquer le navigateur.");
      return;
    }

    setIsLoading(true);
    try {
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith('.txt') || file.type === 'text/plain') {
        const content = await file.text();
        processText(content);
      } else if (fileName.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const { extractRawText } = await import('mammoth');
        const result = await extractRawText({ arrayBuffer });
        processText(result.value);
      } else {
        alert("Format de fichier non supporté. Veuillez utiliser .txt ou .docx");
      }
      stopReading();
    } catch (err) {
      console.error("File read error", err); // Keep for debugging but sanitize sensitive info if needed
      alert("Erreur de lecture du fichier.");
    } finally {
      setIsLoading(false);
      // Reset input so same file can be selected again if needed
      e.target.value = null;
    }
  }, [processText, stopReading]);

  const speakNextChunk = async () => {
    if (currentChunkIndex.current >= chunks.current.length) {
      setIsSpeaking(false);
      setIsPaused(false);
      setProgress(100);
      return;
    }

    const p = Math.floor((currentChunkIndex.current / chunks.current.length) * 100);
    setProgress(p);

    const chunk = chunks.current[currentChunkIndex.current];

    if (selectedVoice?.provider && selectedVoice.provider !== 'standard') {
      await speakLocalNeuralChunk(chunk);
    } else {
      speakStandardChunk(chunk);
    }
  };

  const speakStandardChunk = (chunk) => {
    const utterance = new SpeechSynthesisUtterance(chunk);
    if (selectedVoice && selectedVoice.provider === 'standard' && selectedVoice.original) {
      utterance.voice = selectedVoice.original;
      utterance.lang = selectedVoice.lang;
    }
    utterance.onend = () => {
      currentChunkIndex.current++;
      speakNextChunk();
    };
    utterance.onerror = () => setIsSpeaking(false);
    synth.speak(utterance);
  };

  // Cloud functions removed

  const speakLocalNeuralChunk = async (chunk) => {
    try {
      if (isLoading) return; // Wait if already loading

      setIsLoading(true);
      let blob = null;

      if (selectedVoice.provider === 'Piper') {
        const { loadPiperModel, generatePiperAudio } = await import('./utils/piper-engine');
        await loadPiperModel(selectedVoice.id);
        blob = await generatePiperAudio(chunk, selectedVoice.id);
      } else if (selectedVoice.provider === 'Local') {
        const { loadKokoroModel, generateKokoroAudio } = await import('./utils/kokoro-engine');
        await loadKokoroModel();
        blob = await generateKokoroAudio(chunk, selectedVoice.id);
      }

      if (blob) {
        playAudioBlob(blob);
      } else {
        throw new Error("No audio generated");
      }
    } catch (err) {
      console.error(err);
      alert("Erreur Neural: Le modèle n'a pas pu être chargé ou généré.");
      setIsSpeaking(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Audio helpers

  const playAudioBlob = (blob) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => {
      URL.revokeObjectURL(url);
      currentChunkIndex.current++;
      speakNextChunk();
    };
    audio.onerror = () => setIsSpeaking(false);
    audio.play();
  };

  const startReading = () => {
    if (!text) return alert("Chargez un livre d'abord.");
    if (isPaused) {
      if (audioRef.current) audioRef.current.play();
      else synth.resume();
      setIsSpeaking(true);
      setIsPaused(false);
      return;
    }
    stopReading();

    // Lazy Memoization: Only re-chunk if text or provider changed
    // This avoids blocking the main thread during "Play" (measured ~240ms for 1.5MB text)
    if (lastChunkedText.current !== text || lastProvider.current !== provider) {
      const newChunks = chunkText(text, provider);
      cachedChunks.current = newChunks;
      chunks.current = [...newChunks]; // Consume a copy to keep cache pristine
      lastChunkedText.current = text;
      lastProvider.current = provider;
    } else {
      chunks.current = [...cachedChunks.current]; // Consume a copy from cache
    }

    setIsSpeaking(true);
    speakNextChunk();
  };

  const pauseReading = () => {
    if (audioRef.current) audioRef.current.pause();
    else synth.pause();
    setIsSpeaking(false);
    setIsPaused(true);
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo-container">
          <Book className="logo-icon" color={COLORS.primary} size={28} aria-hidden="true" />
          <h1>Liseuse Vocale 3.0</h1>
        </div>
        <button className="icon-button" onClick={() => setShowSettings(true)} aria-label="Paramètres">
          <Settings size={24} />
        </button>
      </header>

      <main className="content">
        <TextViewer
          paraList={paraList}
          isLoading={isLoading}
          handleFileUpload={handleFileUpload}
        />
      </main>

      {paraList.length > 0 && (
        <div className="player-bar-container fade-in">
          <div className="player-bar-extended">
            <div
              className="progress-container"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin="0"
              aria-valuemax="100"
              aria-label="Progression de la lecture"
            >
              <div className="progress-fill" style={{ width: `${progress}%` }}></div>
            </div>
            <div className="player-main">
              <div className="player-info">
                <div className="voice-tag">
                  {provider !== 'standard' ? <Sparkles size={14} color={COLORS.local} aria-hidden="true" /> : <Volume2 size={14} aria-hidden="true" />}
                  <span>{selectedVoice ? selectedVoice.name : "Voix par défaut"}</span>
                </div>
                <div className="progress-text">{progress}% lu</div>
              </div>
              <div className="player-controls">
                <button className="control-button stop" onClick={stopReading} aria-label="Arrêter la lecture">
                  <Square size={18} fill={COLORS.error} color={COLORS.error} />
                </button>
                <button
                  className="play-button"
                  onClick={isLoading ? undefined : (isSpeaking ? pauseReading : startReading)}
                  aria-label={isLoading ? "Chargement..." : (isSpeaking ? "Pause" : "Lecture")}
                  aria-busy={isLoading}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="spinner-white" aria-hidden="true"></div>
                  ) : (
                    isSpeaking ? <Pause size={28} fill="#FFF" /> : <Play size={28} fill="#FFF" />
                  )}
                </button>
                <button className="control-button" onClick={() => setShowSettings(true)} aria-label="Paramètres de lecture">
                  <Settings size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal-header">
              <h2 id="modal-title">Options de Narration</h2>
              <button className="icon-button" onClick={() => setShowSettings(false)} aria-label="Fermer"><X size={24} /></button>
            </div>

            <div className="setting-section">
              <label>Voix de Lecture</label>
              <div className="voice-list" role="listbox" aria-label="Liste des voix">
                {voices.map((v, i) => (
                  <div
                    key={v.voiceURI || i}
                    className={`voice-item ${selectedVoice?.voiceURI === v.voiceURI ? 'active' : ''}`}
                    onClick={() => { setSelectedVoice(v); stopReading(); }}
                    role="option"
                    aria-selected={selectedVoice?.voiceURI === v.voiceURI}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedVoice(v);
                        stopReading();
                      }
                    }}
                  >
                    <div className="voice-name">{v.name}</div>
                    <div className="voice-lang">{v.lang}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="setting-section about">
              <label>Statut & Système</label>
              <p>BookReader Web v{VERSION} (Dec 2025)</p>
              <button
                className="clear-cache-btn"
                onClick={() => {
                  if (confirm("Forcer la mise à jour et vider le cache ?")) {
                    caches.keys().then(names => {
                      for (let name of names) caches.delete(name);
                    });
                    localStorage.clear();
                    window.location.reload(true);
                  }
                }}
              >
                Forcer la mise à jour complète
              </button>
            </div>
            <button className="close-modal-btn" onClick={() => setShowSettings(false)}>Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
