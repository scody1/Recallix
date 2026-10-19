import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, FileText, ExternalLink } from 'lucide-react';
import { BACKEND_BASE } from '../../services/api';

interface PdfPageModalProps {
  imageUrl?: string | null;
  pageNumber: number;
  sourceFilename: string;
  questionNumber?: string;
  onClose: () => void;
}

export const PdfPageModal: React.FC<PdfPageModalProps> = ({
  imageUrl,
  pageNumber,
  sourceFilename,
  questionNumber,
  onClose,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  if (!imageUrl) return null;

  // Construct absolute URL
  const fullUrl = imageUrl.startsWith('http') ? imageUrl : `${BACKEND_BASE}${imageUrl}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col p-4 md:p-6 animate-fadeIn">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-neutral-800 text-neutral-200">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
              <span>Original Source Page {pageNumber}</span>
              {questionNumber && (
                <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                  Q.{questionNumber}
                </span>
              )}
            </h3>
            <p className="text-[11px] text-neutral-400 font-mono">{sourceFilename}</p>
          </div>
        </div>

        {/* Toolbar & Close */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded-lg p-1">
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.2))}
              className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] text-neutral-300 px-1.5 min-w-[3rem] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
              className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel(1)}
              className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <a
            href={fullUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-rose-950/60 hover:border-rose-800/80 text-neutral-400 hover:text-rose-300 transition-colors cursor-pointer ml-1"
            title="Close viewer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Image Viewport */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        <div
          className="transition-transform duration-150 origin-top shadow-2xl rounded-lg overflow-hidden border border-neutral-800 bg-neutral-900"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          <img
            src={fullUrl}
            alt={`Page ${pageNumber} of ${sourceFilename}`}
            className="max-h-[85vh] w-auto object-contain select-none pointer-events-none"
            loading="eager"
          />
        </div>
      </div>
    </div>
  );
};
