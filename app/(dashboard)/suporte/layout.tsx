'use client';

import { SupportPipelineProvider } from '@/lib/support-pipeline-context';

export default function SuporteLayout({ children }: { children: React.ReactNode }) {
  return <SupportPipelineProvider>{children}</SupportPipelineProvider>;
}
