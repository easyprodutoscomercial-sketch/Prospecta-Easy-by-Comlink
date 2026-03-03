'use client';

import { ReportsDashboard } from '@/components/reports/reports-dashboard';

export default function ReportsPage() {
  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-neutral-100">Relatorios</h1>
        <p className="text-sm text-neutral-500 mt-0.5">Analytics e metricas do seu pipeline</p>
      </div>
      <ReportsDashboard />
    </div>
  );
}
