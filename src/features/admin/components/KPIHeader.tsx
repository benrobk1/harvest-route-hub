import { useQuery } from '@tanstack/react-query';
import { fetchKPIs } from '@/lib/adminKPIs';
import { Users, DollarSign, CheckCircle, Package, Heart, UserMinus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney } from '@/lib/formatMoney';
import { cn } from '@/lib/utils';
import { adminQueries } from '@/features/admin';

interface KPIMetricProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: number;
  target?: string;
  comparison?: string;
  status?: 'excellent' | 'good' | 'warning';
}

const KPIMetric = ({ label, value, icon, trend, target, comparison, status }: KPIMetricProps) => {
  const getStatusColor = () => {
    if (status === 'excellent') return 'text-success border-success/20 bg-success/5';
    if (status === 'warning') return 'text-warning border-warning/20 bg-warning/5';
    return 'text-primary border-primary/20 bg-primary/5';
  };

  return (
    <div className={cn('flex flex-col gap-1 p-3 rounded-lg border', getStatusColor())}>
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-background/50 flex items-center justify-center">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-xl font-bold truncate">{value}</p>
            {trend !== undefined && (
              <span className={cn(
                'text-xs font-medium',
                trend >= 0 ? 'text-success' : 'text-destructive'
              )}>
                {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
              </span>
            )}
          </div>
          {target && (
            <p className="text-xs text-muted-foreground">Target: {target}</p>
          )}
          {comparison && (
            <p className="text-xs font-medium">{comparison}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export const KPIHeader = () => {
  const { data: kpis, isLoading } = useQuery({
    queryKey: adminQueries.kpis(),
    queryFn: () => fetchKPIs(),
    refetchInterval: 30000, // Update every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!kpis) return null;

  const getOnTimeStatus = (percent: number) => {
    if (percent >= 95) return 'excellent';
    if (percent >= 90) return 'good';
    return 'warning';
  };

  const getDensityStatus = (orders: number) => {
    if (orders >= 35 && orders <= 40) return 'excellent';
    if (orders >= 30) return 'good';
    return 'warning';
  };

  return (
    <div className="bg-gradient-to-r from-primary/10 to-secondary/10 border-b shadow-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPIMetric
            label="Households"
            value={kpis.households}
            icon={<Users className="h-4 w-4" />}
            trend={kpis.householdsTrend}
          />
          
          <KPIMetric
            label="AOV"
            value={formatMoney(kpis.aov)}
            icon={<DollarSign className="h-4 w-4" />}
            target="$35-50"
          />
          
          <KPIMetric
            label="Customer LTV"
            value={formatMoney(kpis.aov * 12 * 2.5)}
            icon={<Heart className="h-4 w-4" />}
            comparison="2.5yr avg"
          />
          
          <KPIMetric
            label="Monthly Churn"
            value={`${kpis.churnRate}%`}
            icon={<UserMinus className="h-4 w-4" />}
            status={kpis.churnRate < 5 ? "excellent" : kpis.churnRate < 10 ? "good" : "warning"}
          />
          
          <KPIMetric
            label="On-Time"
            value={`${kpis.onTimePercent}%`}
            icon={<CheckCircle className="h-4 w-4" />}
            status={getOnTimeStatus(kpis.onTimePercent)}
          />
          
          <KPIMetric
            label="Orders/Route"
            value={kpis.ordersPerRoute}
            icon={<Package className="h-4 w-4" />}
            target="35-40"
            status={getDensityStatus(kpis.ordersPerRoute)}
          />
        </div>
      </div>
    </div>
  );
};
