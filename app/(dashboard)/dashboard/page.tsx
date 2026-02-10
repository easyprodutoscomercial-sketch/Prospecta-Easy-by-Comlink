import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single();

  if (!profile) return null;

  const { count: totalContacts } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', profile.organization_id);

  const { count: emProspeccao } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', profile.organization_id)
    .eq('status', 'EM_PROSPECCAO');

  const { count: reunioesMarcadas } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', profile.organization_id)
    .eq('status', 'REUNIAO_MARCADA');

  const { count: convertidos } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', profile.organization_id)
    .eq('status', 'CONVERTIDO');

  const { data: recentContacts } = await supabase
    .from('contacts')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })
    .limit(5);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-neutral-900 mb-8">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="border border-neutral-200 p-5 rounded-lg">
          <p className="text-xs text-neutral-500 uppercase tracking-wide">Total de Contatos</p>
          <p className="text-2xl font-semibold text-neutral-900 mt-1">{totalContacts || 0}</p>
        </div>
        <div className="border border-neutral-200 p-5 rounded-lg">
          <p className="text-xs text-neutral-500 uppercase tracking-wide">Em Prospecção</p>
          <p className="text-2xl font-semibold text-neutral-900 mt-1">{emProspeccao || 0}</p>
        </div>
        <div className="border border-neutral-200 p-5 rounded-lg">
          <p className="text-xs text-neutral-500 uppercase tracking-wide">Reuniões Marcadas</p>
          <p className="text-2xl font-semibold text-neutral-900 mt-1">{reunioesMarcadas || 0}</p>
        </div>
        <div className="border border-neutral-200 p-5 rounded-lg">
          <p className="text-xs text-neutral-500 uppercase tracking-wide">Convertidos</p>
          <p className="text-2xl font-semibold text-neutral-900 mt-1">{convertidos || 0}</p>
        </div>
      </div>

      <div className="border border-neutral-200 rounded-lg">
        <div className="px-5 py-4 flex justify-between items-center">
          <h2 className="text-sm font-medium text-neutral-900">Contatos Recentes</h2>
          <Link href="/contacts" className="text-xs text-neutral-500 hover:text-neutral-900">
            Ver todos
          </Link>
        </div>
        <div className="divide-y divide-neutral-100">
          {recentContacts && recentContacts.length > 0 ? (
            recentContacts.map((contact) => (
              <Link
                key={contact.id}
                href={`/contacts/${contact.id}`}
                className="px-5 py-3 hover:bg-neutral-50 flex justify-between items-center block transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-neutral-900">{contact.name}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {contact.email || contact.phone || contact.company || '-'}
                  </p>
                </div>
                <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${getStatusColor(contact.status)}`}>
                  {formatStatus(contact.status)}
                </span>
              </Link>
            ))
          ) : (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-neutral-500">Nenhum contato cadastrado ainda.</p>
              <Link href="/contacts/new" className="text-sm text-neutral-900 hover:underline font-medium mt-1 inline-block">
                Criar primeiro contato
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatStatus(status: string) {
  const labels: Record<string, string> = {
    NOVO: 'Novo',
    EM_PROSPECCAO: 'Em Prospecção',
    CONTATADO: 'Contatado',
    REUNIAO_MARCADA: 'Reunião Marcada',
    CONVERTIDO: 'Convertido',
    PERDIDO: 'Perdido',
  };
  return labels[status] || status.replace(/_/g, ' ');
}

function getStatusColor(status: string) {
  const colors: Record<string, string> = {
    NOVO: 'bg-neutral-100 text-neutral-700',
    EM_PROSPECCAO: 'bg-amber-100 text-amber-700',
    CONTATADO: 'bg-blue-100 text-blue-700',
    REUNIAO_MARCADA: 'bg-green-100 text-green-700',
    CONVERTIDO: 'bg-emerald-100 text-emerald-700',
    PERDIDO: 'bg-red-100 text-red-700',
  };
  return colors[status] || 'bg-neutral-100 text-neutral-700';
}
