'use client';

import { useState, useEffect, useRef } from 'react';

export default function SettingsPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarResult, setAvatarResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [userName, setUserName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await fetch('/api/me');
        if (res.ok) {
          const data = await res.json();
          setAvatarUrl(data.avatar_url || null);
          setUserName(data.name || '');
        }
      } catch { /* silent */ }
    };
    fetchMe();
  }, []);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarLoading(true);
    setAvatarResult(null);

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await fetch('/api/users/avatar', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        setAvatarUrl(data.avatar_url);
        setAvatarResult({ type: 'success', message: 'Foto atualizada com sucesso!' });
      } else {
        setAvatarResult({ type: 'error', message: data.error || 'Erro ao enviar foto.' });
      }
    } catch {
      setAvatarResult({ type: 'error', message: 'Erro de conexão.' });
    } finally {
      setAvatarLoading(false);
    }
  };

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
      <h1 className="text-2xl font-semibold text-emerald-400 mb-2">Configuracoes</h1>
      <p className="text-sm text-purple-300/60 mb-8">Gerencie suas preferencias de conta.</p>

      <div className="max-w-md space-y-6">
        {/* Avatar Section */}
        <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-5">
          <h2 className="text-sm font-medium text-neutral-100 mb-1">Foto de Perfil</h2>
          <p className="text-xs text-purple-300/60 mb-4">
            Sua foto aparecera no pipeline, contatos e sidebar.
          </p>

          <div className="flex items-center gap-4">
            {/* Avatar preview */}
            <div className="relative">
              <div className="avatar-orbit">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={userName}
                    className="w-28 h-28 object-cover"
                  />
                ) : (
                  <div className="w-28 h-28 bg-gradient-to-br from-emerald-500 to-purple-600 flex items-center justify-center text-4xl font-bold text-white">
                    {userName?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                )}
              </div>
              {avatarLoading && (
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-purple-800/30 border-t-emerald-500 rounded-full animate-spin" />
                </div>
              )}
            </div>

            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarLoading}
                className="px-4 py-2 text-sm font-medium text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/10 disabled:opacity-40 transition-colors"
              >
                {avatarLoading ? 'Enviando...' : avatarUrl ? 'Trocar Foto' : 'Enviar Foto'}
              </button>
              <p className="text-[10px] text-purple-300/40 mt-1.5">JPG, PNG, WebP ou GIF. Max 2MB.</p>
            </div>
          </div>

          {avatarResult && (
            <div className={`mt-3 p-3 rounded-lg text-sm ${
              avatarResult.type === 'success'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                : 'bg-red-500/15 text-red-400 border border-red-500/20'
            }`}>
              {avatarResult.message}
            </div>
          )}
        </div>

        {/* Password Section */}
        <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-5">
          <h2 className="text-sm font-medium text-neutral-100 mb-1">Trocar Senha</h2>
          <p className="text-xs text-purple-300/60 mb-4">
            Defina uma nova senha para sua conta.
          </p>

          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-purple-300/80 mb-1">Nova Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 text-sm bg-[#2a1245] border border-purple-700/30 text-neutral-100 placeholder:text-purple-300/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="Minimo 6 caracteres"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-purple-300/80 mb-1">Confirmar Senha</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 text-sm bg-[#2a1245] border border-purple-700/30 text-neutral-100 placeholder:text-purple-300/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="Repita a nova senha"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 disabled:opacity-40 transition-colors"
            >
              {saving ? 'Salvando...' : 'Alterar Senha'}
            </button>
          </form>

          {result && (
            <div className={`mt-3 p-3 rounded-lg text-sm ${
              result.type === 'success'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                : 'bg-red-500/15 text-red-400 border border-red-500/20'
            }`}>
              {result.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
