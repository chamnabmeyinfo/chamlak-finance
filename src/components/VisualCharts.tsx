import React, { useState, useMemo } from 'react';
import { Transaction, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../types';
import { CategoryIcon } from './CategoryIcon';

interface VisualChartsProps {
  transactions: Transaction[];
}

export const VisualCharts: React.FC<VisualChartsProps> = ({ transactions }) => {
  const [activeTab, setActiveTab] = useState<'expenses' | 'income' | 'trend'>('expenses');
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
  const [hoveredTrendPoint, setHoveredTrendPoint] = useState<{
    index: number;
    x: number;
    y: number;
    date: string;
    balance: number;
    change: number;
  } | null>(null);

  // Group by category for the donut charts
  const categoryData = useMemo(() => {
    const expensesMap: Record<string, number> = {};
    const incomeMap: Record<string, number> = {};
    let totalExpenseSum = 0;
    let totalIncomeSum = 0;

    transactions.forEach((tx) => {
      const amount = tx.amount;
      if (tx.type === 'expense') {
        expensesMap[tx.category] = (expensesMap[tx.category] || 0) + amount;
        totalExpenseSum += amount;
      } else {
        incomeMap[tx.category] = (incomeMap[tx.category] || 0) + amount;
        totalIncomeSum += amount;
      }
    });

    const expensesList = Object.entries(expensesMap).map(([category, value]) => {
      const config = EXPENSE_CATEGORIES[category] || { name: category, color: 'bg-slate-100 text-slate-700', icon: 'HelpCircle' };
      return {
        id: category,
        name: config.name,
        value,
        percentage: totalExpenseSum > 0 ? (value / totalExpenseSum) * 100 : 0,
        colorClass: config.color,
        icon: config.icon,
      };
    }).sort((a, b) => b.value - a.value);

    const incomeList = Object.entries(incomeMap).map(([category, value]) => {
      const config = INCOME_CATEGORIES[category] || { name: category, color: 'bg-slate-100 text-slate-700', icon: 'HelpCircle' };
      return {
        id: category,
        name: config.name,
        value,
        percentage: totalIncomeSum > 0 ? (value / totalIncomeSum) * 100 : 0,
        colorClass: config.color,
        icon: config.icon,
      };
    }).sort((a, b) => b.value - a.value);

    return {
      expenses: expensesList,
      income: incomeList,
      totalExpense: totalExpenseSum,
      totalIncome: totalIncomeSum,
    };
  }, [transactions]);

  // Timeline trend points
  const trendData = useMemo(() => {
    if (transactions.length === 0) return [];

    // Sort chronologically (oldest first)
    const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    const points: { date: string; balance: number; change: number }[] = [];

    // Group transactions by date to avoid multiple dots on same vertical line
    const dateMap: Record<string, { balanceChange: number; lastTxDate: string }> = {};

    sorted.forEach((tx) => {
      const change = tx.type === 'income' ? tx.amount : -tx.amount;
      dateMap[tx.date] = {
        balanceChange: (dateMap[tx.date]?.balanceChange || 0) + change,
        lastTxDate: tx.date,
      };
    });

    const sortedDates = Object.keys(dateMap).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    sortedDates.forEach((date) => {
      const dayData = dateMap[date];
      runningBalance += dayData.balanceChange;
      points.push({
        date,
        balance: runningBalance,
        change: dayData.balanceChange,
      });
    });

    return points;
  }, [transactions]);

  // SVG dimensions for Donut Chart
  const donutRadius = 70;
  const donutStrokeWidth = 16;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const donutCenter = 90;

  // Render donut segment coordinates safely
  const renderDonutSegments = (dataList: typeof categoryData.expenses, totalSum: number) => {
    let accumulatedAngle = -90; // Start at the top (12 o'clock)

    return dataList.map((item, index) => {
      const share = totalSum > 0 ? item.value / totalSum : 0;
      const angle = share * 360;
      
      // Calculate start and end coordinates of the arc
      const startRad = (accumulatedAngle * Math.PI) / 180;
      const endRad = ((accumulatedAngle + angle) * Math.PI) / 180;

      const x1 = donutCenter + donutRadius * Math.cos(startRad);
      const y1 = donutCenter + donutRadius * Math.sin(startRad);
      const x2 = donutCenter + donutRadius * Math.cos(endRad);
      const y2 = donutCenter + donutRadius * Math.sin(endRad);

      const largeArcFlag = angle > 180 ? 1 : 0;

      // Increment angle
      accumulatedAngle += angle;

      // Special case for full circle
      if (share >= 0.999) {
        return (
          <circle
            key={item.id}
            cx={donutCenter}
            cy={donutCenter}
            r={donutRadius}
            fill="none"
            stroke="currentColor"
            strokeWidth={donutStrokeWidth}
            className={`${item.colorClass.split(' ')[1] || 'text-slate-500'} transition-all duration-300 ${
              hoveredSegment === item.id ? 'stroke-[20px]' : ''
            }`}
            onMouseEnter={() => setHoveredSegment(item.id)}
            onMouseLeave={() => setHoveredSegment(null)}
          />
        );
      }

      // Format path: M startX startY A radius radius 0 largeArcFlag 1 endX endY
      const pathData = `M ${x1} ${y1} A ${donutRadius} ${donutRadius} 0 ${largeArcFlag} 1 ${x2} ${y2}`;

      return (
        <path
          key={item.id}
          d={pathData}
          fill="none"
          stroke="currentColor"
          strokeWidth={donutStrokeWidth}
          strokeLinecap="round"
          className={`${item.colorClass.split(' ')[1] || 'text-slate-500'} transition-all duration-300 cursor-pointer ${
            hoveredSegment === item.id ? 'stroke-[20px] filter drop-shadow-md' : 'opacity-90'
          }`}
          onMouseEnter={() => setHoveredSegment(item.id)}
          onMouseLeave={() => setHoveredSegment(null)}
        />
      );
    });
  };

  // SVG dimensions for Trend line
  const trendWidth = 500;
  const trendHeight = 200;
  const paddingX = 40;
  const paddingY = 30;

  // Generate SVG path for trend line
  const trendPathInfo = useMemo(() => {
    if (trendData.length < 2) return null;

    const balances = trendData.map((d) => d.balance);
    const minBal = Math.min(...balances);
    const maxBal = Math.max(...balances);
    const range = maxBal - minBal === 0 ? 100 : maxBal - minBal;

    // Buffer to fit labels
    const adjustedMin = minBal - range * 0.1;
    const adjustedMax = maxBal + range * 0.1;
    const adjustedRange = adjustedMax - adjustedMin;

    const points = trendData.map((d, index) => {
      const x = paddingX + (index / (trendData.length - 1)) * (trendWidth - paddingX * 2);
      const y = trendHeight - paddingY - ((d.balance - adjustedMin) / adjustedRange) * (trendHeight - paddingY * 2);
      return { x, y, ...d };
    });

    // Create svg path d-attribute
    const linePath = points.reduce(
      (acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`),
      ''
    );

    // Create gradient fill path
    const fillPath = `${linePath} L ${points[points.length - 1].x} ${trendHeight - paddingY} L ${points[0].x} ${trendHeight - paddingY} Z`;

    return { points, linePath, fillPath, minBal, maxBal };
  }, [trendData]);

  // Handle trend hover coordinate mapping
  const handleTrendMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!trendPathInfo) return;
    const svgRect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - svgRect.left;

    // Map custom SVG viewport coordinate
    const scaleX = trendWidth / svgRect.width;
    const relativeX = mouseX * scaleX;

    // Find closest point in trend points
    let closestIndex = 0;
    let closestDist = Infinity;

    trendPathInfo.points.forEach((p, index) => {
      const dist = Math.abs(p.x - relativeX);
      if (dist < closestDist) {
        closestDist = dist;
        closestIndex = index;
      }
    });

    const p = trendPathInfo.points[closestIndex];
    setHoveredTrendPoint({
      index: closestIndex,
      x: p.x,
      y: p.y,
      date: p.date,
      balance: p.balance,
      change: p.change,
    });
  };

  const selectedData = activeTab === 'expenses' ? categoryData.expenses : categoryData.income;
  const selectedSum = activeTab === 'expenses' ? categoryData.totalExpense : categoryData.totalIncome;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col" id="visual-charts">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 tracking-tight">Financial Insights</h2>
          <p className="text-xs text-slate-400">Interactive visual summary of accounts</p>
        </div>

        {/* Tab Buttons */}
        <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('expenses')}
            className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
              activeTab === 'expenses'
                ? 'bg-white text-slate-800 shadow-xs border border-slate-100'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            id="tab-expenses"
          >
            Expenses
          </button>
          <button
            onClick={() => setActiveTab('income')}
            className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
              activeTab === 'income'
                ? 'bg-white text-slate-800 shadow-xs border border-slate-100'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            id="tab-income"
          >
            Income
          </button>
          <button
            onClick={() => setActiveTab('trend')}
            className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
              activeTab === 'trend'
                ? 'bg-white text-slate-800 shadow-xs border border-slate-100'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            id="tab-trend"
          >
            Balance Trend
          </button>
        </div>
      </div>

      {/* Chart Body */}
      <div className="flex-1 flex flex-col justify-center min-h-[220px]">
        {activeTab !== 'trend' ? (
          /* Category Donut Visuals */
          transactions.filter((t) => t.type === (activeTab === 'expenses' ? 'expense' : 'income')).length === 0 ? (
            <div className="text-center py-12 flex flex-col items-center justify-center text-slate-300">
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mb-3 border border-slate-100">
                <CategoryIcon name="Info" size={20} />
              </div>
              <p className="text-sm font-medium">No {activeTab} data found</p>
              <p className="text-xs text-slate-400 max-w-xs mt-1">
                Add some {activeTab === 'expenses' ? 'expenses' : 'income'} to visualize category distributions.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* Donut Column */}
              <div className="md:col-span-5 flex justify-center relative">
                <svg width="180" height="180" viewBox="0 0 180 180" className="transform -rotate-180">
                  <circle
                    cx={donutCenter}
                    cy={donutCenter}
                    r={donutRadius}
                    fill="none"
                    stroke="#f8fafc"
                    strokeWidth={donutStrokeWidth}
                  />
                  {renderDonutSegments(selectedData, selectedSum)}
                </svg>

                {/* Donut Center Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xs text-slate-400 font-medium">
                    {hoveredSegment
                      ? selectedData.find((d) => d.id === hoveredSegment)?.name
                      : `Total ${activeTab === 'expenses' ? 'Expenses' : 'Income'}`}
                  </span>
                  <span className="text-lg font-bold text-slate-800 font-mono tracking-tight mt-0.5">
                    $
                    {hoveredSegment
                      ? selectedData.find((d) => d.id === hoveredSegment)?.value.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : selectedSum.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                  </span>
                  {hoveredSegment && (
                    <span className="text-xs font-semibold bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded-md border border-slate-100 font-mono mt-1">
                      {selectedData.find((d) => d.id === hoveredSegment)?.percentage.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>

              {/* Legend List Column */}
              <div className="md:col-span-7 space-y-3 max-h-[220px] overflow-y-auto pr-1 select-none">
                {selectedData.map((item) => (
                  <div
                    key={item.id}
                    onMouseEnter={() => setHoveredSegment(item.id)}
                    onMouseLeave={() => setHoveredSegment(null)}
                    className={`flex items-center justify-between p-2 rounded-xl border transition-all duration-200 cursor-pointer ${
                      hoveredSegment === item.id
                        ? 'bg-slate-50 border-slate-200 shadow-2xs'
                        : 'bg-white border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.colorClass}`}>
                        <CategoryIcon name={item.icon} size={15} />
                      </div>
                      <div>
                        <span className="text-sm font-medium text-slate-700 block">{item.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{item.percentage.toFixed(1)}% of total</span>
                      </div>
                    </div>
                    <div className="text-right font-mono text-sm font-semibold text-slate-800">
                      ${item.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : (
          /* Trend Graph Visuals */
          trendData.length < 2 ? (
            <div className="text-center py-12 flex flex-col items-center justify-center text-slate-300">
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mb-3 border border-slate-100">
                <CategoryIcon name="TrendingUp" size={20} />
              </div>
              <p className="text-sm font-medium">Insufficient timeline data</p>
              <p className="text-xs text-slate-400 max-w-xs mt-1">
                Add transactions on multiple dates to render the chronologic account balance trend.
              </p>
            </div>
          ) : (
            <div className="w-full relative h-[180px] sm:h-[220px] md:h-[240px] lg:h-[220px]">
              <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${trendWidth} ${trendHeight}`}
                className="overflow-visible"
                onMouseMove={handleTrendMouseMove}
                onMouseLeave={() => setHoveredTrendPoint(null)}
              >
                <defs>
                  {/* Linear gradient for trend area */}
                  <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.00" />
                  </linearGradient>
                </defs>

                {/* Horizontal reference grid lines */}
                <line
                  x1={paddingX}
                  y1={paddingY}
                  x2={trendWidth - paddingX}
                  y2={paddingY}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <line
                  x1={paddingX}
                  y1={(trendHeight - paddingY * 2) / 2 + paddingY}
                  x2={trendWidth - paddingX}
                  y2={(trendHeight - paddingY * 2) / 2 + paddingY}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <line
                  x1={paddingX}
                  y1={trendHeight - paddingY}
                  x2={trendWidth - paddingX}
                  y2={trendHeight - paddingY}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />

                {/* Shaded Area Under Line */}
                {trendPathInfo && (
                  <path d={trendPathInfo.fillPath} fill="url(#trendGradient)" />
                )}

                {/* Main Trend Line */}
                {trendPathInfo && (
                  <path
                    d={trendPathInfo.linePath}
                    fill="none"
                    stroke="#0ea5e9"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Axis Labels */}
                <text
                  x={paddingX}
                  y={trendHeight - 10}
                  className="text-[9px] font-medium text-slate-400"
                  textAnchor="start"
                >
                  {trendData[0]?.date}
                </text>
                <text
                  x={trendWidth - paddingX}
                  y={trendHeight - 10}
                  className="text-[9px] font-medium text-slate-400"
                  textAnchor="end"
                >
                  {trendData[trendData.length - 1]?.date}
                </text>

                {/* Y-Axis scale markers */}
                {trendPathInfo && (
                  <>
                    <text
                      x={paddingX - 6}
                      y={paddingY + 4}
                      className="text-[8px] font-mono font-medium text-slate-400"
                      textAnchor="end"
                    >
                      ${trendPathInfo.maxBal.toFixed(0)}
                    </text>
                    <text
                      x={paddingX - 6}
                      y={trendHeight - paddingY + 4}
                      className="text-[8px] font-mono font-medium text-slate-400"
                      textAnchor="end"
                    >
                      ${trendPathInfo.minBal.toFixed(0)}
                    </text>
                  </>
                )}

                {/* Interacting interactive cursor circle & vertical guideline */}
                {hoveredTrendPoint && (
                  <>
                    <line
                      x1={hoveredTrendPoint.x}
                      y1={paddingY}
                      x2={hoveredTrendPoint.x}
                      y2={trendHeight - paddingY}
                      stroke="#38bdf8"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                    <circle
                      cx={hoveredTrendPoint.x}
                      cy={hoveredTrendPoint.y}
                      r="6"
                      fill="#0ea5e9"
                      stroke="white"
                      strokeWidth="2"
                      className="filter drop-shadow-sm transition-all duration-100"
                    />
                  </>
                )}
              </svg>

              {/* Float-Style Hover Tooltip container */}
              <div className="mt-4 flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs select-none">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">
                    {hoveredTrendPoint ? 'Date & Balance Point' : 'Interactive Tracker'}
                  </span>
                  <span className="text-sm font-semibold text-slate-700">
                    {hoveredTrendPoint ? hoveredTrendPoint.date : 'Hover trend plot above'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">
                    Net Account Position
                  </span>
                  <span className={`text-sm font-bold font-mono ${
                    (hoveredTrendPoint ? hoveredTrendPoint.balance : (trendData[trendData.length - 1]?.balance || 0)) >= 0
                      ? 'text-emerald-600'
                      : 'text-red-500'
                  }`}>
                    ${(hoveredTrendPoint ? hoveredTrendPoint.balance : (trendData[trendData.length - 1]?.balance || 0)).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};
