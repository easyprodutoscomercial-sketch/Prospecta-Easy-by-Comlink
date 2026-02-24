'use client';

import { ToastProvider } from '@/lib/toast-context';
import { PipelineProvider } from '@/lib/pipeline-context';
import { OnboardingProvider } from '@/lib/onboarding-context';
import type { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <PipelineProvider>
        <OnboardingProvider>{children}</OnboardingProvider>
      </PipelineProvider>
    </ToastProvider>
  );
}
