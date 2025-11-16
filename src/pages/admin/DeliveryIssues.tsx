import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, CheckCircle, Clock, XCircle, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

type IssueStatus = 'open' | 'acknowledged' | 'in_progress' | 'resolved' | 'dismissed';
type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';

interface DeliveryIssue {
  id: string;
  reporter_id: string;
  reporter_type: string;
  delivery_batch_id?: string;
  order_id?: string;
  stop_id?: string;
  category: string;
  severity: IssueSeverity;
  title: string;
  description: string;
  latitude?: number;
  longitude?: number;
  photo_urls?: string[];
  status: IssueStatus;
  admin_notes?: string;
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

const SEVERITY_CONFIG = {
  low: { icon: '🔵', color: 'bg-blue-500', label: 'Low' },
  medium: { icon: '🟡', color: 'bg-yellow-500', label: 'Medium' },
  high: { icon: '🟠', color: 'bg-orange-500', label: 'High' },
  critical: { icon: '🔴', color: 'bg-red-500', label: 'Critical' },
};

const STATUS_CONFIG = {
  open: { icon: AlertTriangle, color: 'text-orange-500', label: 'Open' },
  acknowledged: { icon: Clock, color: 'text-blue-500', label: 'Acknowledged' },
  in_progress: { icon: Clock, color: 'text-purple-500', label: 'In Progress' },
  resolved: { icon: CheckCircle, color: 'text-green-500', label: 'Resolved' },
  dismissed: { icon: XCircle, color: 'text-gray-500', label: 'Dismissed' },
};

export default function DeliveryIssues() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<IssueStatus | 'all'>('open');
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState('');

  // Fetch issues
  const { data: issues, isLoading } = useQuery({
    queryKey: ['delivery-issues', selectedStatus],
    queryFn: async () => {
      let query = supabase
        .from('delivery_issues')
        .select('*')
        .order('created_at', { ascending: false });

      if (selectedStatus !== 'all') {
        query = query.eq('status', selectedStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as DeliveryIssue[];
    },
  });

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('delivery-issues-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'delivery_issues' },
        (payload) => {
          console.log('Issue change:', payload);
          
          // Show toast for new issues
          if (payload.eventType === 'INSERT') {
            const newIssue = payload.new as DeliveryIssue;
            toast({
              title: `🚨 New ${SEVERITY_CONFIG[newIssue.severity].label} Issue`,
              description: newIssue.title,
              duration: 10000,
            });
            
            // Play sound notification
            const audio = new Audio('/notification.mp3');
            audio.play().catch(() => console.log('Audio play failed'));
          }

          queryClient.invalidateQueries({ queryKey: ['delivery-issues'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, toast]);

  // Update issue status
  const updateMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: IssueStatus; notes?: string }) => {
      const { error } = await supabase
        .from('delivery_issues')
        .update({
          status,
          ...(notes && { admin_notes: notes }),
          ...(status === 'resolved' && { resolved_at: new Date().toISOString() }),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Issue updated',
        description: 'Status has been changed successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['delivery-issues'] });
      setSelectedIssue(null);
      setAdminNotes('');
    },
  });

  const handleStatusUpdate = (issueId: string, newStatus: IssueStatus) => {
    updateMutation.mutate({ 
      id: issueId, 
      status: newStatus,
      notes: adminNotes || undefined,
    });
  };

  const getCategoryLabel = (category: string) => {
    return category.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Delivery Issues</h1>
        <Badge variant="outline" className="text-lg">
          {issues?.filter(i => i.status === 'open').length || 0} Open Issues
        </Badge>
      </div>

      <Tabs value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as IssueStatus | 'all')}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="acknowledged">Acknowledged</TabsTrigger>
          <TabsTrigger value="in_progress">In Progress</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
          <TabsTrigger value="dismissed">Dismissed</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedStatus} className="space-y-4 mt-6">
          {isLoading ? (
            <p>Loading issues...</p>
          ) : issues && issues.length > 0 ? (
            issues.map((issue) => {
              const StatusIcon = STATUS_CONFIG[issue.status].icon;
              const severityConfig = SEVERITY_CONFIG[issue.severity];
              const isExpanded = selectedIssue === issue.id;

              return (
                <Card key={issue.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{severityConfig.icon}</span>
                          <CardTitle className="text-xl">{issue.title}</CardTitle>
                          <Badge variant="outline">{getCategoryLabel(issue.category)}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <StatusIcon className={`h-4 w-4 ${STATUS_CONFIG[issue.status].color}`} />
                          <span>{STATUS_CONFIG[issue.status].label}</span>
                          <span>•</span>
                          <span>Reported by {issue.reporter_type}</span>
                          <span>•</span>
                          <span>{formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}</span>
                          {(issue.order_id || issue.stop_id || issue.delivery_batch_id) && (
                            <>
                              <span>•</span>
                              <Badge variant="outline" className="text-xs">
                                📧 Customer notified
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedIssue(isExpanded ? null : issue.id)}
                      >
                        {isExpanded ? 'Collapse' : 'Expand'}
                      </Button>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="space-y-4 pt-0">
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm whitespace-pre-wrap">{issue.description}</p>
                      </div>

                      {issue.admin_notes && (
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex items-center gap-2 mb-2">
                            <MessageSquare className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-900">Admin Notes</span>
                          </div>
                          <p className="text-sm text-blue-800">{issue.admin_notes}</p>
                        </div>
                      )}

                      {issue.latitude && issue.longitude && (
                        <div className="text-sm text-muted-foreground">
                          📍 Location: {issue.latitude.toFixed(6)}, {issue.longitude.toFixed(6)}
                        </div>
                      )}

                      {issue.status !== 'resolved' && issue.status !== 'dismissed' && (
                        <div className="space-y-4 pt-4 border-t">
                          <div className="space-y-2">
                            <Label htmlFor={`notes-${issue.id}`}>Admin Notes</Label>
                            <Textarea
                              id={`notes-${issue.id}`}
                              value={adminNotes}
                              onChange={(e) => setAdminNotes(e.target.value)}
                              placeholder="Add notes about this issue..."
                              rows={3}
                            />
                          </div>

                          <div className="flex gap-2">
                            {issue.status === 'open' && (
                              <Button
                                onClick={() => handleStatusUpdate(issue.id, 'acknowledged')}
                                disabled={updateMutation.isPending}
                              >
                                Acknowledge
                              </Button>
                            )}
                            {(issue.status === 'open' || issue.status === 'acknowledged') && (
                              <Button
                                onClick={() => handleStatusUpdate(issue.id, 'in_progress')}
                                disabled={updateMutation.isPending}
                                variant="secondary"
                              >
                                Start Working
                              </Button>
                            )}
                            {issue.status === 'in_progress' && (
                              <Button
                                onClick={() => handleStatusUpdate(issue.id, 'resolved')}
                                disabled={updateMutation.isPending}
                                variant="default"
                              >
                                Mark Resolved
                              </Button>
                            )}
                            <Button
                              onClick={() => handleStatusUpdate(issue.id, 'dismissed')}
                              disabled={updateMutation.isPending}
                              variant="outline"
                            >
                              Dismiss
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No {selectedStatus !== 'all' && `${selectedStatus} `}issues found
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
