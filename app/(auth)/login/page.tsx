'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">
      <div className="max-w-md w-full space-y-8 bg-neutral-900 p-8 rounded-2xl border border-neutral-800">
        <div className="flex flex-col items-center">
          <Image src="/logo.png" alt="Prospecta Easy" width={200} height={56} className="brightness-0 invert mb-2" />
          <p className="text-sm text-neutral-500">
            Sistema de prospecção comercial
          </p>
        </div>

        <form className="mt-8 space-y-5" onSubmit={handleLogin}>
          {error && (
            <div className="bg-red-950/50 border border-red-800 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-neutral-400 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent placeholder-neutral-600"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-neutral-400 mb-1">
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent placeholder-neutral-600"
              placeholder="********"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-white text-black rounded-lg text-sm font-semibold hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-900 focus:ring-white disabled:opacity-50 transition-colors"
          >
            {loading ? 'Aguarde...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
