/**
 * UsageHistoryChart Component
 * Line chart showing usage history over time
 */

'use client';

import { useTranslations } from 'next-intl';
import type { MonthlyUsageData } from '@/lib/types/usage';

interface UsageHistoryChartProps {
  data: MonthlyUsageData[];
}

export function UsageHistoryChart({ data }: UsageHistoryChartProps) {
  const t = useTranslations('usageHistoryChart');

  if (data.length === 0) {
    return <div className="text-center py-8 text-gray-500 dark:text-gray-400">{t('noData')}</div>;
  }

  // Find max value for scaling
  const maxTickets = Math.max(...data.map(d => d.tickets), 1);
  const maxAgentTasks = Math.max(...data.map(d => d.agent_tasks), 1);
  const maxValue = Math.max(maxTickets, maxAgentTasks);

  // Calculate chart dimensions
  const chartHeight = 200;
  const chartPadding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartWidth = 600;
  const dataWidth = chartWidth - chartPadding.left - chartPadding.right;
  const dataHeight = chartHeight - chartPadding.top - chartPadding.bottom;

  // Calculate positions
  const xStep = dataWidth / (data.length - 1 || 1);

  const getY = (value: number) => {
    return chartPadding.top + dataHeight - (value / maxValue) * dataHeight;
  };

  // Create path for tickets
  const ticketsPath = data
    .map((d, i) => {
      const x = chartPadding.left + i * xStep;
      const y = getY(d.tickets);
      return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    })
    .join(' ');

  // Create path for agent tasks
  const agentTasksPath = data
    .map((d, i) => {
      const x = chartPadding.left + i * xStep;
      const y = getY(d.agent_tasks);
      return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    })
    .join(' ');

  // Create area path for tickets (filled)
  const ticketsAreaPath =
    ticketsPath +
    ` L ${chartPadding.left + (data.length - 1) * xStep} ${
      chartPadding.top + dataHeight
    } L ${chartPadding.left} ${chartPadding.top + dataHeight} Z`;

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('title')}</h3>

      <div className="overflow-x-auto">
        <svg
          width={chartWidth}
          height={chartHeight}
          className="mx-auto"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        >
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
            const y = chartPadding.top + dataHeight * (1 - ratio);
            return (
              <g key={ratio}>
                <line
                  x1={chartPadding.left}
                  y1={y}
                  x2={chartWidth - chartPadding.right}
                  y2={y}
                  stroke="currentColor"
                  strokeDasharray="2,2"
                  className="text-gray-300 dark:text-gray-600"
                  strokeWidth="0.5"
                />
                <text
                  x={chartPadding.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="text-xs fill-gray-500 dark:fill-gray-400"
                >
                  {Math.round(maxValue * ratio)}
                </text>
              </g>
            );
          })}

          {/* Area fill for tickets */}
          <path d={ticketsAreaPath} fill="#3b82f6" fillOpacity="0.1" />

          {/* Line for tickets */}
          <path d={ticketsPath} fill="none" stroke="#3b82f6" strokeWidth="2" />

          {/* Line for agent tasks */}
          <path d={agentTasksPath} fill="none" stroke="#8b5cf6" strokeWidth="2" />

          {/* Data points for tickets */}
          {data.map((d, i) => {
            const x = chartPadding.left + i * xStep;
            const y = getY(d.tickets);
            return (
              <circle
                key={`tickets-${i}`}
                cx={x}
                cy={y}
                r="4"
                fill="#3b82f6"
                className="hover:r-6 transition-all cursor-pointer"
              >
                <title>{t('tooltipTickets', { month: d.month, count: d.tickets })}</title>
              </circle>
            );
          })}

          {/* Data points for agent tasks */}
          {data.map((d, i) => {
            const x = chartPadding.left + i * xStep;
            const y = getY(d.agent_tasks);
            return (
              <circle
                key={`tasks-${i}`}
                cx={x}
                cy={y}
                r="4"
                fill="#8b5cf6"
                className="hover:r-6 transition-all cursor-pointer"
              >
                <title>{t('tooltipAgentTasks', { month: d.month, count: d.agent_tasks })}</title>
              </circle>
            );
          })}

          {/* X-axis labels */}
          {data.map((d, i) => {
            const x = chartPadding.left + i * xStep;
            const y = chartHeight - chartPadding.bottom + 20;
            return (
              <text
                key={`label-${i}`}
                x={x}
                y={y}
                textAnchor="middle"
                className="text-xs fill-gray-500 dark:fill-gray-400"
              >
                {d.month}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">{t('legendTickets')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-500"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">{t('legendAgentTasks')}</span>
        </div>
      </div>
    </div>
  );
}
