import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Buscar profile para pegar organization_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single();

  // Stats
  const { count: totalContacts } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', profile!.organization_id);

  const { count: emProspeccao } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', profile!.organization_id)
    .eq('status', 'EM_PROSPECCAO');

  const { count: reunioesMarcadas } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', profile!.organization_id)
    .eq('status', 'REUNIAO_MARCADA');

  const { count: convertidos } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', profile!.organization_id)
    .eq('status', 'CONVERTIDO');

  // Contatos recentes
  const { data: recentContacts } = await supabase
    .from('contacts')
    .select('*')
    .eq('organization_id', profile!.organization_id)
    .order('created_at', { ascending: false })
    .limit(5);

  return (
    <div className="px-4 sm:px-0">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-600">Total de Contatos</p>
          <p className="text-3xl font-bold text-gray-900">{totalContacts || 0}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-600">Em Prospecção</p>
          <p className="text-3xl font-bold text-blue-600">{emProspeccao || 0}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-600">Reuniões Marcadas</p>
          <p className="text-3xl font-bold text-green-600">{reunioesMarcadas || 0}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-600">Convertidos</p>
          <p className="text-3xl font-bold text-purple-600">{convertidos || 0}</p>
        </div>
      </div>

      {/* Contatos Recentes */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold">Contatos Recentes</h2>
          <Link href="/contacts" className="text-sm text-blue-600 hover:text-blue-700">
            Ver todos
          </Link>
        </div>
        <div className="divide-y divide-gray-200">
          {recentContacts && recentContacts.length > 0 ? (
            recentContacts.map((contact) => (
              <Link
                key={contact.id}
                href={`/contacts/${contact.id}`}
                className="px-6 py-4 hover:bg-gray-50 flex justify-between items-center block"
              >
                <div>
                  <p className="font-medium text-gray-900">{contact.name}</p>
                  <p className="text-sm text-gray-600">
                    {contact.email || contact.phone || contact.company || '—'}
                  </p>
                </div>
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(contact.status)}`}>
                  {contact.status.replace(/_/g, ' ')}
                </span>
              </Link>
            ))
          ) : (
            <div className="px-6 py-8 text-center text-gray-500">
              Nenhum contato cadastrado ainda.
              <Link href="/contacts/new" className="block mt-2 text-blue-600 hover:text-blue-700">
                Criar primeiro contato
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getStatusColor(status: string) {
  const colors: Record<string, string> = {
    NOVO: 'bg-gray-100 text-gray-800',
    EM_PROSPECCAO: 'bg-blue-100 text-blue-800',
    CONTATADO: 'bg-yellow-100 text-yellow-800',
    REUNIAO_MARCADA: 'bg-green-100 text-green-800',
    CONVERTIDO: 'bg-purple-100 text-purple-800',
    PERDIDO: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}
