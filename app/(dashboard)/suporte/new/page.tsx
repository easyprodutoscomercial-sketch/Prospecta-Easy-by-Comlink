'use client';

import SuporteForm from '@/components/suporte/suporte-form';

export default function NewSuportePage() {
  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-neutral-100">Novo Chamado</h1>
        <p className="text-sm text-neutral-500 mt-0.5">Registre um novo chamado de suporte ou tarefa</p>
      </div>

      <div className="bg-[#1e0f35] rounded-xl border border-purple-800/20 p-6">
        <SuporteForm />
      </div>
    </div>
  );
}
