'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Profile } from '@/lib/types';
import { STATUS_LABELS, STATUS_CHART_COLORS } from '@/lib/utils/labels';

const STATUSES = ['NOVO', 'EM_PROSPECCAO', 'CONTATADO', 'REUNIAO_MARCADA', 'CONVERTIDO', 'PERDIDO'] as const;

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string>('');
  const [checkingRole, setCheckingRole] = useState(true);

  // User management state
  const [users, setUsers] = useState<(Profile & { role?: string })[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  const [userResult, setUserResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Pipeline settings
  const [pipelineColumns, setPipelineColumns] = useState<Record<string, { label: string; color: string }>>({});
  const [savingPipeline, setSavingPipeline] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Role change loading
  const [roleChangingId, setRoleChangingId] = useState<string | null>(null);

  // Avatar upload
  const [avatarUploadingId, setAvatarUploadingId] = useState<string | null>(null);

  // Check if user is admin
  useEffect(() => {
    const checkRole = async () => {
      try {
        const res = await fetch('/api/me');
        if (res.ok) {
          const data = await res.json();
          setCurrentRole(data.role);
          if (data.role !== 'admin') {
            router.push('/dashboard');
            return;
          }
        } else {
          router.push('/dashboard');
          return;
        }
      } catch {
        router.push('/dashboard');
        return;
      }
      setCheckingRole(false);
    };
    checkRole();
  }, [router]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users || []);
      }
    } catch {
      // silent
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchPipelineSettings = async () => {
    try {
      const res = await fetch('/api/pipeline-settings');
      if (res.ok) {
        const data = await res.json();
        if (data.columns) {
          setPipelineColumns(data.columns);
        } else {
          // Set defaults
          const defaults: Record<string, { label: string; color: string }> = {};
          for (const s of STATUSES) {
            defaults[s] = { label: STATUS_LABELS[s] || s, color: STATUS_CHART_COLORS[s] || '#a3a3a3' };
          }
          setPipelineColumns(defaults);
        }
      }
    } catch {
      // Set defaults
      const defaults: Record<string, { label: string; color: string }> = {};
      for (const s of STATUSES) {
        defaults[s] = { label: STATUS_LABELS[s] || s, color: STATUS_CHART_COLORS[s] || '#a3a3a3' };
      }
      setPipelineColumns(defaults);
    }
  };

  useEffect(() => {
    if (!checkingRole && currentRole === 'admin') {
      fetchUsers();
      fetchPipelineSettings();
    }
  }, [checkingRole, currentRole]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingUser(true);
    setUserResult(null);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: userName, email: userEmail, password: userPassword }),
      });
      const data = await res.json();

      if (res.ok) {
        setUserResult({ type: 'success', message: `Usuário "${data.user.name}" criado com sucesso.` });
        setUserName('');
        setUserEmail('');
        setUserPassword('');
        fetchUsers();
      } else {
        setUserResult({ type: 'error', message: data.error });
      }
    } catch {
      setUserResult({ type: 'error', message: 'Erro de conexão' });
    } finally {
      setCreatingUser(false);
    }
  };

  const startEditing = (user: Profile) => {
    setEditingId(user.user_id);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditPassword('');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName('');
    setEditEmail('');
    setEditPassword('');
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setSavingEdit(true);
    setUserResult(null);

    try {
      const body: Record<string, string> = { name: editName, email: editEmail };
      if (editPassword) body.password = editPassword;

      const res = await fetch(`/api/users/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.ok) {
        setUserResult({ type: 'success', message: 'Usuário atualizado com sucesso.' });
        cancelEditing();
        fetchUsers();
      } else {
        setUserResult({ type: 'error', message: data.error });
      }
    } catch {
      setUserResult({ type: 'error', message: 'Erro de conexão' });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Tem certeza que deseja excluir o usuário "${userName}"?`)) return;
    setDeletingId(userId);
    setUserResult(null);

    try {
      const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
      const data = await res.json();

      if (res.ok) {
        setUserResult({ type: 'success', message: `Usuário "${userName}" excluído.` });
        fetchUsers();
      } else {
        setUserResult({ type: 'error', message: data.error });
      }
    } catch {
      setUserResult({ type: 'error', message: 'Erro de conexão' });
    } finally {
      setDeletingId(null);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setRoleChangingId(userId);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        setUserResult({ type: 'success', message: `Role atualizado para ${newRole === 'admin' ? 'Admin' : 'Vendedor'}.` });
        fetchUsers();
      } else {
        const data = await res.json();
        setUserResult({ type: 'error', message: data.error });
      }
    } catch {
      setUserResult({ type: 'error', message: 'Erro de conexão' });
    } finally {
      setRoleChangingId(null);
    }
  };

  const handleAvatarUpload = async (userId: string, file: File) => {
    setAvatarUploadingId(userId);
    setUserResult(null);
    const formData = new FormData();
    formData.append('avatar', file);
    formData.append('user_id', userId);

    try {
      const res = await fetch('/api/users/avatar', { method: 'POST', body: formData });
      if (res.ok) {
        setUserResult({ type: 'success', message: 'Foto atualizada com sucesso.' });
        fetchUsers();
      } else {
        const data = await res.json();
        setUserResult({ type: 'error', message: data.error || 'Erro ao enviar foto.' });
      }
    } catch {
      setUserResult({ type: 'error', message: 'Erro de conexão' });
    } finally {
      setAvatarUploadingId(null);
    }
  };

  const handleSavePipeline = async () => {
    setSavingPipeline(true);
    setPipelineResult(null);
    try {
      const res = await fetch('/api/pipeline-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columns: pipelineColumns }),
      });
      if (res.ok) {
        setPipelineResult({ type: 'success', message: 'Configurações do pipeline salvas com sucesso!' });
      } else {
        const data = await res.json();
        setPipelineResult({ type: 'error', message: data.error || 'Erro ao salvar' });
      }
    } catch {
      setPipelineResult({ type: 'error', message: 'Erro de conexão' });
    } finally {
      setSavingPipeline(false);
    }
  };

  const handleSeed = async () => {
    if (!confirm('Inserir 10 contatos fictícios no banco?')) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setResult(`${data.created?.length || 0} contatos criados com sucesso.`);
      } else {
        setResult(`Erro: ${data.error}`);
      }
    } catch {
      setResult('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('ATENÇÃO: Isso vai deletar TODOS os contatos. Tem certeza?')) return;
    if (!confirm('Última chance — deletar todos os contatos?')) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/contacts?limit=1000');
      const data = await res.json();
      const contacts = data.contacts || [];

      let deleted = 0;
      for (const contact of contacts) {
        const delRes = await fetch(`/api/contacts/${contact.id}`, { method: 'DELETE' });
        if (delRes.ok) deleted++;
      }
      setResult(`${deleted} contatos deletados.`);
    } catch {
      setResult('Erro ao deletar contatos');
    } finally {
      setLoading(false);
    }
  };

  if (checkingRole) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-6 h-6 border-2 border-purple-800/30 border-t-emerald-500 rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-emerald-400 mb-2">Administração</h1>
      <p className="text-sm text-purple-300/60 mb-8">Ferramentas de gerenciamento do sistema.</p>

      {/* Pipeline Settings Section */}
      <div className="mb-10">
        <h2 className="text-lg font-bold text-emerald-400 mb-4">Configurar Pipeline</h2>

        {pipelineResult && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            pipelineResult.type === 'success'
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
              : 'bg-red-500/15 text-red-400 border border-red-500/20'
          }`}>
            {pipelineResult.message}
          </div>
        )}

        <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-5">
          <p className="text-xs text-purple-300/60 mb-4">
            Personalize os nomes e cores de cada etapa do pipeline.
          </p>

          <div className="space-y-3">
            {STATUSES.map((status) => (
              <div key={status} className="flex items-center gap-3">
                <input
                  type="color"
                  value={pipelineColumns[status]?.color || STATUS_CHART_COLORS[status] || '#a3a3a3'}
                  onChange={(e) => setPipelineColumns((prev) => ({
                    ...prev,
                    [status]: { ...prev[status], color: e.target.value },
                  }))}
                  className="w-10 h-10 rounded border border-purple-700/30 cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={pipelineColumns[status]?.label || STATUS_LABELS[status] || status}
                  onChange={(e) => setPipelineColumns((prev) => ({
                    ...prev,
                    [status]: { ...prev[status], label: e.target.value },
                  }))}
                  className="flex-1 px-3 py-2 text-sm bg-[#2a1245] border border-purple-700/30 text-neutral-100 placeholder:text-purple-300/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder={STATUS_LABELS[status]}
                />
                <div
                  className="h-8 w-20 rounded-lg flex items-center justify-center text-[10px] font-medium text-white"
                  style={{ backgroundColor: pipelineColumns[status]?.color || STATUS_CHART_COLORS[status] || '#a3a3a3' }}
                >
                  Preview
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-purple-800/20">
            <button
              onClick={handleSavePipeline}
              disabled={savingPipeline}
              className="px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 disabled:opacity-40 transition-colors"
            >
              {savingPipeline ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </div>
      </div>

      {/* User Management Section */}
      <div className="mb-10">
        <h2 className="text-lg font-bold text-emerald-400 mb-4">Gerenciar Usuários</h2>

        {userResult && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            userResult.type === 'success'
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
              : 'bg-red-500/15 text-red-400 border border-red-500/20'
          }`}>
            {userResult.message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Create User Form */}
          <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-5">
            <h3 className="text-sm font-medium text-neutral-100 mb-1">Criar Novo Usuário</h3>
            <p className="text-xs text-purple-300/60 mb-4">
              O usuário será criado na mesma organização que a sua.
            </p>

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-purple-300/80 mb-1">Nome</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm bg-[#2a1245] border border-purple-700/30 text-neutral-100 placeholder:text-purple-300/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Nome completo"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-purple-300/80 mb-1">Email</label>
                <input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm bg-[#2a1245] border border-purple-700/30 text-neutral-100 placeholder:text-purple-300/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="email@exemplo.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-purple-300/80 mb-1">Senha</label>
                <input
                  type="password"
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 text-sm bg-[#2a1245] border border-purple-700/30 text-neutral-100 placeholder:text-purple-300/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <button
                type="submit"
                disabled={creatingUser}
                className="w-full px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 disabled:opacity-40 transition-colors"
              >
                {creatingUser ? 'Criando...' : 'Criar Usuário'}
              </button>
            </form>
          </div>

          {/* Users List */}
          <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-5">
            <h3 className="text-sm font-medium text-neutral-100 mb-1">Usuários da Organização</h3>
            <p className="text-xs text-purple-300/60 mb-4">
              Todos os usuários com acesso ao sistema.
            </p>

            {loadingUsers ? (
              <p className="text-sm text-purple-300/40">Carregando...</p>
            ) : users.length === 0 ? (
              <p className="text-sm text-purple-300/40">Nenhum usuário encontrado.</p>
            ) : (
              <div className="space-y-2">
                {users.map((u) => (
                  <div key={u.user_id} className="p-3 bg-[#2a1245] rounded-lg">
                    {editingId === u.user_id ? (
                      /* Editing mode */
                      <div className="space-y-2">
                        <div>
                          <label className="block text-xs font-medium text-purple-300/80 mb-1">Nome</label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-2 py-1.5 text-sm bg-[#2a1245] border border-purple-700/30 text-neutral-100 placeholder:text-purple-300/40 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-purple-300/80 mb-1">Email</label>
                          <input
                            type="email"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            className="w-full px-2 py-1.5 text-sm bg-[#2a1245] border border-purple-700/30 text-neutral-100 placeholder:text-purple-300/40 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-purple-300/80 mb-1">Nova Senha (opcional)</label>
                          <input
                            type="password"
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            placeholder="Deixe vazio para manter"
                            className="w-full px-2 py-1.5 text-sm bg-[#2a1245] border border-purple-700/30 text-neutral-100 placeholder:text-purple-300/40 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                          />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={handleSaveEdit}
                            disabled={savingEdit}
                            className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded hover:bg-emerald-500 disabled:opacity-40 transition-colors"
                          >
                            {savingEdit ? 'Salvando...' : 'Salvar'}
                          </button>
                          <button
                            onClick={cancelEditing}
                            disabled={savingEdit}
                            className="px-3 py-1.5 bg-purple-800/30 text-purple-200 text-xs font-medium rounded hover:bg-purple-800/50 disabled:opacity-40 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Display mode */
                      <div className="flex items-center gap-3">
                        <label className="relative cursor-pointer shrink-0 group">
                          <div className="avatar-orbit-sm">
                            {(u as any).avatar_url ? (
                              <img src={(u as any).avatar_url} alt={u.name} className="w-14 h-14 object-cover group-hover:brightness-75 transition-all" />
                            ) : (
                              <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-purple-600 flex items-center justify-center text-base font-bold text-white group-hover:brightness-75 transition-all">
                                {u.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </div>
                          {avatarUploadingId === u.user_id && (
                            <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                              <div className="w-5 h-5 border-2 border-purple-800/30 border-t-emerald-500 rounded-full animate-spin" />
                            </div>
                          )}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleAvatarUpload(u.user_id, file);
                              e.target.value = '';
                            }}
                          />
                        </label>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-neutral-100 truncate">{u.name}</p>
                            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
                              u.role === 'admin' ? 'bg-purple-500/15 text-purple-400' : 'bg-purple-800/30 text-purple-300/60'
                            }`}>
                              {u.role === 'admin' ? 'Admin' : 'Vendedor'}
                            </span>
                          </div>
                          <p className="text-xs text-purple-300/60 truncate">{u.email}</p>
                        </div>
                        <div className="flex gap-1 shrink-0 items-center">
                          <select
                            value={u.role || 'user'}
                            onChange={(e) => handleRoleChange(u.user_id, e.target.value)}
                            disabled={roleChangingId === u.user_id}
                            className="text-[10px] bg-[#2a1245] border border-purple-700/30 text-neutral-100 rounded px-1 py-0.5 focus:outline-none disabled:opacity-40"
                          >
                            <option value="admin">Admin</option>
                            <option value="user">Vendedor</option>
                          </select>
                          <button
                            onClick={() => startEditing(u)}
                            className="px-2 py-1 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded transition-colors"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.user_id, u.name)}
                            disabled={deletingId === u.user_id}
                            className="px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors disabled:opacity-40"
                          >
                            {deletingId === u.user_id ? '...' : 'Excluir'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Duplicates Section */}
      <div className="mb-10">
        <h2 className="text-lg font-bold text-emerald-400 mb-4">Duplicados</h2>
        <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-5">
          <h3 className="text-sm font-medium text-neutral-100 mb-1">Gerenciar Contatos Duplicados</h3>
          <p className="text-xs text-purple-300/60 mb-4">
            Detecta e permite remover contatos duplicados por CPF, CNPJ ou telefone.
          </p>
          <Link
            href="/admin/duplicates"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-500 shadow-lg shadow-amber-600/20 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Ver Duplicados
          </Link>
        </div>
      </div>

      {/* Existing Tools Section */}
      <h2 className="text-lg font-bold text-emerald-400 mb-4">Ferramentas</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Seed */}
        <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-5">
          <h3 className="text-sm font-medium text-neutral-100 mb-1">Dados de Teste</h3>
          <p className="text-xs text-purple-300/60 mb-4">
            Insere 10 contatos fictícios com diferentes status para testar o sistema.
          </p>
          <button
            onClick={handleSeed}
            disabled={loading}
            className="w-full px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 disabled:opacity-40 transition-colors"
          >
            {loading ? 'Processando...' : 'Inserir Dados Fictícios'}
          </button>
        </div>

        {/* Clear all */}
        <div className="bg-[#1e0f35] border border-red-500/30 rounded-lg p-5">
          <h3 className="text-sm font-medium text-red-400 mb-1">Limpar Base</h3>
          <p className="text-xs text-purple-300/60 mb-4">
            Remove todos os contatos e interações do sistema. Ação irreversível.
          </p>
          <button
            onClick={handleClearAll}
            disabled={loading}
            className="w-full px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-500 disabled:opacity-40 transition-colors"
          >
            {loading ? 'Processando...' : 'Deletar Todos os Contatos'}
          </button>
        </div>
      </div>

      {result && (
        <div className="mt-6 bg-[#1e0f35] border border-purple-800/30 rounded-lg p-4">
          <p className="text-sm text-purple-200">{result}</p>
        </div>
      )}
    </div>
  );
}
