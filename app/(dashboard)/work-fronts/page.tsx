'use client';

import { useState, useEffect } from 'react';
import type { WorkFrontWithMembers } from '@/lib/types';
import WorkFrontList from '@/components/work-fronts/work-front-list';
import WorkFrontForm from '@/components/work-fronts/work-front-form';

export default function WorkFrontsPage() {
  const [workFronts, setWorkFronts] = useState<WorkFrontWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const loadWorkFronts = async () => {
    try {
      const res = await fetch('/api/work-fronts');
      if (res.ok) {
        const data = await res.json();
        setWorkFronts(data.work_fronts || []);
      }
    } catch { /* silent */ }
    setLoading(false);
  };

  useEffect(() => { loadWorkFronts(); }, []);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-neutral-100">Frentes de Trabalho</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Gerencie equipes, sprints e projetos</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nova Frente
        </button>
      </div>

      <WorkFrontList workFronts={workFronts} loading={loading} />

      {showForm && (
        <WorkFrontForm
          onClose={() => setShowForm(false)}
          onSaved={(wf) => {
            setWorkFronts((prev) => [...prev, { ...wf, members: [], bug_count: 0, active_sprint: null }]);
            setShowForm(false);
          }}
        />
      )}
    </div>
  );
}
