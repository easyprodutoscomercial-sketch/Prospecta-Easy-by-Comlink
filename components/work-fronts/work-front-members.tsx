'use client';

import { useState, useEffect } from 'react';
import type { WorkFrontMember, Profile } from '@/lib/types';
import { WF_ROLE_LABELS } from '@/lib/utils/labels';
import { useToast } from '@/lib/toast-context';
import { getUserInitials } from '@/lib/utils/user-colors';
import ConfirmModal from '@/components/ui/confirm-modal';

interface WorkFrontMembersProps {
  workFrontId: string;
  members: WorkFrontMember[];
  setMembers: React.Dispatch<React.SetStateAction<WorkFrontMember[]>>;
}

export default function WorkFrontMembers({ workFrontId, members, setMembers }: WorkFrontMembersProps) {
  const toast = useToast();
  const [orgUsers, setOrgUsers] = useState<Profile[]>([]);
  const [addUserId, setAddUserId] = useState('');
  const [addRole, setAddRole] = useState<'member' | 'lead'>('member');
  const [adding, setAdding] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await fetch('/api/users');
        if (res.ok) {
          const data = await res.json();
          setOrgUsers(data.users || []);
        }
      } catch { /* silent */ }
    };
    loadUsers();
  }, []);

  const memberUserIds = new Set(members.map((m) => m.user_id));
  const availableUsers = orgUsers.filter((u) => !memberUserIds.has(u.user_id));

  const handleAdd = async () => {
    if (!addUserId) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/work-fronts/${workFrontId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: addUserId, role: addRole }),
      });
      if (res.ok) {
        const data = await res.json();
        const user = orgUsers.find((u) => u.user_id === addUserId);
        setMembers((prev) => [...prev, { ...data, user_name: user?.name, user_email: user?.email, avatar_url: user?.avatar_url }]);
        setAddUserId('');
        toast.success('Membro adicionado');
      } else {
        const d = await res.json();
        toast.error(d.error || 'Erro ao adicionar');
      }
    } catch {
      toast.error('Erro ao adicionar');
    }
    setAdding(false);
  };

  const handleRemove = async () => {
    if (!removeId) return;
    setRemoveLoading(true);
    try {
      const res = await fetch(`/api/work-fronts/${workFrontId}/members/${removeId}`, { method: 'DELETE' });
      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.user_id !== removeId));
        toast.success('Membro removido');
      } else {
        const d = await res.json();
        toast.error(d.error || 'Erro ao remover');
      }
    } catch {
      toast.error('Erro ao remover');
    }
    setRemoveId(null);
    setRemoveLoading(false);
  };

  return (
    <div>
      {/* Add member */}
      <div className="flex items-center gap-2 mb-4">
        <select
          value={addUserId}
          onChange={(e) => setAddUserId(e.target.value)}
          className="flex-1 px-3 py-2 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
        >
          <option value="">Selecionar usuario...</option>
          {availableUsers.map((u) => (
            <option key={u.user_id} value={u.user_id}>{u.name} ({u.email})</option>
          ))}
        </select>
        <select
          value={addRole}
          onChange={(e) => setAddRole(e.target.value as 'member' | 'lead')}
          className="px-3 py-2 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
        >
          <option value="member">Membro</option>
          <option value="lead">Lider</option>
        </select>
        <button
          onClick={handleAdd}
          disabled={!addUserId || adding}
          className="px-3 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {adding ? '...' : 'Adicionar'}
        </button>
      </div>

      {/* Members list */}
      {members.length > 0 ? (
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-3 p-3 bg-[#160b2e] rounded-lg border border-purple-800/15">
              <div className="w-8 h-8 rounded-full bg-purple-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
                {getUserInitials(m.user_name || '?')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-200 truncate">{m.user_name || 'Usuario'}</p>
                <p className="text-xs text-neutral-500">{m.user_email}</p>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${m.role === 'lead' ? 'bg-amber-500/20 text-amber-400' : 'bg-purple-800/30 text-purple-300/50'}`}>
                {WF_ROLE_LABELS[m.role] || m.role}
              </span>
              <button
                onClick={() => setRemoveId(m.user_id)}
                className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors"
                title="Remover"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-sm text-neutral-500">Nenhum membro adicionado</p>
        </div>
      )}

      <ConfirmModal
        isOpen={!!removeId}
        onClose={() => setRemoveId(null)}
        onConfirm={handleRemove}
        title="Remover membro"
        message="Tem certeza que deseja remover este membro da frente?"
        variant="danger"
        confirmLabel="Remover"
        loading={removeLoading}
      />
    </div>
  );
}
