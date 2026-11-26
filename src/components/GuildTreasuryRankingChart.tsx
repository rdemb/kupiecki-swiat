import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { GuildInfo } from '../economy/gameData';
import {
  computeGuildRankings,
  formatGuildGoldAxis,
  formatGuildGoldFull,
  type GuildRankingMetric,
  type RankedGuildDatum,
} from '../economy/guildRankings';

interface GuildTreasuryRankingChartProps {
  guilds: GuildInfo[];
  playerGuildId: string;
}

export const GuildTreasuryRankingChart: React.FC<GuildTreasuryRankingChartProps> = ({
  guilds,
  playerGuildId,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const prevTreasuryRef = useRef<Record<string, number>>({});
  const deltaTimerRef = useRef<number | null>(null);

  const [containerWidth, setContainerWidth] = useState<number>(760);
  const [metric, setMetric] = useState<GuildRankingMetric>('treasury');
  const [hoveredGuildId, setHoveredGuildId] = useState<string | null>(null);
  const [recentDeltas, setRecentDeltas] = useState<Record<string, number>>({});

  const summary = useMemo(
    () => computeGuildRankings(guilds, playerGuildId, metric),
    [guilds, playerGuildId, metric],
  );

  // Track container width responsively via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateWidth = () => {
      const next = Math.max(320, Math.floor(el.getBoundingClientRect().width));
      setContainerWidth(next);
    };
    updateWidth();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Detect live treasury contributions for subtle delta feedback
  useEffect(() => {
    const prev = prevTreasuryRef.current;
    const nextDeltas: Record<string, number> = {};
    let hasIncrease = false;

    for (const g of guilds) {
      const previousVal = prev[g.id];
      if (typeof previousVal === 'number' && g.treasuryGold > previousVal) {
        nextDeltas[g.id] = g.treasuryGold - previousVal;
        hasIncrease = true;
      }
      prev[g.id] = g.treasuryGold;
    }

    if (hasIncrease) {
      setRecentDeltas(nextDeltas);
      if (deltaTimerRef.current !== null) {
        window.clearTimeout(deltaTimerRef.current);
      }
      deltaTimerRef.current = window.setTimeout(() => {
        setRecentDeltas({});
        deltaTimerRef.current = null;
      }, 2200);
    }
  }, [guilds]);

  useEffect(() => {
    return () => {
      if (deltaTimerRef.current !== null) {
        window.clearTimeout(deltaTimerRef.current);
      }
    };
  }, []);

  const rowHeight = 32;
  const margin = useMemo(() => {
    const isNarrow = containerWidth < 560;
    return {
      top: 20,
      right: isNarrow ? 114 : 168,
      bottom: 6,
      left: isNarrow ? 132 : 218,
    };
  }, [containerWidth]);

  const chartHeight = Math.max(
    102,
    margin.top + Math.max(1, summary.ranked.length) * rowHeight + margin.bottom,
  );

  // Render & animate D3 horizontal bar chart
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = prefersReducedMotion ? 0 : 450;

    const width = Math.max(320, containerWidth);
    const innerWidth = Math.max(80, width - margin.left - margin.right);
    const innerHeight = Math.max(40, chartHeight - margin.top - margin.bottom);

    const svg = d3.select(svgEl);
    svg.attr('viewBox', `0 0 ${width} ${chartHeight}`);

    // Ensure static structural layers exist once
    let defs = svg.select<SVGDefsElement>('defs.guild-chart-defs');
    if (defs.empty()) {
      defs = svg.append('defs').attr('class', 'guild-chart-defs');

      const addGradient = (id: string, c0: string, c1: string) => {
        const grad = defs
          .append('linearGradient')
          .attr('id', id)
          .attr('x1', '0%')
          .attr('y1', '0%')
          .attr('x2', '100%')
          .attr('y2', '0%');
        grad.append('stop').attr('offset', '0%').attr('stop-color', c0);
        grad.append('stop').attr('offset', '100%').attr('stop-color', c1);
      };

      addGradient('guild-bar-player', '#b45309', '#f59e0b');
      addGradient('guild-bar-leader', '#047857', '#10b981');
      addGradient('guild-bar-rival', '#1d4ed8', '#60a5fa');
    }

    let plot = svg.select<SVGGElement>('g.guild-plot');
    if (plot.empty()) {
      plot = svg.append('g').attr('class', 'guild-plot');
      plot.append('g').attr('class', 'guild-grid');
      plot.append('g').attr('class', 'guild-axis-top');
      plot.append('g').attr('class', 'guild-rows');
    }
    plot.attr('transform', `translate(${margin.left},${margin.top})`);

    const maxDomain = Math.max(1000, summary.maxMetricValue * 1.1);
    const xScale = d3.scaleLinear().domain([0, maxDomain]).range([0, innerWidth]).nice();
    const yScale = d3
      .scaleBand<string>()
      .domain(summary.ranked.map((d) => d.id))
      .range([0, innerHeight])
      .paddingInner(0.32)
      .paddingOuter(0.14);

    const barHeight = Math.max(14, yScale.bandwidth());
    const tickCount = innerWidth < 280 ? 3 : 5;

    // Gridlines
    const gridAxis = d3
      .axisTop(xScale)
      .ticks(tickCount)
      .tickSize(-innerHeight)
      .tickFormat(() => '');

    const gridGroup = plot.select<SVGGElement>('g.guild-grid');
    gridGroup.transition().duration(duration).ease(d3.easeCubicOut).call(gridAxis);
    gridGroup.select('.domain').remove();
    gridGroup
      .selectAll('line')
      .attr('stroke', '#1e293b')
      .attr('stroke-dasharray', '2,3')
      .attr('stroke-opacity', 0.85);

    // Top Axis
    const topAxis = d3
      .axisTop(xScale)
      .ticks(tickCount)
      .tickSizeOuter(0)
      .tickPadding(6)
      .tickFormat((v) => formatGuildGoldAxis(Number(v)));

    const axisGroup = plot.select<SVGGElement>('g.guild-axis-top');
    axisGroup.transition().duration(duration).ease(d3.easeCubicOut).call(topAxis);
    axisGroup.select('.domain').attr('stroke', '#1e293b');
    axisGroup.selectAll('line').attr('stroke', '#334155');
    axisGroup
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px')
      .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace');

    const getBarFill = (d: RankedGuildDatum) => {
      if (d.isPlayerGuild) return 'url(#guild-bar-player)';
      if (d.rank === 1) return 'url(#guild-bar-leader)';
      return 'url(#guild-bar-rival)';
    };

    const getBarStroke = (d: RankedGuildDatum) => {
      if (d.isPlayerGuild) return '#fbbf24';
      if (d.rank === 1) return '#34d399';
      return '#60a5fa';
    };

    const truncateName = (name: string) => {
      const maxChars = margin.left < 160 ? 14 : 23;
      return name.length > maxChars ? `${name.slice(0, maxChars - 1)}…` : name;
    };

    // Data-joined guild rows
    const rowsGroup = plot.select<SVGGElement>('g.guild-rows');
    const rowJoin = rowsGroup
      .selectAll<SVGGElement, RankedGuildDatum>('g.guild-row')
      .data(summary.ranked, (d) => d.id)
      .join(
        (enter) => {
          const g = enter
            .append('g')
            .attr('class', 'guild-row')
            .attr('transform', (d) => `translate(0,${yScale(d.id) ?? 0})`)
            .style('cursor', 'pointer');

          // Full-width subtle bar track
          g.append('rect')
            .attr('class', 'guild-bar-track')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', innerWidth)
            .attr('height', barHeight)
            .attr('rx', 4)
            .attr('fill', '#080b10')
            .attr('stroke', '#1e293b')
            .attr('stroke-width', 1);

          // Main animated bar
          g.append('rect')
            .attr('class', 'guild-bar-fill')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', 0)
            .attr('height', barHeight)
            .attr('rx', 4)
            .attr('fill', getBarFill)
            .attr('stroke', getBarStroke)
            .attr('stroke-opacity', 0.45)
            .attr('stroke-width', 1);

          // Crisp rank label (#1, #2, ...)
          g.append('text')
            .attr('class', 'guild-rank-label')
            .attr('x', -margin.left + 4)
            .attr('y', barHeight / 2)
            .attr('dy', '0.35em')
            .attr('font-size', '11px')
            .attr('font-weight', '700')
            .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace');

          // Guild [TAG] + Name label
          g.append('text')
            .attr('class', 'guild-name-label')
            .attr('x', -margin.left + 28)
            .attr('y', barHeight / 2)
            .attr('dy', '0.35em')
            .attr('font-size', '11px');

          // Value + share label in right margin
          g.append('text')
            .attr('class', 'guild-value-label')
            .attr('x', innerWidth + 10)
            .attr('y', barHeight / 2)
            .attr('dy', '0.35em')
            .attr('font-size', '11px')
            .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace');

          // Native SVG tooltip fallback
          g.append('title');

          return g;
        },
        (update) => update,
        (exit) =>
          exit
            .transition()
            .duration(duration)
            .ease(d3.easeCubicOut)
            .style('opacity', 0)
            .remove(),
      );

    // Interactive hover listeners
    rowJoin
      .on('mouseenter', (_event, d) => setHoveredGuildId(d.id))
      .on('mouseleave', () => setHoveredGuildId(null));

    // Smoothly slide rows into their updated rank slot
    rowJoin
      .transition()
      .duration(duration)
      .ease(d3.easeCubicOut)
      .attr('transform', (d) => `translate(0,${yScale(d.id) ?? 0})`)
      .style('opacity', (d) =>
        hoveredGuildId && hoveredGuildId !== d.id ? 0.62 : 1,
      );

    // Update bar tracks
    rowJoin
      .select<SVGRectElement>('rect.guild-bar-track')
      .attr('width', innerWidth)
      .attr('height', barHeight)
      .attr('stroke', (d) =>
        hoveredGuildId === d.id
          ? '#64748b'
          : d.isPlayerGuild
            ? 'rgba(245, 158, 11, 0.35)'
            : '#1e293b',
      );

    // Animate bar widths and sync data attributes for verification
    rowJoin
      .select<SVGRectElement>('rect.guild-bar-fill')
      .attr('data-testid', (d) => `guild-bar-${d.id}`)
      .attr('data-rank', (d) => String(d.rank))
      .attr('data-treasury-gold', (d) => String(d.treasuryGold))
      .attr('data-metric-value', (d) => String(d.metricValue))
      .attr('fill', getBarFill)
      .attr('stroke', getBarStroke)
      .transition()
      .duration(duration)
      .ease(d3.easeCubicOut)
      .attr('height', barHeight)
      .attr('width', (d) => Math.max(4, xScale(d.metricValue)));

    // Rank indicator
    rowJoin
      .select<SVGTextElement>('text.guild-rank-label')
      .attr('x', -margin.left + 4)
      .attr('y', barHeight / 2)
      .attr('fill', (d) =>
        d.isPlayerGuild ? '#fbbf24' : d.rank === 1 ? '#34d399' : '#94a3b8',
      )
      .text((d) => `#${d.rank}`);

    // Guild name + tag
    rowJoin
      .select<SVGTextElement>('text.guild-name-label')
      .attr('x', -margin.left + 28)
      .attr('y', barHeight / 2)
      .attr('fill', (d) => (d.isPlayerGuild ? '#fef3c7' : '#e2e8f0'))
      .attr('font-weight', (d) => (d.isPlayerGuild ? '700' : '500'))
      .text((d) => `[${d.tag}] ${truncateName(d.name)}`);

    // Right value label
    rowJoin
      .select<SVGTextElement>('text.guild-value-label')
      .attr('x', innerWidth + 10)
      .attr('y', barHeight / 2)
      .attr('fill', (d) => {
        if (recentDeltas[d.id]) return '#fde047';
        return d.isPlayerGuild ? '#fbbf24' : '#cbd5e1';
      })
      .attr('font-weight', (d) => (d.isPlayerGuild || recentDeltas[d.id] ? '700' : '500'))
      .text((d) => {
        const delta = recentDeltas[d.id];
        if (metric === 'perMember') {
          return `${formatGuildGoldFull(d.goldPerMember)}/os.`;
        }
        if (delta && delta > 0) {
          return `${formatGuildGoldFull(d.treasuryGold)} (+${delta.toLocaleString('pl-PL')})`;
        }
        const pctStr = d.sharePct.toLocaleString('pl-PL', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        });
        return margin.right < 130
          ? formatGuildGoldFull(d.treasuryGold)
          : `${formatGuildGoldFull(d.treasuryGold)} · ${pctStr}%`;
      });

    // Tooltip text
    rowJoin
      .select<SVGTitleElement>('title')
      .text((d) => {
        const pctStr = d.sharePct.toLocaleString('pl-PL', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        });
        return `#${d.rank} [${d.tag}] ${d.name} — Skarbiec: ${formatGuildGoldFull(d.treasuryGold)} (${pctStr}%), Członkowie: ${d.membersCount}, Rabat: -${d.taxRebatePct}%`;
      });
  }, [summary, containerWidth, chartHeight, margin, hoveredGuildId, metric, recentDeltas]);

  const focusedGuild = useMemo(() => {
    if (hoveredGuildId) {
      return summary.ranked.find((g) => g.id === hoveredGuildId) ?? summary.playerGuild ?? summary.leader;
    }
    return summary.playerGuild ?? summary.leader;
  }, [hoveredGuildId, summary]);

  return (
    <section
      data-testid="guild-d3-ranking-chart"
      aria-label="Wykres słupkowy rankingu skarbców gildii"
      className="bg-[#0c1118] border border-slate-800 rounded-lg p-2.5 space-y-1.5"
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-800">
        <div className="flex items-baseline gap-2.5 min-w-0">
          <h3 className="text-xs font-bold text-amber-400 tracking-wide">
            Ranking Skarbców Gildii
          </h3>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Aktualizacja live po każdej składce do skarbca
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          <div className="flex items-center gap-3 font-mono-tabular text-slate-300">
            <span>
              Łącznie:{' '}
              <strong data-testid="guild-total-treasury" className="text-white">
                {formatGuildGoldFull(summary.totalTreasuryGold)}
              </strong>
            </span>
            {summary.playerGuildRank !== null && (
              <span className="text-amber-400 font-semibold">
                Twoja gildia: #{summary.playerGuildRank}
              </span>
            )}
          </div>

          <div
            role="group"
            aria-label="Metryka wykresu gildii"
            className="inline-flex items-center bg-[#080b10] border border-slate-800 rounded p-0.5"
          >
            <button
              type="button"
              onClick={() => setMetric('treasury')}
              className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
                metric === 'treasury'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Skarbiec
            </button>
            <button
              type="button"
              onClick={() => setMetric('perMember')}
              className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
                metric === 'perMember'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Złoto / członek
            </button>
          </div>
        </div>
      </div>

      {/* Responsive D3 SVG Canvas */}
      <div ref={containerRef} className="w-full overflow-hidden">
        <svg
          ref={svgRef}
          width="100%"
          height={chartHeight}
          role="img"
          aria-label="Poziomy wykres słupkowy porównujący skarbce gildii kupieckich"
          className="block w-full select-none"
        />
      </div>

      {/* Stable Footer Detail Strip */}
      {focusedGuild && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-800/80 text-[11px] text-slate-400">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-slate-200 font-semibold">
              #{focusedGuild.rank} [{focusedGuild.tag}] {focusedGuild.name}
              {focusedGuild.isPlayerGuild ? ' (Twoja gildia)' : ''}
            </span>
            <span>Mistrz: {focusedGuild.leader}</span>
            <span className="font-mono-tabular">
              Poz. {focusedGuild.level} · {focusedGuild.membersCount} kupców
            </span>
            <span className="font-mono-tabular text-emerald-400">
              Rabat -{focusedGuild.taxRebatePct}%
            </span>
          </div>
          <div className="font-mono-tabular text-slate-300">
            {focusedGuild.rank === 1 ? (
              <span className="text-emerald-400 font-semibold">
                Lider rankingu (
                {focusedGuild.sharePct.toLocaleString('pl-PL', {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}
                % udziału)
              </span>
            ) : (
              <span>
                Strata do #1:{' '}
                <strong className="text-amber-300">
                  {formatGuildGoldFull(focusedGuild.gapToLeaderGold)}
                </strong>
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
