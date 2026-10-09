import ModuloIndisponivel from '@/components/ui/modulo-indisponivel';
import { moduloPublicoLigado } from '@/lib/modulos/servidor';

// Modulo desligado em Admin -> Modulos do sistema: o link publico mostra "indisponivel".
export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ contactId: string }> }) {
  const { contactId } = await params;
  if (!(await moduloPublicoLigado('eventos', 'contacts', 'id', contactId))) return <ModuloIndisponivel />;
  return children;
}
