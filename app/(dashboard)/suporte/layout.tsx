import { SupportPipelineProvider } from '@/lib/support-pipeline-context';
import { exigirModulo } from '@/lib/modulos/servidor';

// Modulo desligado em Admin -> Modulos do sistema: manda pro Dashboard.
export default async function SuporteLayout({ children }: { children: React.ReactNode }) {
  await exigirModulo('suporte');
  return <SupportPipelineProvider>{children}</SupportPipelineProvider>;
}
