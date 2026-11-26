import React from 'react';
import { CityMarketMoodId, CityMarketSentimentReport } from '../economy/economyEngine';

interface CityMarketMoodGaugeProps {
  report: CityMarketSentimentReport;
}

const MOOD_COLORS: Record<
  CityMarketMoodId,
  { accent: string; textClass: string; borderClass: string }
> = {
  panic: {
    accent: '#38bdf8',
    textClass: 'text-sky-300',
    borderClass: 'border-sky-500/40',
  },
  caution: {
    accent: '#60a5fa',
    textClass: 'text-blue-300',
    borderClass: 'border-blue-500/40',
  },
  balanced: {
    accent: '#10b981',
    textClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/40',
  },
  optimism: {
    accent: '#f59e0b',
    textClass: 'text-amber-400',
    borderClass: 'border-amber-500/45',
  },
  overheated: {
    accent: '#f43f5e',
    textClass: 'text-rose-400',
    borderClass: 'border-rose-500/45',
  },
};

function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startDeg: number,
  endDeg: number,
): string {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const x1 = cx + radius * Math.cos(toRad(startDeg));
  const y1 = cy + radius * Math.sin(toRad(startDeg));
  const x2 = cx + radius * Math.cos(toRad(endDeg));
  const y2 = cy + radius * Math.sin(toRad(endDeg));
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

export const CityMarketMoodGauge: React.FC<CityMarketMoodGaugeProps> = ({ report }) => {
  const palette = MOOD_COLORS[report.moodId];

  // Semi-circle goes from 180deg (left, score=0) to 360deg (right, score=100)
  const clampedScore = Math.max(0, Math.min(100, report.score));
  const needleAngleDeg = -90 + (clampedScore / 100) * 180;

  const cx = 110;
  const cy = 92;
  const r = 74;

  const segments: Array<{ from: number; to: number; color: string; id: CityMarketMoodId }> = [
    { from: 180, to: 214, color: '#38bdf8', id: 'panic' },
    { from: 217, to: 251, color: '#60a5fa', id: 'caution' },
    { from: 254, to: 288, color: '#10b981', id: 'balanced' },
    { from: 291, to: 325, color: '#f59e0b', id: 'optimism' },
    { from: 328, to: 360, color: '#f43f5e', id: 'overheated' },
  ];

  const meters = [
    {
      label: 'Presja Inflacyjna',
      value: report.inflationPressure,
      barClass:
        report.inflationPressure >= 72
          ? 'bg-rose-500'
          : report.inflationPressure >= 50
            ? 'bg-amber-400'
            : 'bg-emerald-500',
    },
    {
      label: 'Popyt Miasta',
      value: report.cityDemandIndex,
      barClass:
        report.cityDemandIndex >= 65
          ? 'bg-amber-400'
          : report.cityDemandIndex >= 40
            ? 'bg-emerald-500'
            : 'bg-sky-400',
    },
    {
      label: 'Zdrowie Nadwyżek',
      value: report.surplusHealth,
      barClass:
        report.surplusHealth >= 55
          ? 'bg-emerald-500'
          : report.surplusHealth >= 35
            ? 'bg-amber-400'
            : 'bg-rose-500',
    },
  ];

  return (
    <section
      aria-label={`Nastrojowy wskaźnik rynkowy dla miasta ${report.cityName}`}
      className={`bg-[#0c1118] border ${palette.borderClass} rounded-lg px-3.5 py-2.5 text-slate-100`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
        {/* Left: Graphical 180-degree Market Mood Gauge SVG */}
        <div className="lg:col-span-4 flex items-center gap-3">
          <div className="w-[152px] shrink-0">
            <svg
              viewBox="0 0 220 124"
              className="w-full h-auto overflow-visible"
              role="img"
              aria-label={`Wskaźnik nastroju rynku: ${report.moodLabel}, wynik ${report.score} na 100`}
            >
              {/* Subtle outer rail */}
              <path
                d={describeArc(cx, cy, r, 180, 360)}
                fill="none"
                stroke="#1e293b"
                strokeWidth="15"
                strokeLinecap="butt"
              />

              {/* 5 Color-Coded Sentiment Zones */}
              {segments.map((seg) => (
                <path
                  key={seg.id}
                  d={describeArc(cx, cy, r, seg.from, seg.to)}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={seg.id === report.moodId ? 14 : 9}
                  strokeOpacity={seg.id === report.moodId ? 1 : 0.42}
                  strokeLinecap="butt"
                />
              ))}

              {/* Scale ticks 0 / 50 / 100 */}
              <text
                x="22"
                y="108"
                fill="#94a3b8"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
              >
                0
              </text>
              <text
                x="104"
                y="12"
                fill="#94a3b8"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
              >
                50
              </text>
              <text
                x="184"
                y="108"
                fill="#94a3b8"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
              >
                100
              </text>

              {/* Animated Gauge Needle */}
              <g
                style={{
                  transform: `rotate(${needleAngleDeg}deg)`,
                  transformOrigin: `${cx}px ${cy}px`,
                  transition: 'transform 450ms cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                <polygon
                  points={`${cx - 3},${cy} ${cx + 3},${cy} ${cx},${cy - 60}`}
                  fill={palette.accent}
                />
                <circle cx={cx} cy={cy} r="6" fill="#0c1118" stroke={palette.accent} strokeWidth="2.5" />
              </g>

              {/* Central Score Readout cleanly below the pivot hub */}
              <text
                x={cx}
                y="119"
                textAnchor="middle"
                fill="#f8fafc"
                fontSize="20"
                fontWeight="700"
                fontFamily="JetBrains Mono, monospace"
              >
                {report.score}
              </text>
            </svg>
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              Nastrój Rynku · {report.cityName}
            </div>
            <div className={`text-sm font-bold leading-tight ${palette.textClass}`}>
              {report.moodLabel}
            </div>
            <p className="text-[11px] text-slate-300 leading-snug">{report.moodSubtitle}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 pt-0.5 text-[11px] font-mono-tabular">
              <span className="text-slate-400">
                Premia cen:{' '}
                <strong
                  className={
                    report.localPricePremiumPct >= 0 ? 'text-amber-300' : 'text-emerald-400'
                  }
                >
                  {report.localPricePremiumPct >= 0 ? '+' : ''}
                  {report.localPricePremiumPct.toFixed(1)}%
                </strong>
              </span>
              <span className="text-slate-400">
                Trend 24h:{' '}
                <strong
                  className={report.avgMomentum24hPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}
                >
                  {report.avgMomentum24hPct >= 0 ? '+' : ''}
                  {report.avgMomentum24hPct.toFixed(1)}%
                </strong>
              </span>
            </div>
          </div>
        </div>

        {/* Middle: Anti-Inflation Model Telemetry (Królewska Mennica) */}
        <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l lg:border-r border-slate-800 pt-2 lg:pt-0 lg:px-3 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-amber-400">Model Antyinflacyjny Mennicy</span>
            <span className="font-mono-tabular text-slate-400">
              Spalanie złota: <strong className="text-emerald-400">{report.burnCoveragePct}%</strong>
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1.5 font-mono-tabular text-center">
            <div className="bg-[#080b10] border border-slate-800 rounded px-1.5 py-1.5">
              <div className="text-[10px] text-slate-400">CPI</div>
              <div className="text-xs font-bold text-white">{report.cpiIndex.toFixed(1)}</div>
              <div
                className={`text-[10px] ${
                  report.inflationRatePct > 5
                    ? 'text-rose-400'
                    : report.inflationRatePct < -2
                      ? 'text-sky-400'
                      : 'text-emerald-400'
                }`}
              >
                {report.inflationRatePct >= 0 ? '+' : ''}
                {report.inflationRatePct.toFixed(1)}%
              </div>
            </div>

            <div className="bg-[#080b10] border border-slate-800 rounded px-1.5 py-1.5">
              <div className="text-[10px] text-slate-400">M / M*</div>
              <div className="text-xs font-bold text-amber-300">
                {report.moneySupplyRatio.toFixed(2)}x
              </div>
              <div className="text-[10px] text-slate-400">Podaż</div>
            </div>

            <div className="bg-[#080b10] border border-slate-800 rounded px-1.5 py-1.5">
              <div className="text-[10px] text-slate-400">Tobin</div>
              <div className="text-xs font-bold text-rose-300">
                {report.dynamicTaxRatePct.toFixed(2)}%
              </div>
              <div className="text-[10px] text-slate-400">Podatek</div>
            </div>

            <div className="bg-[#080b10] border border-slate-800 rounded px-1.5 py-1.5">
              <div className="text-[10px] text-slate-400">Obligacje</div>
              <div className="text-xs font-bold text-emerald-400">
                {report.royalMintBondYieldPct.toFixed(1)}%
              </div>
              <div className="text-[10px] text-slate-400">Rentown.</div>
            </div>
          </div>
        </div>

        {/* Right: 3 Diagnostic Bars + Actionable Trading Signal */}
        <div className="lg:col-span-4 space-y-1.5">
          <div className="space-y-1">
            {meters.map((m) => (
              <div key={m.label} className="space-y-0.5">
                <div className="flex items-center justify-between text-[10px] font-mono-tabular">
                  <span className="text-slate-300">{m.label}</span>
                  <span className="text-white font-semibold">{m.value}/100</span>
                </div>
                <div className="w-full bg-slate-800/90 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`${m.barClass} h-full transition-transform duration-300 origin-left`}
                    style={{ transform: `scaleX(${Math.max(0.03, m.value / 100)})` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-slate-300 bg-[#080b10] border border-slate-800 rounded px-2.5 py-1.5 leading-snug">
            <strong className="text-amber-400">Wskazówka:</strong> {report.actionHint}
          </p>
        </div>
      </div>
    </section>
  );
};
