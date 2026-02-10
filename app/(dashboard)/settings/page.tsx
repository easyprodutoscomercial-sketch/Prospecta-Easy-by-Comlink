'use client';

import { useState } from 'react';

export default function SettingsPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    if (password !== confirmPassword) {
      setResult({ type: 'error', message: 'As senhas não coincidem.' });
      return;
    }

    if (password.length < 6) {
      setResult({ type: 'error', message: 'Senha deve ter no mínimo 6 caracteres.' });
      return;
    }

    setSaving(true);

    try {
      const res = await fetch('/api/users/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();

      if (res.ok) {
        setResult({ type: 'success', message: 'Senha alterada com sucesso.' });
        setPassword('');
        setConfirmPassword('');
      } else {
        setResult({ type: 'error', message: data.error || 'Erro ao alterar senha.' });
      }
    } catch {
      setResult({ type: 'error', message: 'Erro de conexão.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-neutral-900 mb-2">Configurações</h1>
      <p className="text-sm text-neutral-500 mb-8">Gerencie suas preferências de conta.</p>

      <div className="max-w-md">
        <div className="border border-neutral-200 rounded-lg p-5">
          <h2 className="text-sm font-medium text-neutral-900 mb-1">Trocar Senha</h2>
          <p className="text-xs text-neutral-500 mb-4">
            Defina uma nova senha para sua conta.
          </p>

          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Nova Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Confirmar Senha</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                placeholder="Repita a nova senha"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full px-4 py-2.5 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 disabled:opacity-40 transition-colors"
            >
              {saving ? 'Salvando...' : 'Alterar Senha'}
            </button>
          </form>

          {result && (
            <div className={`mt-3 p-3 rounded-lg text-sm ${
              result.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {result.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
