import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Activity, AlertCircle, TrendingUp, Zap, Shield } from 'lucide-react';
import { MonitoringChart } from '@/components/MonitoringChart';
import { Skeleton } from '@/components/ui/skeleton';

type MetricsSummary = {
  function_name: string;
  total_requests: number;
  success_rate: number;
  avg_duration_ms: number;
  p95_duration_ms: number;
  p99_duration_ms: number;
  error_count: number;
  rate_limit_hits: number;
  auth_failures: number;
  last_hour_requests: number;
};

type MetricsResponse = {
  success: boolean;
  time_range: string;
  start_time: string;
  end_time: string;
  summary: {
    total_requests: number;
    avg_success_rate: number;
    total_errors: number;
    total_rate_limits: number;
  };
  functions: MetricsSummary[];
  time_series: Array<{
    timestamp: string;
    requests: number;
    errors: number;
    avg_duration: number;
  }>;
};

export default function Monitoring() {
  const [timeRange, setTimeRange] = useState('24h');
  const [selectedFunction, setSelectedFunction] = useState<string>('all');

  const { data: metrics, isLoading, error, refetch } = useQuery({
    queryKey: ['metrics', timeRange, selectedFunction],
    queryFn: async () => {
      const params = new URLSearchParams({ range: timeRange });
      if (selectedFunction !== 'all') {
        params.append('function', selectedFunction);
      }

      const { data, error } = await supabase.functions.invoke('get-metrics', {
        body: {},
        method: 'GET',
      });

      if (error) throw error;
      return data as MetricsResponse;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Auto-refresh on mount
  useEffect(() => {
    refetch();
  }, [refetch]);

  if (error) {
    return (
      <div className="container py-8">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Error Loading Metrics
            </CardTitle>
            <CardDescription>
              {error instanceof Error ? error.message : 'Failed to load monitoring data'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Monitoring</h1>
          <p className="text-muted-foreground">
            Real-time edge function metrics and performance analytics
          </p>
        </div>
        <div className="flex gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedFunction} onValueChange={setSelectedFunction}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Functions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Functions</SelectItem>
              {metrics?.functions.map((fn) => (
                <SelectItem key={fn.function_name} value={fn.function_name}>
                  {fn.function_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{metrics?.summary.total_requests.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  Across {metrics?.functions.length} functions
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {metrics?.summary.avg_success_rate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {metrics?.summary.total_errors} errors total
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rate Limits</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{metrics?.summary.total_rate_limits}</div>
                <p className="text-xs text-muted-foreground">
                  Requests throttled
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {Math.round(
                    metrics?.functions.reduce((sum, f) => sum + f.avg_duration_ms, 0) ?? 0 / 
                    (metrics?.functions.length ?? 1)
                  )}ms
                </div>
                <p className="text-xs text-muted-foreground">
                  Average response time
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="requests" className="space-y-4">
        <TabsList>
          <TabsTrigger value="requests">Request Volume</TabsTrigger>
          <TabsTrigger value="duration">Response Time</TabsTrigger>
          <TabsTrigger value="errors">Error Rate</TabsTrigger>
          <TabsTrigger value="functions">Function Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Request Volume Over Time</CardTitle>
              <CardDescription>
                Total requests and errors by time interval
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <MonitoringChart
                  type="line"
                  data={metrics?.time_series ?? []}
                  config={{
                    requests: { label: 'Requests', color: 'hsl(var(--primary))' },
                    errors: { label: 'Errors', color: 'hsl(var(--destructive))' },
                  }}
                  dataKeys={['requests', 'errors']}
                  xAxisKey="timestamp"
                  height={300}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="duration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Response Time Over Time</CardTitle>
              <CardDescription>
                Average response duration in milliseconds
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <MonitoringChart
                  type="area"
                  data={metrics?.time_series ?? []}
                  config={{
                    avg_duration: { label: 'Avg Duration (ms)', color: 'hsl(var(--chart-2))' },
                  }}
                  dataKeys={['avg_duration']}
                  xAxisKey="timestamp"
                  height={300}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Error Distribution</CardTitle>
              <CardDescription>
                Errors and authentication failures by function
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <MonitoringChart
                  type="bar"
                  data={metrics?.functions ?? []}
                  config={{
                    error_count: { label: 'Errors', color: 'hsl(var(--destructive))' },
                    auth_failures: { label: 'Auth Failures', color: 'hsl(var(--warning))' },
                  }}
                  dataKeys={['error_count', 'auth_failures']}
                  xAxisKey="function_name"
                  height={300}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="functions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Function Performance</CardTitle>
              <CardDescription>
                Detailed metrics for each edge function
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {metrics?.functions
                    .sort((a, b) => b.total_requests - a.total_requests)
                    .map((fn) => (
                      <Card key={fn.function_name}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base font-mono">
                              {fn.function_name}
                            </CardTitle>
                            <Badge variant={fn.success_rate > 95 ? 'default' : 'destructive'}>
                              {fn.success_rate.toFixed(1)}% success
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Requests</p>
                              <p className="font-semibold">{fn.total_requests.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Avg Duration</p>
                              <p className="font-semibold">{fn.avg_duration_ms}ms</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">P95</p>
                              <p className="font-semibold">{fn.p95_duration_ms}ms</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Errors</p>
                              <p className="font-semibold text-destructive">{fn.error_count}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Rate Limits</p>
                              <p className="font-semibold">{fn.rate_limit_hits}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
