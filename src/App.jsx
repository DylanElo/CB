import React, { useState, useEffect, useRef } from 'react';
import mammoth from 'mammoth';
import {
  Book,
  Settings,
  Play,
  Pause,
  Square,
  Upload,
  X,
  FileText,
  Volume2,
  BookOpen,
  Sparkles,
  Key
} from 'lucide-react';
import './App.css';
import { PIPER_VOICES, loadPiperModel, generatePiperAudio } from './utils/piper-engine';
import { KOKORO_VOICES, loadKokoroModel, generateKokoroAudio } from './utils/kokoro-engine';

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

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsLoading(true);
    try {
      if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        const content = await file.text();
        processText(content);
      } else if (file.name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        processText(result.value);
      }
      stopReading();
    } catch (_err) {
      alert("Erreur de lecture");
    } finally {
      setIsLoading(false);
    }
  };

  const processText = (rawText) => {
    setText(rawText);
    const filteredPara = rawText.split('\n').filter(p => p.trim().length > 0);
    setParaList(filteredPara);
  };

  const chunkText = (str) => {
    const isPremium = provider === 'local';
    const maxLength = isPremium ? 200 : 250; // Smaller chunks for Local AI results in better UI responsiveness
    const parts = str.match(/[^.!?]+[.!?]*|/g) || [str];
    const finalChunks = [];

    let currentChunk = "";
    for (const part of parts) {
      if ((currentChunk + part).length > maxLength && currentChunk) {
        finalChunks.push(currentChunk.trim());
        currentChunk = part;
      } else {
        currentChunk += part;
      }
    }
    if (currentChunk) finalChunks.push(currentChunk.trim());
    return finalChunks.filter(c => c.length > 0);
  };

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
        await loadPiperModel(selectedVoice.id);
        blob = await generatePiperAudio(chunk, selectedVoice.id);
      } else if (selectedVoice.provider === 'Local') {
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
    chunks.current = chunkText(text);
    setIsSpeaking(true);
    speakNextChunk();
  };

  const pauseReading = () => {
    if (audioRef.current) audioRef.current.pause();
    else synth.pause();
    setIsSpeaking(false);
    setIsPaused(true);
  };

  const stopReading = () => {
    synth.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsSpeaking(false);
    setIsPaused(false);
    currentChunkIndex.current = 0;
    setProgress(0);
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo-container">
          <Book className="logo-icon" color={COLORS.primary} size={28} />
          <h1>Liseuse Vocale 3.0</h1>
        </div>
        <button className="icon-button" onClick={() => setShowSettings(true)}>
          <Settings size={24} />
        </button>
      </header>

      <main className="content">
        {paraList.length > 0 ? (
          <div className="text-viewer fade-in">
            <div className="text-content">
              {paraList.map((para, i) => <p key={i}>{para}</p>)}
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon-wrap"><BookOpen size={80} color="#DDD" /></div>
            <h2>Prêt pour une lecture AI?</h2>
            <p>Importez un livre et activez le mode "Neural (Gratuit)"</p>
            <label className="upload-button">
              <Upload size={20} />
              <span>Charger un livre</span>
              <input type="file" accept=".txt,.docx" onChange={handleFileUpload} hidden />
            </label>
            {isLoading && <div className="loader"></div>}
          </div>
        )}
      </main>

      {paraList.length > 0 && (
        <div className="player-bar-container fade-in">
          <div className="player-bar-extended">
            <div className="progress-container">
              <div className="progress-fill" style={{ width: `${progress}%` }}></div>
            </div>
            <div className="player-main">
              <div className="player-info">
                <div className="voice-tag">
                  {provider !== 'standard' ? <Sparkles size={14} color={COLORS.local} /> : <Volume2 size={14} />}
                  <span>{selectedVoice ? selectedVoice.name : "Voix par défaut"}</span>
                </div>
                <div className="progress-text">{progress}% lu</div>
              </div>
              <div className="player-controls">
                <button className="control-button stop" onClick={stopReading}>
                  <Square size={18} fill={COLORS.error} color={COLORS.error} />
                </button>
                <button className="play-button" onClick={isSpeaking ? pauseReading : startReading}>
                  {isSpeaking ? <Pause size={28} fill="#FFF" /> : <Play size={28} fill="#FFF" />}
                </button>
                <button className="control-button" onClick={() => setShowSettings(true)}>
                  <Settings size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Options de Narration</h2>
              <button className="icon-button" onClick={() => setShowSettings(false)}><X size={24} /></button>
            </div>

            <div className="setting-section">
              <label>Voix de Lecture</label>
              <div className="voice-list">
                {voices.map((v, i) => (
                  <div key={v.voiceURI || i} className={`voice-item ${selectedVoice?.voiceURI === v.voiceURI ? 'active' : ''}`} onClick={() => { setSelectedVoice(v); stopReading(); }}>
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
