'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Modulo } from '@/lib/modulos/regras';

// Admin -> Modulos do sistema: liga/desliga cada modulo pra empresa inteira.
// Desligado some do menu e dos atalhos de todo mundo (inclusive do admin); nada e apagado.
export default function ModulosSistema() {
  const router = useRouter();
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [desligados, setDesligados] = useState<string[]>([]);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/modulos')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setModulos(d.modulos); setDesligados(d.desligados); })
      .catch(() => setErro('Não foi possível carregar os módulos.'));
  }, []);

  const alternar = async (chave: string) => {
    const novo = desligados.includes(chave) ? desligados.filter((c) => c !== chave) : [...desligados, chave];
    setSalvando(chave);
    setErro(null);
    try {
      const res = await fetch('/api/modulos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ desligados: novo }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Erro ao salvar');
      setDesligados(d.desligados);
      router.refresh(); // menu lateral e atalhos leem a lista no servidor
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSalvando(null);
    }
  };

  return (
    <div className="mb-10">
      <h2 className="text-lg font-bold text-emerald-400 mb-4">Módulos do sistema</h2>
      <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-5">
        <p className="text-xs text-purple-300/60 mb-4">
          Módulo desligado some do menu e dos atalhos de todo mundo, inclusive do admin, e o link público dele fica
          indisponível. Nenhum dado é apagado: ligou de novo, volta tudo como estava.
        </p>
        {erro && <p className="text-xs text-red-400 mb-3">{erro}</p>}
        {modulos.length === 0 && !erro && <p className="text-xs text-purple-300/40">Carregando...</p>}
        <div className="divide-y divide-purple-800/20">
          {modulos.map((m) => {
            const ligado = !desligados.includes(m.chave);
            return (
              <div key={m.chave} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-medium text-neutral-100">{m.nome}</h3>
                  <p className="text-xs text-purple-300/50">{m.descricao}</p>
                </div>
                <button
                  onClick={() => alternar(m.chave)}
                  disabled={salvando !== null}
                  role="switch"
                  aria-checked={ligado}
                  aria-label={`${ligado ? 'Desligar' : 'Ligar'} ${m.nome}`}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-[#1e0f35] disabled:opacity-40 ${
                    ligado ? 'bg-emerald-500' : 'bg-purple-800/50'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    ligado ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
