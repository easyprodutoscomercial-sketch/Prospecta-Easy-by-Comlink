import ModuloIndisponivel from '@/components/ui/modulo-indisponivel';
import { moduloPublicoLigado } from '@/lib/modulos/servidor';

// Modulo desligado em Admin -> Modulos do sistema: o link publico mostra "indisponivel".
export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!(await moduloPublicoLigado('quiz', 'quiz_configuracoes', 'token_publico', token))) return <ModuloIndisponivel />;
  return children;
}
