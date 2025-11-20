import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

type ChartDataValue = string | number | null | undefined;

interface ChartConfig {
  [key: string]: {
    label: string;
    color: string;
  };
}

type ChartDataPoint = Record<string, ChartDataValue>;

interface MonitoringChartProps {
  type: 'line' | 'area' | 'bar';
  data: ChartDataPoint[];
  config: ChartConfig;
  dataKeys: string[];
  xAxisKey: string;
  height?: number;
  title?: string;
  description?: string;
}

export function MonitoringChart({
  type,
  data,
  config,
  dataKeys,
  xAxisKey,
  height = 300,
  title,
  description,
}: MonitoringChartProps) {
  const chartContent = (
    <ResponsiveContainer width="100%" height={height}>
      {type === 'line' ? (
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey={xAxisKey}
            className="text-xs"
            tickFormatter={(value) => {
              if (typeof value === 'string' && value.includes('T')) {
                return new Date(value).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                });
              }
              return value;
            }}
          />
          <YAxis className="text-xs" />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
            }}
          />
          <Legend />
          {dataKeys.map((key) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={config[key]?.color || 'hsl(var(--primary))'}
              name={config[key]?.label || key}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      ) : type === 'area' ? (
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey={xAxisKey}
            className="text-xs"
            tickFormatter={(value) => {
              if (typeof value === 'string' && value.includes('T')) {
                return new Date(value).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                });
              }
              return value;
            }}
          />
          <YAxis className="text-xs" />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
            }}
          />
          <Legend />
          {dataKeys.map((key) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              fill={config[key]?.color || 'hsl(var(--primary))'}
              stroke={config[key]?.color || 'hsl(var(--primary))'}
              name={config[key]?.label || key}
              fillOpacity={0.6}
            />
          ))}
        </AreaChart>
      ) : (
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey={xAxisKey} className="text-xs" />
          <YAxis className="text-xs" />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
            }}
          />
          <Legend />
          {dataKeys.map((key) => (
            <Bar
              key={key}
              dataKey={key}
              fill={config[key]?.color || 'hsl(var(--primary))'}
              name={config[key]?.label || key}
            />
          ))}
        </BarChart>
      )}
    </ResponsiveContainer>
  );

  if (title || description) {
    return (
      <div>
        {chartContent}
      </div>
    );
  }

  return chartContent;
}
