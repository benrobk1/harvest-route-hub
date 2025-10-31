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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, XCircle, FileText, Eye, Loader2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  approval_status: string;
  driver_license_url: string | null;
  insurance_url: string | null;
  coi_url: string | null;
  rejected_reason: string | null;
  created_at: string;
  roles: string[];
  // Farmer fields
  farm_name: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  collection_point_address: string | null;
  acquisition_channel: string | null;
  applied_role: 'farmer' | 'lead_farmer' | null;
  farm_size: string | null;
  produce_types: string | null;
  additional_info: string | null;
  // Driver fields
  vehicle_type: string | null;
  vehicle_make: string | null;
  vehicle_year: string | null;
  license_number: string | null;
}


const UserApprovals = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const { data: pendingUsers, isLoading } = useQuery({
    queryKey: ['pending-users'],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .in('approval_status', ['pending', 'rejected'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch roles for each user
      const usersWithRoles = await Promise.all(
        profiles.map(async (profile) => {
          const { data: roles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', profile.id);

          return {
            ...profile,
            roles: roles?.map((r) => r.role) || [],
          };
        })
      );

      // Filter out consumers (they are auto-approved)
      return usersWithRoles.filter(user => 
        !user.roles.includes('consumer')
      ) as UserProfile[];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          approval_status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user.id,
          rejected_reason: null,
        })
        .eq('id', userId);

      if (updateError) throw updateError;

      // Log approval history
      const { error: historyError } = await supabase
        .from('approval_history')
        .insert({
          user_id: userId,
          previous_status: selectedUser?.approval_status || 'pending',
          new_status: 'approved',
          approved_by: user.id,
        });

      if (historyError) console.error('Failed to log history:', historyError);
      
      // Log admin action
      await supabase.rpc('log_admin_action', {
        _action_type: 'user_approved',
        _target_user_id: userId,
        _old_value: { status: selectedUser?.approval_status },
        _new_value: { status: 'approved' },
      });

      // Fetch profile to determine applied role and farm info
      const { data: profileData, error: profileFetchError } = await supabase
        .from('profiles')
        .select('applied_role, farm_name, additional_info, city, state')
        .eq('id', userId)
        .single();
      if (profileFetchError) throw profileFetchError;

      // Assign role based on applied_role (default to 'farmer')
      const appliedRole = (profileData?.applied_role as 'farmer' | 'lead_farmer') ?? 'farmer';
      const { error: roleAssignError } = await supabase
        .from('user_roles')
        .upsert({ user_id: userId, role: appliedRole }, { onConflict: 'user_id,role' });
      if (roleAssignError) throw roleAssignError;

      // Ensure a farm profile exists for dropdowns
      const { data: existingFarm, error: farmCheckError } = await supabase
        .from('farm_profiles')
        .select('id')
        .eq('farmer_id', userId)
        .maybeSingle();
      if (farmCheckError) throw farmCheckError;

      if (!existingFarm) {
        const { error: farmInsertError } = await supabase
          .from('farm_profiles')
          .insert({
            farmer_id: userId,
            farm_name: profileData?.farm_name || 'Untitled Farm',
            description: profileData?.additional_info || null,
            location: [profileData?.city, profileData?.state].filter(Boolean).join(', ') || null,
          });
        if (farmInsertError) throw farmInsertError;
      }
    },
    onSuccess: () => {
      toast({
        title: 'User approved',
        description: 'The user has been approved successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['pending-users'] });
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Approval failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          approval_status: 'rejected',
          rejected_reason: reason,
          approved_by: user.id,
        })
        .eq('id', userId);

      if (updateError) throw updateError;

      // Log approval history
      const { error: historyError } = await supabase
        .from('approval_history')
        .insert({
          user_id: userId,
          previous_status: selectedUser?.approval_status || 'pending',
          new_status: 'rejected',
          reason,
          approved_by: user.id,
        });

      if (historyError) console.error('Failed to log history:', historyError);
      
      // Log admin action
      await supabase.rpc('log_admin_action', {
        _action_type: 'user_rejected',
        _target_user_id: userId,
        _old_value: { status: selectedUser?.approval_status },
        _new_value: { status: 'rejected', reason },
      });
    },
    onSuccess: () => {
      toast({
        title: 'User rejected',
        description: 'The user has been rejected',
      });
      queryClient.invalidateQueries({ queryKey: ['pending-users'] });
      setSelectedUser(null);
      setRejectionReason('');
    },
    onError: (error: any) => {
      toast({
        title: 'Rejection failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const pendingList = pendingUsers?.filter(u => u.approval_status === 'pending') || [];
  const rejectedList = pendingUsers?.filter(u => u.approval_status === 'rejected') || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
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
          <h1 className="text-3xl font-bold">User Approvals</h1>
          <p className="text-muted-foreground">Review and approve farmer and driver applications</p>
        </div>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            Pending ({pendingList.length})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected ({rejectedList.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingList.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No pending approvals
              </CardContent>
            </Card>
          ) : (
            pendingList.map((user) => (
              <Card key={user.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{user.full_name}</CardTitle>
                      <CardDescription>{user.email}</CardDescription>
                    </div>
                    {getStatusBadge(user.approval_status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Phone:</span> {user.phone || 'N/A'}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Roles:</span>{' '}
                      {user.roles.map(r => r.replace('_', ' ')).join(', ') || 'N/A'}
                    </div>
                    
                    {/* Farmer-specific fields */}
                    {(user.roles.includes('farmer') || user.roles.includes('lead_farmer')) && (
                      <>
                        <div>
                          <span className="text-muted-foreground">Farm Name:</span> {user.farm_name || 'N/A'}
                        </div>
                        {user.street_address && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Farm Address:</span> {user.street_address}
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground">City/State/ZIP:</span> {[user.city, user.state, user.zip_code].filter(Boolean).join(', ') || 'N/A'}
                        </div>
                        {user.roles.includes('lead_farmer') && user.collection_point_address && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Collection Point:</span> {user.collection_point_address}
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground">Applied Role:</span> {user.applied_role?.replace('_', ' ') || 'farmer'}
                        </div>
                        {user.farm_size && (
                          <div>
                            <span className="text-muted-foreground">Farm Size:</span> {user.farm_size}
                          </div>
                        )}
                        {user.produce_types && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Produce Types:</span> {user.produce_types}
                          </div>
                        )}
                        {user.additional_info && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Additional Info:</span> {user.additional_info}
                          </div>
                        )}
                        {user.acquisition_channel && (
                          <div>
                            <span className="text-muted-foreground">Heard About Us:</span> {user.acquisition_channel}
                          </div>
                        )}
                      </>
                    )}
                    
                    {/* Driver-specific fields */}
                    {user.roles.includes('driver') && (
                      <>
                        <div>
                          <span className="text-muted-foreground">Vehicle:</span>{' '}
                          {[user.vehicle_type, user.vehicle_make, user.vehicle_year].filter(Boolean).join(' ') || 'N/A'}
                        </div>
                        <div>
                          <span className="text-muted-foreground">License #:</span> {user.license_number || 'N/A'}
                        </div>
                        <div>
                          <span className="text-muted-foreground">ZIP Code:</span> {user.zip_code || 'N/A'}
                        </div>
                      </>
                    )}
                    
                    <div>
                      <span className="text-muted-foreground">Applied:</span>{' '}
                      {new Date(user.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {user.driver_license_url && (
                      <a
                        href={user.driver_license_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        <FileText className="h-4 w-4" />
                        Driver License
                      </a>
                    )}
                    {user.insurance_url && (
                      <a
                        href={user.insurance_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        <FileText className="h-4 w-4" />
                        Insurance
                      </a>
                    )}
                    {user.coi_url && (
                      <a
                        href={user.coi_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        <FileText className="h-4 w-4" />
                        COI
                      </a>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => approveMutation.mutate(user.id)}
                      disabled={approveMutation.isPending}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Approve
                    </Button>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="destructive"
                          onClick={() => setSelectedUser(user)}
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Reject
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Reject Application</DialogTitle>
                          <DialogDescription>
                            Please provide a reason for rejecting this application
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="reason">Reason</Label>
                            <Textarea
                              id="reason"
                              value={rejectionReason}
                              onChange={(e) => setRejectionReason(e.target.value)}
                              placeholder="Explain why this application is being rejected..."
                              rows={4}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => {
                                if (selectedUser) {
                                  rejectMutation.mutate({
                                    userId: selectedUser.id,
                                    reason: rejectionReason,
                                  });
                                }
                              }}
                              disabled={!rejectionReason || rejectMutation.isPending}
                              variant="destructive"
                            >
                              Confirm Rejection
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="rejected" className="space-y-4">
          {rejectedList.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No rejected applications
              </CardContent>
            </Card>
          ) : (
            rejectedList.map((user) => (
              <Card key={user.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{user.full_name}</CardTitle>
                      <CardDescription>{user.email}</CardDescription>
                    </div>
                    {getStatusBadge(user.approval_status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 bg-destructive/10 rounded-lg">
                    <p className="text-sm font-medium mb-1">Rejection Reason:</p>
                    <p className="text-sm text-muted-foreground">{user.rejected_reason}</p>
                  </div>
                  <Button
                    onClick={() => approveMutation.mutate(user.id)}
                    disabled={approveMutation.isPending}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Approve Now
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UserApprovals;
