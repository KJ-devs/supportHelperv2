/**
 * Simple Pie Chart Component
 * Graphique circulaire simple sans librairie externe
 */

'use client';

interface DataPoint {
  label: string;
  value: number;
  color: string;
}

interface PieChartProps {
  data: DataPoint[];
  title?: string;
  size?: number;
}

export function PieChart({ data, title, size = 200 }: PieChartProps) {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        Aucune donnée disponible
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + item.value, 0);

  // Calculate pie slices
  let currentAngle = -90; // Start at top
  const slices = data.map((item) => {
    const percentage = (item.value / total) * 100;
    const angle = (item.value / total) * 360;
    const slice = {
      ...item,
      percentage,
      startAngle: currentAngle,
      endAngle: currentAngle + angle,
    };
    currentAngle += angle;
    return slice;
  });

  // Generate SVG paths for pie slices
  const radius = size / 2;
  const center = size / 2;

  const polarToCartesian = (angle: number) => {
    const rad = (angle * Math.PI) / 180;
    return {
      x: center + radius * Math.cos(rad),
      y: center + radius * Math.sin(rad),
    };
  };

  const getPathData = (startAngle: number, endAngle: number) => {
    const start = polarToCartesian(startAngle);
    const end = polarToCartesian(endAngle);
    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

    return [
      `M ${center} ${center}`,
      `L ${start.x} ${start.y}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
      'Z',
    ].join(' ');
  };

  return (
    <div>
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{title}</h3>
      )}

      <div className="flex flex-col md:flex-row items-center gap-6">
        {/* Chart */}
        <svg width={size} height={size} className="flex-shrink-0">
          {slices.map((slice, index) => (
            <path
              key={index}
              d={getPathData(slice.startAngle, slice.endAngle)}
              fill={slice.color}
              stroke="white"
              strokeWidth="2"
              className="dark:stroke-gray-900"
            />
          ))}
        </svg>

        {/* Legend */}
        <div className="flex-1 space-y-2">
          {data.map((item, index) => (
            <div key={index} className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-sm flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                    {item.label}
                  </span>
                  <span className="text-sm text-gray-900 dark:text-gray-100 font-semibold ml-2">
                    {item.value} ({((item.value / total) * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
