'use client';

interface FocusActionBarProps {
  onAction: (action: 'answered' | 'no_answer' | 'meeting' | 'not_interested' | 'skip') => void;
  loading: boolean;
}

const actions = [
  {
    key: 'answered' as const,
    label: 'Atendeu',
    color: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25',
    textColor: 'text-white',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
        />
      </svg>
    ),
  },
  {
    key: 'no_answer' as const,
    label: 'Nao atendeu',
    color: 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/25',
    textColor: 'text-white',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
        />
      </svg>
    ),
  },
  {
    key: 'meeting' as const,
    label: 'Marcar reuniao',
    color: 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/25',
    textColor: 'text-white',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    ),
  },
  {
    key: 'not_interested' as const,
    label: 'Nao interessado',
    color: 'bg-red-600 hover:bg-red-500 shadow-red-600/25',
    textColor: 'text-white',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    ),
  },
  {
    key: 'skip' as const,
    label: 'Proximo',
    color: 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/25',
    textColor: 'text-white',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M14 5l7 7m0 0l-7 7m7-7H3"
        />
      </svg>
    ),
  },
];

export default function FocusActionBar({ onAction, loading }: FocusActionBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#150a28]/95 backdrop-blur-lg border-t border-purple-800/30">
      <div className="max-w-5xl mx-auto px-4 py-3">
        <div className="flex items-center justify-center gap-2 sm:gap-3">
          {actions.map((action) => (
            <button
              key={action.key}
              onClick={() => onAction(action.key)}
              disabled={loading}
              className={`flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm transition-all duration-200 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed ${action.color} ${action.textColor} hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0`}
            >
              {action.icon}
              <span className="hidden sm:inline">{action.label}</span>
              <span className="sm:hidden text-[10px] leading-tight text-center">
                {action.label.split(' ')[0]}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
