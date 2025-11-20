import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { adminQueries } from '@/features/admin';
import { getErrorMessage } from '@/lib/errors/getErrorMessage';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { formatMoney } from '@/lib/formatMoney';
import { AlertCircle, CheckCircle2, Clock, XCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Dispute {
  id: string;
  order_id: string;
  consumer_id: string;
  dispute_type: string;
  description: string;
  status: string;
  resolution: string | null;
  refund_amount: number | null;
  created_at: string;
  orders: {
    id: string;
    total_amount: number;
  };
  profiles: {
    full_name: string;
    email: string;
  };
}

const Disputes = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [resolution, setResolution] = useState('');
  const [refundAmount, setRefundAmount] = useState('');

  const { data: disputes, isLoading } = useQuery({
    queryKey: adminQueries.disputes(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('disputes')
        .select(`
          *,
          orders!inner(id, total_amount),
          profiles!disputes_consumer_id_fkey(full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch consumer profiles separately
      const disputesWithProfiles = await Promise.all(
        (data || []).map(async (dispute) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', dispute.consumer_id)
            .single();
          
          return {
            ...dispute,
            profiles: profile || { full_name: 'Unknown', email: 'Unknown' },
          };
        })
      );

      return disputesWithProfiles as Dispute[];
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({
      disputeId,
      status,
      resolution,
      refundAmount,
    }: {
      disputeId: string;
      status: string;
      resolution: string;
      refundAmount: number | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('disputes')
        .update({
          status,
          resolution,
          refund_amount: refundAmount,
          resolved_by: user.id,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', disputeId);

      if (error) throw error;
      
      // Log admin action
      await supabase.rpc('log_admin_action', {
        _action_type: 'dispute_resolved',
        _target_resource_type: 'dispute',
        _target_resource_id: disputeId,
        _new_value: { status, resolution, refund_amount: refundAmount },
      });
    },
    onSuccess: () => {
      toast({
        title: 'Dispute resolved',
        description: 'The dispute has been updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: adminQueries.disputes() });
      setSelectedDispute(null);
      setResolution('');
      setRefundAmount('');
    },
    onError: (error: unknown) => {
      toast({
        title: 'Error',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            Open
          </Badge>
        );
      case 'investigating':
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Investigating
          </Badge>
        );
      case 'resolved':
        return (
          <Badge className="bg-green-500">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Resolved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="outline">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const openDisputes = disputes?.filter((d) => d.status === 'open') || [];
  const investigatingDisputes = disputes?.filter((d) => d.status === 'investigating') || [];
  const resolvedDisputes = disputes?.filter((d) => d.status === 'resolved' || d.status === 'rejected') || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/dashboard')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Disputes & Refunds</h1>
          <p className="text-muted-foreground">Manage customer disputes and process refunds</p>
        </div>
      </div>

      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">Open ({openDisputes.length})</TabsTrigger>
          <TabsTrigger value="investigating">Investigating ({investigatingDisputes.length})</TabsTrigger>
          <TabsTrigger value="resolved">Resolved ({resolvedDisputes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="space-y-4">
          {openDisputes.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No open disputes
              </CardContent>
            </Card>
          ) : (
            openDisputes.map((dispute) => (
              <Card key={dispute.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {dispute.dispute_type.replace('_', ' ').toUpperCase()}
                      </CardTitle>
                      <CardDescription>
                        {dispute.profiles.full_name} ({dispute.profiles.email})
                      </CardDescription>
                    </div>
                    {getStatusBadge(dispute.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-1">Description:</p>
                    <p className="text-sm text-muted-foreground">{dispute.description}</p>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Order Total:</span>{' '}
                      {formatMoney(Number(dispute.orders.total_amount))}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Created:</span>{' '}
                      {new Date(dispute.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button onClick={() => setSelectedDispute(dispute)}>Resolve Dispute</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Resolve Dispute</DialogTitle>
                        <DialogDescription>
                          Provide a resolution and optionally process a refund
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="resolution">Resolution Notes</Label>
                          <Textarea
                            id="resolution"
                            value={resolution}
                            onChange={(e) => setResolution(e.target.value)}
                            placeholder="Explain how this dispute was resolved..."
                            rows={4}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="refund">Refund Amount (optional)</Label>
                          <Input
                            id="refund"
                            type="number"
                            step="0.01"
                            min="0"
                            max={Number(dispute.orders.total_amount)}
                            value={refundAmount}
                            onChange={(e) => setRefundAmount(e.target.value)}
                            placeholder="0.00"
                          />
                          <p className="text-xs text-muted-foreground">
                            Max: {formatMoney(Number(dispute.orders.total_amount))}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={() => {
                              if (selectedDispute) {
                                resolveMutation.mutate({
                                  disputeId: selectedDispute.id,
                                  status: 'resolved',
                                  resolution,
                                  refundAmount: refundAmount ? parseFloat(refundAmount) : null,
                                });
                              }
                            }}
                            disabled={!resolution || resolveMutation.isPending}
                          >
                            Resolve & Approve
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              if (selectedDispute) {
                                resolveMutation.mutate({
                                  disputeId: selectedDispute.id,
                                  status: 'rejected',
                                  resolution,
                                  refundAmount: null,
                                });
                              }
                            }}
                            disabled={!resolution || resolveMutation.isPending}
                          >
                            Reject Dispute
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="investigating" className="space-y-4">
          {investigatingDisputes.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No disputes under investigation
              </CardContent>
            </Card>
          ) : (
            investigatingDisputes.map((dispute) => (
              <Card key={dispute.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {dispute.dispute_type.replace('_', ' ').toUpperCase()}
                      </CardTitle>
                      <CardDescription>
                        {dispute.profiles.full_name} ({dispute.profiles.email})
                      </CardDescription>
                    </div>
                    {getStatusBadge(dispute.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{dispute.description}</p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="resolved" className="space-y-4">
          {resolvedDisputes.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No resolved disputes
              </CardContent>
            </Card>
          ) : (
            resolvedDisputes.map((dispute) => (
              <Card key={dispute.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {dispute.dispute_type.replace('_', ' ').toUpperCase()}
                      </CardTitle>
                      <CardDescription>
                        {dispute.profiles.full_name} ({dispute.profiles.email})
                      </CardDescription>
                    </div>
                    {getStatusBadge(dispute.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {dispute.resolution && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium mb-1">Resolution:</p>
                      <p className="text-sm text-muted-foreground">{dispute.resolution}</p>
                    </div>
                  )}
                  {dispute.refund_amount && (
                    <div className="text-sm">
                      <span className="font-medium">Refund Processed:</span>{' '}
                      {formatMoney(Number(dispute.refund_amount))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Disputes;
