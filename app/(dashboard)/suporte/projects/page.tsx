'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { SupportProject } from '@/lib/types';
import SuporteProjectForm from '@/components/suporte/suporte-project-form';
import SuporteProjectList from '@/components/suporte/suporte-project-list';

export default function SuporteProjectsPage() {
  const [projects, setProjects] = useState<SupportProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editProject, setEditProject] = useState<SupportProject | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/suporte/projects');
        if (res.ok) {
          const d = await res.json();
          setProjects(d.projects || []);
        }
      } catch { /* silent */ }
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = (saved: SupportProject) => {
    if (editProject) {
      setProjects((prev) => prev.map((p) => p.id === saved.id ? { ...p, ...saved } : p));
    } else {
      setProjects((prev) => [saved, ...prev]);
    }
    setShowForm(false);
    setEditProject(null);
  };

  const handleEdit = (project: SupportProject) => {
    setEditProject(project);
    setShowForm(true);
  };

  const handleDelete = (projectId: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/suporte"
            className="text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-neutral-100">Projetos</h1>
            <p className="text-sm text-neutral-500 mt-0.5">Gerencie projetos e portais de chamados</p>
          </div>
        </div>
        <button
          onClick={() => { setEditProject(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Projeto
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1e0f35] rounded-xl border border-purple-800/20 p-6 w-full max-w-lg mx-4 shadow-2xl">
            <h2 className="text-lg font-bold text-neutral-100 mb-4">
              {editProject ? 'Editar Projeto' : 'Novo Projeto'}
            </h2>
            <SuporteProjectForm
              project={editProject}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditProject(null); }}
            />
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[#1e0f35] rounded-xl border border-purple-800/20 p-4 animate-pulse">
              <div className="h-4 bg-purple-800/30 rounded w-2/3 mb-2" />
              <div className="h-3 bg-purple-800/20 rounded w-full mb-4" />
              <div className="h-8 bg-purple-800/10 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <SuporteProjectList
          projects={projects}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
