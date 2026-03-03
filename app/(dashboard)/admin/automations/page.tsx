'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AutomationRuleForm } from '@/components/admin/automation-rule-form';
import { AutomationRuleList } from '@/components/admin/automation-rule-list';

export default function AutomationsPage() {
  const router = useRouter();
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch('/api/automations');
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const handleCreate = async (data: any) => {
    setCreating(true);
    try {
      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setShowForm(false);
        fetchRules();
      }
    } catch { /* silent */ }
    setCreating(false);
  };

  const handleToggle = async (id: string, active: boolean) => {
    await fetch(`/api/automations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: active }),
    });
    fetchRules();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta regra de automacao?')) return;
    await fetch(`/api/automations/${id}`, { method: 'DELETE' });
    fetchRules();
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin" className="text-purple-300/40 hover:text-purple-300/60 text-sm transition-colors">
              Admin
            </Link>
            <span className="text-purple-300/20">/</span>
            <span className="text-sm text-neutral-100">Automacoes</span>
          </div>
          <h1 className="text-xl font-bold text-neutral-100">Automacoes</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Regras automaticas para seu pipeline</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nova Regra
        </button>
      </div>

      {showForm && (
        <div className="mb-6 bg-[#1e0f35] border border-purple-800/30 rounded-lg p-5">
          <h2 className="text-sm font-medium text-neutral-100 mb-4">Criar Nova Regra</h2>
          <AutomationRuleForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} loading={creating} />
        </div>
      )}

      <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-5">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-5 h-5 border-2 border-purple-800/30 border-t-emerald-500 rounded-full" />
          </div>
        ) : (
          <AutomationRuleList rules={rules} onToggle={handleToggle} onDelete={handleDelete} />
        )}
      </div>
    </div>
  );
}
