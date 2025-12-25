import React, { memo, useMemo } from 'react';
import { Upload, BookOpen } from 'lucide-react';

/**
 * TextViewer component
 * Memoized to prevent re-renders when parent state (like playback progress) changes.
 * This ensures large text content doesn't need to be reconciled on every audio chunk.
 */
const TextViewer = memo(({ paraList, isLoading, handleFileUpload }) => {
  const chunks = useMemo(() => {
    const res = [];
    const chunkSize = 50;
    for (let i = 0; i < paraList.length; i += chunkSize) {
      res.push(paraList.slice(i, i + chunkSize));
    }
    return res;
  }, [paraList]);

  if (paraList.length > 0) {
    return (
      <div className="text-viewer fade-in">
        <div className="text-content">
          {chunks.map((chunk, chunkIndex) => (
            <div key={chunkIndex} className="text-page">
              {chunk.map((para, i) => (
                <p key={chunkIndex * 50 + i}>{para}</p>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="empty-state">
      <div className="empty-icon-wrap"><BookOpen size={80} color="#DDD" /></div>
      <h2>Prêt pour une lecture AI?</h2>
      <p>Importez un livre et activez le mode "Neural (Gratuit)"</p>
      <label className="upload-button">
        <Upload size={20} />
        <span>Charger un livre</span>
        <input
          type="file"
          accept=".txt,.docx"
          onChange={handleFileUpload}
          className="visually-hidden"
        />
      </label>
      {isLoading && <div className="loader"></div>}
    </div>
  );
});

export default TextViewer;
