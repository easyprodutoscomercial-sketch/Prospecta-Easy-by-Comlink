'use client';

interface Forecast {
  total_pipeline: number;
  avg_conversion_rate: number;
  forecast_30d: number;
  forecast_60d: number;
  forecast_90d: number;
  won_value: number;
}

interface RevenueForecastProps {
  forecast: Forecast;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export function RevenueForecast({ forecast }: RevenueForecastProps) {
  const cards = [
    { label: 'Pipeline Total', value: formatCurrency(forecast.total_pipeline), color: 'text-purple-400' },
    { label: 'Ganhos', value: formatCurrency(forecast.won_value), color: 'text-emerald-400' },
    { label: 'Taxa Conv.', value: `${(forecast.avg_conversion_rate * 100).toFixed(1)}%`, color: 'text-blue-400' },
    { label: 'Forecast 30d', value: formatCurrency(forecast.forecast_30d), color: 'text-amber-400' },
    { label: 'Forecast 60d', value: formatCurrency(forecast.forecast_60d), color: 'text-orange-400' },
    { label: 'Forecast 90d', value: formatCurrency(forecast.forecast_90d), color: 'text-red-400' },
  ];

  return (
    <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-4">
      <h3 className="text-sm font-medium text-neutral-100 mb-3">Previsao de Receita</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((card) => (
          <div key={card.label} className="bg-[#2a1245] rounded-lg p-3 text-center">
            <p className="text-[10px] text-purple-300/50 mb-1">{card.label}</p>
            <p className={`text-lg font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
