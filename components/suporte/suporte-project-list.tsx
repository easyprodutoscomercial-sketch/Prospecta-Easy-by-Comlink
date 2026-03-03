'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { SupportProject } from '@/lib/types';
import { useToast } from '@/lib/toast-context';
import ConfirmModal from '@/components/ui/confirm-modal';

interface SuporteProjectListProps {
  projects: SupportProject[];
  onEdit: (project: SupportProject) => void;
  onDelete: (projectId: string) => void;
}

export default function SuporteProjectList({ projects, onEdit, onDelete }: SuporteProjectListProps) {
  const toast = useToast();
  const [deleteTarget, setDeleteTarget] = useState<SupportProject | null>(null);
  const [deleting, setDeleting] = useState(false);

  const getPortalUrl = (token: string) => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/portal/${token}`;
    }
    return `/portal/${token}`;
  };

  const copyLink = (token: string) => {
    const url = getPortalUrl(token);
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/suporte/projects/${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Projeto removido');
        onDelete(deleteTarget.id);
      } else {
        toast.error('Erro ao remover projeto');
      }
    } catch {
      toast.error('Erro ao remover projeto');
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  if (projects.length === 0) {
    return (
      <div className="text-center py-16">
        <svg className="w-16 h-16 mx-auto mb-4 text-purple-700/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <p className="text-neutral-400 text-sm">Nenhum projeto criado</p>
        <p className="text-neutral-600 text-xs mt-1">Crie um projeto para organizar seus chamados</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => (
          <div
            key={project.id}
            className="bg-[#1e0f35] rounded-xl border border-purple-800/20 p-4 hover:border-purple-600/40 transition-all"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-neutral-100 truncate">{project.name}</h3>
                {project.description && (
                  <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{project.description}</p>
                )}
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ml-2 ${
                project.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-neutral-500/20 text-neutral-400'
              }`}>
                {project.is_active ? 'Ativo' : 'Inativo'}
              </span>
            </div>

            {/* Info */}
            <div className="space-y-1 mb-3">
              {project.contact_name && (
                <div className="flex items-center gap-1.5">
                  <svg className="w-3 h-3 text-purple-400/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-[10px] text-purple-300/50">{project.contact_name}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <svg className="w-3 h-3 text-purple-400/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span className="text-[10px] text-purple-300/50">{project.ticket_count || 0} chamados</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 pt-3 border-t border-purple-800/15">
              <button
                onClick={() => copyLink(project.token)}
                className="flex items-center gap-1 px-2 py-1.5 text-[10px] font-medium text-neutral-400 hover:text-emerald-400 bg-purple-800/10 hover:bg-emerald-500/10 rounded transition-colors"
                title="Copiar link do portal"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copiar Link
              </button>
              <Link
                href={`/portal/${project.token}`}
                target="_blank"
                className="flex items-center gap-1 px-2 py-1.5 text-[10px] font-medium text-neutral-400 hover:text-cyan-400 bg-purple-800/10 hover:bg-cyan-500/10 rounded transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Abrir Portal
              </Link>
              <Link
                href={`/suporte?project_id=${project.id}`}
                className="flex items-center gap-1 px-2 py-1.5 text-[10px] font-medium text-neutral-400 hover:text-purple-400 bg-purple-800/10 hover:bg-purple-500/10 rounded transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                Chamados
              </Link>
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={() => onEdit(project)}
                  className="p-1.5 text-neutral-500 hover:text-neutral-300 transition-colors"
                  title="Editar"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => setDeleteTarget(project)}
                  className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors"
                  title="Excluir"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir projeto"
        message={`Tem certeza que deseja excluir "${deleteTarget?.name}"? Os chamados vinculados nao serao excluidos.`}
        variant="danger"
        confirmLabel="Excluir"
        loading={deleting}
      />
    </>
  );
}
