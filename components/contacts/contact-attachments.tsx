'use client';

import { useState, useRef, useCallback } from 'react';
import { ContactAttachment } from '@/lib/types';
import ConfirmModal from '@/components/ui/confirm-modal';
import { useToast } from '@/lib/toast-context';

interface ContactAttachmentsProps {
  contactId: string;
  attachments: (ContactAttachment & { public_url: string })[];
  setAttachments: React.Dispatch<React.SetStateAction<(ContactAttachment & { public_url: string })[]>>;
  canModify: boolean;
}

const FILE_ICONS: Record<string, { icon: string; color: string }> = {
  'application/pdf': { icon: 'PDF', color: 'bg-red-500/20 text-red-400' },
  'image/jpeg': { icon: 'JPG', color: 'bg-blue-500/20 text-blue-400' },
  'image/png': { icon: 'PNG', color: 'bg-blue-500/20 text-blue-400' },
  'image/webp': { icon: 'WEBP', color: 'bg-blue-500/20 text-blue-400' },
  'image/gif': { icon: 'GIF', color: 'bg-purple-500/20 text-purple-400' },
  'application/msword': { icon: 'DOC', color: 'bg-blue-600/20 text-blue-300' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { icon: 'DOCX', color: 'bg-blue-600/20 text-blue-300' },
  'application/vnd.ms-excel': { icon: 'XLS', color: 'bg-green-500/20 text-green-400' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { icon: 'XLSX', color: 'bg-green-500/20 text-green-400' },
  'text/csv': { icon: 'CSV', color: 'bg-green-500/20 text-green-400' },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function ContactAttachments({ contactId, attachments, setAttachments, canModify }: ContactAttachmentsProps) {
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

      const r = await fetch(`/api/contacts/${contactId}/attachments`, {
        method: 'POST',
        body: formData,
      });

      if (r.ok) {
        const attachment = await r.json();
        setAttachments((prev) => [attachment, ...prev]);
        toast.success(`"${file.name}" enviado com sucesso`);
      } else {
        const d = await r.json();
        toast.error(d.error || 'Erro ao enviar arquivo');
      }
    } catch {
      toast.error('Erro ao enviar arquivo');
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
  }, [contactId]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const r = await fetch(`/api/contacts/${contactId}/attachments/${deleteId}`, { method: 'DELETE' });
      if (r.ok) {
        setAttachments((prev) => prev.filter((a) => a.id !== deleteId));
        toast.success('Arquivo removido');
      } else {
        const d = await r.json();
        toast.error(d.error || 'Erro ao remover');
      }
    } catch {
      toast.error('Erro ao remover');
    }
    setDeleteId(null);
    setDeleteLoading(false);
  };

  return (
    <div>
      {/* Upload zone */}
      {canModify && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`mb-6 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors text-center ${
            dragOver
              ? 'border-emerald-500 bg-emerald-500/10'
              : 'border-purple-700/30 hover:border-purple-600/50 bg-[#2a1245]/30'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.doc,.docx,.xls,.xlsx,.csv"
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
              <p className="text-sm text-neutral-400">Clique ou arraste um arquivo aqui</p>
              <p className="text-xs text-neutral-600 mt-1">PDF, imagens, DOC, XLS, CSV (max 10MB)</p>
            </>
          )}
        </div>
      )}

      {/* File list */}
      {attachments.length > 0 ? (
        <div className="space-y-2">
          {attachments.map((att) => {
            const fileInfo = FILE_ICONS[att.mime_type] || { icon: 'FILE', color: 'bg-neutral-500/20 text-neutral-400' };
            return (
              <div key={att.id} className="flex items-center gap-3 p-3 bg-[#2a1245]/40 rounded-lg border border-purple-700/20 hover:border-purple-700/40 transition-colors">
                {/* Icon */}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${fileInfo.color}`}>
                  {fileInfo.icon}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-neutral-200 truncate">{att.file_name}</p>
                  <p className="text-xs text-neutral-500">
                    {formatFileSize(att.file_size)} · {new Date(att.created_at).toLocaleDateString('pt-BR')} · {att.uploaded_by_name}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={att.public_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-neutral-500 hover:text-emerald-400 rounded transition-colors"
                    title="Download"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </a>
                  {canModify && (
                    <button
                      onClick={() => setDeleteId(att.id)}
                      className="p-1.5 text-neutral-500 hover:text-red-400 rounded transition-colors"
                      title="Excluir"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-10">
          <svg className="w-12 h-12 mx-auto mb-3 text-purple-700/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm text-neutral-500">Nenhum arquivo anexado</p>
          {canModify && <p className="text-xs text-neutral-600 mt-1">Arraste ou clique acima para enviar</p>}
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Excluir arquivo"
        message="Tem certeza que deseja excluir este arquivo? Esta acao e irreversivel."
        variant="danger"
        confirmLabel="Excluir"
        loading={deleteLoading}
      />
    </div>
  );
}
