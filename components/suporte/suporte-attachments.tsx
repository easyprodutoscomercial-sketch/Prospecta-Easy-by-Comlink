'use client';

import { useState, useRef, useCallback } from 'react';
import type { SupportAttachment } from '@/lib/types';
import { useToast } from '@/lib/toast-context';
import ConfirmModal from '@/components/ui/confirm-modal';

interface SuporteAttachmentsProps {
  ticketId: string;
  attachments: SupportAttachment[];
  setAttachments: React.Dispatch<React.SetStateAction<SupportAttachment[]>>;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function isImage(mime: string) { return mime.startsWith('image/'); }
function isVideo(mime: string) { return mime.startsWith('video/'); }

export default function SuporteAttachments({ ticketId, attachments, setAttachments }: SuporteAttachmentsProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const r = await fetch(`/api/suporte/${ticketId}/attachments`, { method: 'POST', body: formData });
      if (r.ok) {
        const attachment = await r.json();
        setAttachments((prev) => [attachment, ...prev]);
        toast.success(`"${file.name}" enviado`);
      } else {
        const d = await r.json();
        toast.error(d.error || 'Erro ao enviar');
      }
    } catch {
      toast.error('Erro ao enviar');
    }
    setUploading(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }, [ticketId]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const r = await fetch(`/api/suporte/${ticketId}/attachments/${deleteId}`, { method: 'DELETE' });
      if (r.ok) {
        setAttachments((prev) => prev.filter((a) => a.id !== deleteId));
        toast.success('Arquivo removido');
      } else {
        toast.error('Erro ao remover');
      }
    } catch {
      toast.error('Erro ao remover');
    }
    setDeleteId(null);
    setDeleteLoading(false);
  };

  const images = attachments.filter((a) => isImage(a.mime_type));
  const videos = attachments.filter((a) => isVideo(a.mime_type));
  const others = attachments.filter((a) => !isImage(a.mime_type) && !isVideo(a.mime_type));

  return (
    <div>
      {/* Upload zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => fileInputRef.current?.click()}
        className={`mb-6 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors text-center ${
          dragOver ? 'border-emerald-500 bg-emerald-500/10' : 'border-purple-700/30 hover:border-purple-600/50 bg-[#2a1245]/30'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
        />
        {uploading ? (
          <div className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5 animate-spin text-emerald-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm text-emerald-400">Enviando...</span>
          </div>
        ) : (
          <>
            <svg className="w-8 h-8 mx-auto mb-2 text-purple-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-neutral-400">Clique ou arraste arquivos</p>
            <p className="text-xs text-neutral-600 mt-1">Qualquer tipo de arquivo (max 50MB)</p>
          </>
        )}
      </div>

      {/* Image grid */}
      {images.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-neutral-400 mb-2">Imagens ({images.length})</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {images.map((att) => (
              <div key={att.id} className="relative group rounded-lg overflow-hidden bg-[#160b2e] border border-purple-800/20">
                <img
                  src={att.public_url}
                  alt={att.file_name}
                  className="w-full h-32 object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/80 to-transparent">
                  <p className="text-[10px] text-neutral-300 truncate">{att.file_name}</p>
                  <p className="text-[9px] text-neutral-500">{formatFileSize(att.file_size)}</p>
                </div>
                <button
                  onClick={() => setDeleteId(att.id)}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Video list */}
      {videos.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-neutral-400 mb-2">Videos ({videos.length})</h4>
          <div className="space-y-2">
            {videos.map((att) => (
              <div key={att.id} className="bg-[#160b2e] rounded-lg border border-purple-800/20 p-3">
                <video src={att.public_url} controls className="w-full max-h-64 rounded-lg mb-2" preload="metadata" />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-neutral-300 truncate">{att.file_name}</p>
                    <p className="text-[10px] text-neutral-500">{formatFileSize(att.file_size)}</p>
                  </div>
                  <button onClick={() => setDeleteId(att.id)} className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other files */}
      {others.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-neutral-400 mb-2">Arquivos ({others.length})</h4>
          <div className="space-y-2">
            {others.map((att) => (
              <div key={att.id} className="flex items-center gap-3 p-3 bg-[#160b2e] rounded-lg border border-purple-800/20">
                <svg className="w-5 h-5 text-purple-400/40 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-neutral-300 truncate">{att.file_name}</p>
                  <p className="text-[10px] text-neutral-500">{formatFileSize(att.file_size)}</p>
                </div>
                <a
                  href={att.public_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 text-neutral-500 hover:text-emerald-400 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </a>
                <button onClick={() => setDeleteId(att.id)} className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {attachments.length === 0 && (
        <div className="text-center py-6">
          <p className="text-sm text-neutral-500">Nenhum anexo</p>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Excluir arquivo"
        message="Tem certeza que deseja excluir este arquivo?"
        variant="danger"
        confirmLabel="Excluir"
        loading={deleteLoading}
      />
    </div>
  );
}
