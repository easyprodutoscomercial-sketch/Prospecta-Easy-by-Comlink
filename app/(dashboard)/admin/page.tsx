'use client';

import { useState, useEffect } from 'react';
import { Profile } from '@/lib/types';

export default function AdminPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  // User management state
  const [users, setUsers] = useState<Profile[]>([]);
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

  useEffect(() => {
    fetchUsers();
  }, []);

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

  return (
    <div>
      <h1 className="text-2xl font-semibold text-neutral-900 mb-2">Administração</h1>
      <p className="text-sm text-neutral-500 mb-8">Ferramentas de gerenciamento do sistema.</p>

      {/* User Management Section */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Gerenciar Usuários</h2>

        {userResult && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            userResult.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {userResult.message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Create User Form */}
          <div className="border border-neutral-200 rounded-lg p-5">
            <h3 className="text-sm font-medium text-neutral-900 mb-1">Criar Novo Usuário</h3>
            <p className="text-xs text-neutral-500 mb-4">
              O usuário será criado na mesma organização que a sua.
            </p>

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Nome</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  placeholder="Nome completo"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Email</label>
                <input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  placeholder="email@exemplo.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Senha</label>
                <input
                  type="password"
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <button
                type="submit"
                disabled={creatingUser}
                className="w-full px-4 py-2.5 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 disabled:opacity-40 transition-colors"
              >
                {creatingUser ? 'Criando...' : 'Criar Usuário'}
              </button>
            </form>
          </div>

          {/* Users List */}
          <div className="border border-neutral-200 rounded-lg p-5">
            <h3 className="text-sm font-medium text-neutral-900 mb-1">Usuários da Organização</h3>
            <p className="text-xs text-neutral-500 mb-4">
              Todos os usuários com acesso ao sistema.
            </p>

            {loadingUsers ? (
              <p className="text-sm text-neutral-400">Carregando...</p>
            ) : users.length === 0 ? (
              <p className="text-sm text-neutral-400">Nenhum usuário encontrado.</p>
            ) : (
              <div className="space-y-2">
                {users.map((u) => (
                  <div key={u.user_id} className="p-3 bg-neutral-50 rounded-lg">
                    {editingId === u.user_id ? (
                      /* Editing mode */
                      <div className="space-y-2">
                        <div>
                          <label className="block text-xs font-medium text-neutral-700 mb-1">Nome</label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-neutral-700 mb-1">Email</label>
                          <input
                            type="email"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-neutral-700 mb-1">Nova Senha (opcional)</label>
                          <input
                            type="password"
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            placeholder="Deixe vazio para manter"
                            className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                          />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={handleSaveEdit}
                            disabled={savingEdit}
                            className="px-3 py-1.5 bg-neutral-900 text-white text-xs font-medium rounded hover:bg-neutral-800 disabled:opacity-40 transition-colors"
                          >
                            {savingEdit ? 'Salvando...' : 'Salvar'}
                          </button>
                          <button
                            onClick={cancelEditing}
                            disabled={savingEdit}
                            className="px-3 py-1.5 bg-neutral-200 text-neutral-700 text-xs font-medium rounded hover:bg-neutral-300 disabled:opacity-40 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Display mode */
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-neutral-200 rounded-full flex items-center justify-center text-xs font-medium text-neutral-600 shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-neutral-900 truncate">{u.name}</p>
                          <p className="text-xs text-neutral-500 truncate">{u.email}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => startEditing(u)}
                            className="px-2 py-1 text-xs text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200 rounded transition-colors"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.user_id, u.name)}
                            disabled={deletingId === u.user_id}
                            className="px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors disabled:opacity-40"
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

      {/* Existing Tools Section */}
      <h2 className="text-lg font-semibold text-neutral-900 mb-4">Ferramentas</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Seed */}
        <div className="border border-neutral-200 rounded-lg p-5">
          <h3 className="text-sm font-medium text-neutral-900 mb-1">Dados de Teste</h3>
          <p className="text-xs text-neutral-500 mb-4">
            Insere 10 contatos fictícios com diferentes status para testar o sistema.
          </p>
          <button
            onClick={handleSeed}
            disabled={loading}
            className="w-full px-4 py-2.5 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 disabled:opacity-40 transition-colors"
          >
            {loading ? 'Processando...' : 'Inserir Dados Fictícios'}
          </button>
        </div>

        {/* Clear all */}
        <div className="border border-red-200 rounded-lg p-5">
          <h3 className="text-sm font-medium text-red-900 mb-1">Limpar Base</h3>
          <p className="text-xs text-neutral-500 mb-4">
            Remove todos os contatos e interações do sistema. Ação irreversível.
          </p>
          <button
            onClick={handleClearAll}
            disabled={loading}
            className="w-full px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-40 transition-colors"
          >
            {loading ? 'Processando...' : 'Deletar Todos os Contatos'}
          </button>
        </div>
      </div>

      {result && (
        <div className="mt-6 border border-neutral-200 rounded-lg p-4">
          <p className="text-sm text-neutral-700">{result}</p>
        </div>
      )}
    </div>
  );
}
