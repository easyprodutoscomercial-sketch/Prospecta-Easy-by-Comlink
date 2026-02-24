'use client';

import { useOnboarding } from '@/lib/onboarding-context';
import { TourOverlay } from './tour-overlay';
import { TourTooltip } from './tour-tooltip';
import { usePathname } from 'next/navigation';

interface TourStep {
  selector: string;
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

const TOUR_STEPS: TourStep[] = [
  {
    selector: 'nav',
    title: 'Menu de Navegacao',
    description: 'Use o menu lateral para navegar entre as areas do sistema: Dashboard, Contatos, Pipeline, Calendario e muito mais.',
    position: 'right',
  },
  {
    selector: '[data-tour="pipeline-selector"]',
    title: 'Seletor de Pipeline',
    description: 'Escolha qual pipeline visualizar. Cada pipeline tem suas proprias etapas e contatos. Voce pode criar multiplos pipelines no Admin.',
    position: 'right',
  },
  {
    selector: '[data-tour="kanban-board"]',
    title: 'Quadro Kanban',
    description: 'Arraste os contatos entre as colunas para avancar no pipeline. Cada coluna representa uma etapa do seu processo de vendas.',
    position: 'top',
  },
  {
    selector: '[data-tour="kanban-filters"]',
    title: 'Filtros Visuais',
    description: 'Use os chips coloridos para filtrar por temperatura, responsavel ou origem. Cards que nao casam ficam esmaecidos ou ocultos.',
    position: 'bottom',
  },
  {
    selector: 'button[title="Busca rapida..."], [data-tour="quick-search"]',
    title: 'Busca Rapida (Ctrl+K)',
    description: 'Pressione Ctrl+K a qualquer momento para buscar contatos, pipelines e funcoes rapidamente. Funciona em qualquer tela.',
    position: 'bottom',
  },
  {
    selector: 'a[href="/kanban?chat=1"]',
    title: 'Assistente IA',
    description: 'O assistente IA gera scripts de ligacao, sugere proximas acoes e analisa a saude do seu pipeline automaticamente.',
    position: 'right',
  },
  {
    selector: '[data-tour="notifications"], button[aria-label="Notificacoes"]',
    title: 'Notificacoes',
    description: 'Receba alertas sobre reunioes proximas, contatos parados e solicitacoes de transferencia. Fique sempre atualizado!',
    position: 'bottom',
  },
];

export function ProductTour() {
  const { tourActive, currentStep, totalSteps, nextStep, prevStep, skipTour } = useOnboarding();
  const pathname = usePathname();

  if (!tourActive) return null;

  // Only show tour on kanban or dashboard pages
  if (!pathname?.startsWith('/kanban') && !pathname?.startsWith('/dashboard')) return null;

  const step = TOUR_STEPS[currentStep];
  if (!step) return null;

  // Check if target element exists, fallback to a safe selector
  const targetExists = typeof document !== 'undefined' && document.querySelector(step.selector);
  if (!targetExists) {
    // Auto-skip steps with missing targets
    return null;
  }

  return (
    <>
      <TourOverlay targetSelector={step.selector} active={tourActive} />
      <TourTooltip
        targetSelector={step.selector}
        title={step.title}
        description={step.description}
        step={currentStep}
        totalSteps={totalSteps}
        position={step.position}
        onNext={nextStep}
        onPrev={prevStep}
        onSkip={skipTour}
      />
    </>
  );
}
