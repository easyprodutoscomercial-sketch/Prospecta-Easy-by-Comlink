'use client';

interface BugMediaViewerProps {
  url: string;
  mime: string;
  onClose: () => void;
}

export default function BugMediaViewer({ url, mime, onClose }: BugMediaViewerProps) {
  const isVideo = mime.startsWith('video/');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm" onClick={onClose}>
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        {isVideo ? (
          <video src={url} controls autoPlay className="max-w-full max-h-[90vh] rounded-lg" />
        ) : (
          <img src={url} alt="Preview" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
        )}
      </div>
    </div>
  );
}
