import { exigirModulo } from '@/lib/modulos/servidor';

// Modulo desligado em Admin -> Modulos do sistema: manda pro Dashboard.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await exigirModulo('frentes');
  return children;
}
