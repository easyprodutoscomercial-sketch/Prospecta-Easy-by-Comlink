'use client';

import BugForm from '@/components/bugs/bug-form';

export default function NewBugPage() {
  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-neutral-100">Reportar Bug</h1>
        <p className="text-sm text-neutral-500 mt-0.5">Descreva o problema encontrado</p>
      </div>

      <div className="bg-[#1e0f35] rounded-xl border border-purple-800/20 p-6">
        <BugForm />
      </div>
    </div>
  );
}
