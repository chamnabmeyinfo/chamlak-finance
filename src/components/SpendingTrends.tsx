import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { Transaction } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { CurrencyCode, formatAmount } from '../utils/currency';

interface SpendingTrendsProps {
  transactions: Transaction[];
  currency: CurrencyCode;
}

interface TrendDay {
  dateStr: string; // YYYY-MM-DD
  label: string;   // MMM DD
  income: number;
  expense: number;
}

export const SpendingTrends: React.FC<SpendingTrendsProps> = React.memo(({ transactions, currency }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 260 });
  const [hoveredPoint, setHoveredPoint] = useState<TrendDay | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);

  // Measure container dimensions responsively
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width } = entry.contentRect;
        // Keep a minimum width of 300px, and height responsive but structured
        setDimensions({
          width: Math.max(width, 300),
          height: 240,
        });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Compute 30-day timeline data
  const data = useMemo<TrendDay[]>(() => {
    if (transactions.length === 0) {
      // Return empty array
      return [];
    }

    // Determine latest date in transactions to ensure we don't show empty charts for historical data
    const txDates = transactions
      .map((t) => new Date(t.date).getTime())
      .filter((time) => !isNaN(time));
    const latestTime = txDates.length > 0 ? Math.max(...txDates) : new Date().getTime();
    let latestDate = new Date(latestTime);
    if (isNaN(latestDate.getTime())) {
      latestDate = new Date();
    }

    // Generate 30 days backwards from latestDate
    const days: TrendDay[] = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let i = 29; i >= 0; i--) {
      const d = new Date(latestDate);
      d.setDate(latestDate.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const label = `${months[d.getMonth()]} ${d.getDate()}`;
      
      days.push({
        dateStr,
        label,
        income: 0,
        expense: 0,
      });
    }

    // Populate data with transaction sums
    transactions.forEach((tx) => {
      const match = days.find((day) => day.dateStr === tx.date);
      if (match) {
        let val = tx.amount;
        if (currency === 'USD') {
          val = tx.totalUSD ?? (tx.currency === 'KHR' ? tx.amount / (tx.exchangeRate || 4000) : tx.amount);
        } else if (currency === 'KHR') {
          val = tx.totalKHR ?? (tx.currency === 'USD' ? tx.amount * (tx.exchangeRate || 4000) : tx.amount);
        }

        if (tx.type === 'income') {
          match.income += val;
        } else {
          match.expense += val;
        }
      }
    });

    return days;
  }, [transactions]);

  // SVG Margin configuration
  const margin = { top: 20, right: 20, bottom: 30, left: 45 };
  const graphWidth = dimensions.width - margin.left - margin.right;
  const graphHeight = dimensions.height - margin.top - margin.bottom;

  // D3 calculations for scales and paths
  const chartInfo = useMemo(() => {
    if (data.length === 0) return null;

    // X scale: map 0 to 29 index to graphWidth
    const xScale = d3.scaleLinear()
      .domain([0, data.length - 1])
      .range([0, graphWidth]);

    // Find max value between income and expense to determine Y scale bounds
    const maxVal = d3.max(data, (d: TrendDay) => Math.max(d.income, d.expense)) || 100;
    const yScale = d3.scaleLinear()
      .domain([0, maxVal * 1.1]) // add 10% breathing room at the top
      .range([graphHeight, 0]);

    // Create D3 lines
    const incomeLineGenerator = d3.line<TrendDay>()
      .x((_, i) => xScale(i))
      .y((d) => yScale(d.income))
      .curve(d3.curveMonotoneX); // Smooth Bezier curves

    const expenseLineGenerator = d3.line<TrendDay>()
      .x((_, i) => xScale(i))
      .y((d) => yScale(d.expense))
      .curve(d3.curveMonotoneX); // Smooth Bezier curves

    const incomePath = incomeLineGenerator(data) || '';
    const expensePath = expenseLineGenerator(data) || '';

    // Create area under curve for ambient styling
    const incomeAreaGenerator = d3.area<TrendDay>()
      .x((_, i) => xScale(i))
      .y0(graphHeight)
      .y1((d) => yScale(d.income))
      .curve(d3.curveMonotoneX);

    const expenseAreaGenerator = d3.area<TrendDay>()
      .x((_, i) => xScale(i))
      .y0(graphHeight)
      .y1((d) => yScale(d.expense))
      .curve(d3.curveMonotoneX);

    const incomeArea = incomeAreaGenerator(data) || '';
    const expenseArea = expenseAreaGenerator(data) || '';

    return {
      xScale,
      yScale,
      incomePath,
      expensePath,
      incomeArea,
      expenseArea,
      maxVal,
    };
  }, [data, graphWidth, graphHeight]);

  // Handle pointer tracking for tooltip
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!chartInfo || data.length === 0) return;
    const svgRect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - svgRect.left - margin.left;

    // Check bounds
    if (mouseX < 0 || mouseX > graphWidth) {
      setHoveredPoint(null);
      setHoverX(null);
      return;
    }

    // Map pixel X coordinate back to index in data
    const exactIndex = chartInfo.xScale.invert(mouseX);
    const index = Math.min(Math.max(Math.round(exactIndex), 0), data.length - 1);
    
    setHoveredPoint(data[index]);
    setHoverX(chartInfo.xScale(index));
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
    setHoverX(null);
  };

  // Render horizontal grid lines
  const gridLinesY = useMemo(() => {
    if (!chartInfo) return [];
    const ticks = chartInfo.yScale.ticks(4);
    return ticks.map((val) => ({
      val,
      y: chartInfo.yScale(val),
    }));
  }, [chartInfo]);

  // Render vertical grid line markers for clean typography
  const gridLinesX = useMemo(() => {
    if (!chartInfo || data.length === 0) return [];
    // Show 4-5 labels across the 30 days
    const step = Math.floor(data.length / 5);
    const indexes = [];
    for (let i = 0; i < data.length; i += step) {
      indexes.push(i);
    }
    // ensure last index is included
    if (!indexes.includes(data.length - 1)) {
      indexes.push(data.length - 1);
    }

    return indexes.map((idx) => ({
      idx,
      x: chartInfo.xScale(idx),
      label: data[idx].label,
    }));
  }, [chartInfo, data]);

  return (
    <div 
      className="bg-gradient-to-br from-white to-slate-50/40 dark:from-slate-900 dark:to-slate-900/60 rounded-3xl border border-slate-100/80 dark:border-slate-800/80 p-6 shadow-[var(--shadow-premium)] hover:shadow-[var(--shadow-premium-hover)] dark:hover:shadow-[var(--shadow-premium-dark-hover)] transition-all duration-300" 
      id="spending-trends-widget"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
        <div>
          <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 tracking-tight font-display flex items-center gap-1.5">
            <CategoryIcon name="TrendingUp" size={14} className="text-indigo-500" />
            Spending Trends (Last 30 Days)
          </h3>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
            Timeline of daily income vs expenses
          </p>
        </div>

        {/* Custom Legend pills */}
        <div className="flex gap-4 text-[10px] font-extrabold uppercase tracking-wider select-none">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 dark:bg-emerald-400 block shrink-0" />
            <span className="text-slate-500 dark:text-slate-400">Income</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 dark:bg-indigo-400 block shrink-0" />
            <span className="text-slate-500 dark:text-slate-400">Expenses</span>
          </div>
        </div>
      </div>

      {/* SVG Plotting stage */}
      <div ref={containerRef} className="w-full relative min-h-[240px]">
        {data.length < 2 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-slate-300 dark:text-slate-700">
            <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-400 mb-3 border border-slate-100 dark:border-slate-850">
              <CategoryIcon name="Activity" size={20} />
            </div>
            <p className="text-sm font-semibold">Insufficient transactions to analyze trends</p>
            <p className="text-xs text-slate-400 dark:text-slate-555 mt-1 max-w-xs">
              Log transactions on multiple dates to compute timeline progress curves.
            </p>
          </div>
        ) : chartInfo ? (
          <>
            <svg
              width="100%"
              height={dimensions.height}
              viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
              className="overflow-visible select-none"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <defs>
                {/* Gradients */}
                <linearGradient id="incomeAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.00" />
                </linearGradient>
                <linearGradient id="expenseAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.00" />
                </linearGradient>
              </defs>

              <g transform={`translate(${margin.left}, ${margin.top})`}>
                {/* Gridlines */}
                {gridLinesY.map((grid) => (
                  <g key={`grid-y-${grid.val}`} className="opacity-40 dark:opacity-20">
                    <line
                      x1={0}
                      y1={grid.y}
                      x2={graphWidth}
                      y2={grid.y}
                      stroke="#cbd5e1"
                      strokeWidth={1}
                      strokeDasharray="4 4"
                    />
                    <text
                      x={-8}
                      y={grid.y + 3}
                      textAnchor="end"
                      className="text-[8px] font-mono font-extrabold fill-slate-400 dark:fill-slate-500"
                    >
                      {formatAmount(grid.val, currency).split('.')[0]}
                    </text>
                  </g>
                ))}

                {/* X-Axis labels */}
                {gridLinesX.map((grid) => (
                  <g key={`grid-x-${grid.idx}`} className="opacity-50 dark:opacity-30">
                    <line
                      x1={grid.x}
                      y1={0}
                      x2={grid.x}
                      y2={graphHeight}
                      stroke="#e2e8f0"
                      strokeWidth={1}
                      strokeDasharray="3 3"
                    />
                    <text
                      x={grid.x}
                      y={graphHeight + 16}
                      textAnchor="middle"
                      className="text-[9px] font-bold fill-slate-400 dark:fill-slate-500"
                    >
                      {grid.label}
                    </text>
                  </g>
                ))}

                {/* Shaded Areas */}
                <path d={chartInfo.incomeArea} fill="url(#incomeAreaGrad)" />
                <path d={chartInfo.expenseArea} fill="url(#expenseAreaGrad)" />

                {/* Curve Lines */}
                <path
                  d={chartInfo.incomePath}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d={chartInfo.expensePath}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Hover vertical bar */}
                {hoverX !== null && hoveredPoint && (
                  <>
                    <line
                      x1={hoverX}
                      y1={0}
                      x2={hoverX}
                      y2={graphHeight}
                      stroke="#818cf8"
                      strokeWidth={1.5}
                      strokeDasharray="3 3"
                      className="opacity-70"
                    />
                    
                    {/* Hover points on curves */}
                    <circle
                      cx={hoverX}
                      cy={chartInfo.yScale(hoveredPoint.income)}
                      r={5}
                      fill="#10b981"
                      stroke="#fff"
                      strokeWidth={2}
                      className="shadow-sm"
                    />
                    <circle
                      cx={hoverX}
                      cy={chartInfo.yScale(hoveredPoint.expense)}
                      r={5}
                      fill="#6366f1"
                      stroke="#fff"
                      strokeWidth={2}
                      className="shadow-sm"
                    />
                  </>
                )}
              </g>
            </svg>

            {/* Premium details bar */}
            <div className="mt-4 flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 select-none transition-all">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-100/50 dark:bg-slate-900 flex items-center justify-center border border-slate-200/20">
                  <CategoryIcon name="Calendar" size={13} className="text-slate-500 dark:text-slate-400" />
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
                    {hoveredPoint ? 'Timeline Spot' : 'Active Balance Analysis'}
                  </span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {hoveredPoint ? hoveredPoint.dateStr : 'Hover graph curves to track daily trends'}
                  </span>
                </div>
              </div>

              <div className="flex gap-6">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block text-right">
                    Daily Income
                  </span>
                  <span className="text-xs font-extrabold font-mono text-emerald-600 dark:text-emerald-400 block text-right">
                    {hoveredPoint ? formatAmount(hoveredPoint.income, currency) : '--'}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block text-right">
                    Daily Outflow
                  </span>
                  <span className="text-xs font-extrabold font-mono text-indigo-600 dark:text-indigo-400 block text-right">
                    {hoveredPoint ? formatAmount(hoveredPoint.expense, currency) : '--'}
                  </span>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
});
SpendingTrends.displayName = 'SpendingTrends';
