import React, { memo } from 'react';
import { Upload, BookOpen } from 'lucide-react';

/**
 * TextViewer component
 * Memoized to prevent re-renders when parent state (like playback progress) changes.
 * This ensures large text content doesn't need to be reconciled on every audio chunk.
 */
const TextViewer = memo(({ paraList, isLoading, handleFileUpload }) => {
  if (paraList.length > 0) {
    return (
      <div className="text-viewer fade-in">
        <div className="text-content">
          {paraList.map((para, i) => <p key={i}>{para}</p>)}
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
        <input type="file" accept=".txt,.docx" onChange={handleFileUpload} hidden />
      </label>
      {isLoading && <div className="loader"></div>}
    </div>
  );
});

export default TextViewer;
