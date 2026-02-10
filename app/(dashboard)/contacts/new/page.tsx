'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ContactForm from '@/components/contacts/contact-form';
import { useToast } from '@/lib/toast-context';

export default function NewContactPage() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [duplicate, setDuplicate] = useState<{ id: string; name: string } | null>(null);

  const handleSubmit = async (formData: Record<string, any>) => {
    setLoading(true);
    setError('');
    setDuplicate(null);

    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.status === 409) {
        setDuplicate(data.duplicate);
        setError('Contato já existe no sistema');
      } else if (!res.ok) {
        setError(data.error || 'Erro ao criar contato');
      } else {
        toast.success('Contato criado com sucesso!');
        router.push(`/contacts/${data.id}`);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao criar contato');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="/contacts" className="text-sm text-neutral-500 hover:text-neutral-900">
          &larr; Voltar para contatos
        </Link>
      </div>

      <h1 className="text-2xl font-semibold text-neutral-900 mb-6">Novo Contato</h1>

      <ContactForm
        mode="create"
        onSubmit={handleSubmit}
        onCancel={() => router.push('/contacts')}
        loading={loading}
        error={error}
        duplicate={duplicate}
      />
    </div>
  );
}
