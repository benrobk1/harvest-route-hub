import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { adminQueries } from '@/features/admin';
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
import { getErrorMessage } from '@/lib/errors/getErrorMessage';

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
  terms_accepted_at: string | null;
  privacy_accepted_at: string | null;
  // Farmer fields
  farm_name: string | null;
  street_address: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  collection_point_address: string | null;
  collection_point_lead_farmer_id: string | null;
  acquisition_channel: string | null;
  applied_role: 'farmer' | 'lead_farmer' | 'driver' | null;
  farm_size: string | null;
  produce_types: string | null;
  additional_info: string | null;
  lead_farmer_name?: string;
  lead_farmer_farm_name?: string;
  // Driver fields
  vehicle_type: string | null;
  vehicle_make: string | null;
  vehicle_year: string | null;
  license_number: string | null;
  delivery_days: string[] | null;
}

type ProfileWithLeadFarmer = UserProfile & {
  lead_farmer?: {
    full_name: string | null;
    farm_name: string | null;
  } | null;
};


const UserApprovals = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [bulkRejectionReason, setBulkRejectionReason] = useState('');
  const [showBulkRejectDialog, setShowBulkRejectDialog] = useState(false);

  // Helper to extract storage path from URL or path string
  const toStoragePath = (val: string | null): string | null => {
    if (!val) return null;
    if (val.includes('/documents/')) {
      const parts = val.split('/documents/');
      return parts[1] || null;
    }
    return val;
  };

  // Helper to create signed URL and open in new window
  const createSignedUrl = async (path: string | null) => {
    if (!path) return;
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(path, 60);
      
      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error: unknown) {
      toast({
        title: 'Error viewing document',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const { data: pendingUsers, isLoading } = useQuery({
    queryKey: adminQueries.pendingUsers(),
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select(`
          *,
          lead_farmer:collection_point_lead_farmer_id(
            full_name,
            farm_name
          )
        `)
        .in('approval_status', ['pending', 'rejected'])
        .order('created_at', { ascending: false })
        .returns<ProfileWithLeadFarmer[]>();

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
            lead_farmer_name: profile.lead_farmer?.full_name || undefined,
            lead_farmer_farm_name: profile.lead_farmer?.farm_name || undefined,
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

      // Validate and assign role based on applied_role
      const appliedRole = profileData?.applied_role as 'farmer' | 'lead_farmer' | 'driver' | null;
      if (!appliedRole) {
        throw new Error('User has no applied role specified. Cannot approve.');
      }

      // Validate it's a valid role
      const validRoles: Array<'farmer' | 'lead_farmer' | 'driver'> = ['farmer', 'lead_farmer', 'driver'];
      if (!validRoles.includes(appliedRole)) {
        throw new Error(`Invalid applied role: ${appliedRole}`);
      }

      // Check if role already exists to prevent duplicates
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', appliedRole)
        .maybeSingle();

      if (!existingRole) {
        const { error: roleAssignError } = await supabase
          .from('user_roles')
          .insert([{ user_id: userId, role: appliedRole }]);
        if (roleAssignError) throw roleAssignError;
      }

      // Ensure a farm profile exists for farmers/lead_farmers only
      if (appliedRole === 'farmer' || appliedRole === 'lead_farmer') {
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
      }
    },
    onSuccess: () => {
      toast({
        title: 'User approved',
        description: 'The user has been approved successfully',
      });
      queryClient.invalidateQueries({ queryKey: adminQueries.pendingUsers() });
      queryClient.invalidateQueries({ queryKey: adminQueries.metrics() });
      setSelectedUser(null);
    },
    onError: (error: unknown) => {
      toast({
        title: 'Approval failed',
        description: getErrorMessage(error),
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
      queryClient.invalidateQueries({ queryKey: adminQueries.pendingUsers() });
      queryClient.invalidateQueries({ queryKey: adminQueries.metrics() });
      setSelectedUser(null);
      setRejectionReason('');
    },
    onError: (error: unknown) => {
      toast({
        title: 'Rejection failed',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Approve all selected users
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          approval_status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user.id,
          rejected_reason: null,
        })
        .in('id', userIds);

      if (updateError) throw updateError;

      // Process each user for role assignment and farm profile
      for (const userId of userIds) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('applied_role, farm_name, additional_info, city, state')
          .eq('id', userId)
          .single();

        if (profileData) {
          const appliedRole = profileData?.applied_role as 'farmer' | 'lead_farmer' | 'driver' | null;
          
          // Validate role exists
          if (!appliedRole) {
            console.error(`User ${userId} has no applied role, skipping role assignment`);
            continue;
          }

          // Validate it's a valid role
          const validRoles: Array<'farmer' | 'lead_farmer' | 'driver'> = ['farmer', 'lead_farmer', 'driver'];
          if (!validRoles.includes(appliedRole)) {
            console.error(`User ${userId} has invalid applied role: ${appliedRole}, skipping`);
            continue;
          }

          // Check if role already exists to prevent duplicates
          const { data: existingRole } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', userId)
            .eq('role', appliedRole)
            .maybeSingle();

          if (!existingRole) {
            await supabase
              .from('user_roles')
              .insert([{ user_id: userId, role: appliedRole }]);
          }

          // Create farm profile if it's a farmer/lead_farmer
          if (appliedRole === 'farmer' || appliedRole === 'lead_farmer') {
            const { data: existingFarm } = await supabase
              .from('farm_profiles')
              .select('id')
              .eq('farmer_id', userId)
              .maybeSingle();

            if (!existingFarm) {
              await supabase
                .from('farm_profiles')
                .insert({
                  farmer_id: userId,
                  farm_name: profileData?.farm_name || 'Untitled Farm',
                  description: profileData?.additional_info || null,
                  location: [profileData?.city, profileData?.state].filter(Boolean).join(', ') || null,
                });
            }
          }
        }

        // Log approval history
        await supabase
          .from('approval_history')
          .insert({
            user_id: userId,
            previous_status: 'pending',
            new_status: 'approved',
            approved_by: user.id,
          });

        // Log admin action
        await supabase.rpc('log_admin_action', {
          _action_type: 'bulk_user_approved',
          _target_user_id: userId,
          _old_value: { status: 'pending' },
          _new_value: { status: 'approved' },
        });
      }
    },
    onSuccess: (_, userIds) => {
      toast({
        title: 'Users approved',
        description: `${userIds.length} user(s) have been approved successfully`,
      });
      queryClient.invalidateQueries({ queryKey: adminQueries.pendingUsers() });
      queryClient.invalidateQueries({ queryKey: adminQueries.metrics() });
      setSelectedUserIds(new Set());
    },
    onError: (error: unknown) => {
      toast({
        title: 'Bulk approval failed',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const bulkRejectMutation = useMutation({
    mutationFn: async ({ userIds, reason }: { userIds: string[]; reason: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Reject all selected users
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          approval_status: 'rejected',
          rejected_reason: reason,
          approved_by: user.id,
        })
        .in('id', userIds);

      if (updateError) throw updateError;

      // Log for each user
      for (const userId of userIds) {
        await supabase
          .from('approval_history')
          .insert({
            user_id: userId,
            previous_status: 'pending',
            new_status: 'rejected',
            reason,
            approved_by: user.id,
          });

        await supabase.rpc('log_admin_action', {
          _action_type: 'bulk_user_rejected',
          _target_user_id: userId,
          _old_value: { status: 'pending' },
          _new_value: { status: 'rejected', reason },
        });
      }
    },
    onSuccess: (_, { userIds }) => {
      toast({
        title: 'Users rejected',
        description: `${userIds.length} user(s) have been rejected`,
      });
      queryClient.invalidateQueries({ queryKey: adminQueries.pendingUsers() });
      queryClient.invalidateQueries({ queryKey: adminQueries.metrics() });
      setSelectedUserIds(new Set());
      setBulkRejectionReason('');
      setShowBulkRejectDialog(false);
    },
    onError: (error: unknown) => {
      toast({
        title: 'Bulk rejection failed',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const toggleUserSelection = (userId: string) => {
    const newSet = new Set(selectedUserIds);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedUserIds(newSet);
  };

  const toggleSelectAll = (users: UserProfile[]) => {
    if (selectedUserIds.size === users.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(users.map(u => u.id)));
    }
  };

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
            <>
              {/* Bulk Actions Bar */}
              <Card className="bg-muted/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedUserIds.size === pendingList.length && pendingList.length > 0}
                          onCheckedChange={() => toggleSelectAll(pendingList)}
                        />
                        <span className="text-sm font-medium">
                          {selectedUserIds.size > 0 
                            ? `${selectedUserIds.size} selected` 
                            : 'Select all'}
                        </span>
                      </div>
                    </div>
                    {selectedUserIds.size > 0 && (
                      <div className="flex gap-2">
                        <Button
                          onClick={() => bulkApproveMutation.mutate(Array.from(selectedUserIds))}
                          disabled={bulkApproveMutation.isPending}
                          size="sm"
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Approve Selected ({selectedUserIds.size})
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => setShowBulkRejectDialog(true)}
                          disabled={bulkRejectMutation.isPending}
                          size="sm"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Reject Selected ({selectedUserIds.size})
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Bulk Reject Dialog */}
              <Dialog open={showBulkRejectDialog} onOpenChange={setShowBulkRejectDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Reject Multiple Applications</DialogTitle>
                    <DialogDescription>
                      Please provide a reason for rejecting {selectedUserIds.size} application(s)
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="bulkReason">Reason</Label>
                      <Textarea
                        id="bulkReason"
                        value={bulkRejectionReason}
                        onChange={(e) => setBulkRejectionReason(e.target.value)}
                        placeholder="Explain why these applications are being rejected..."
                        rows={4}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          bulkRejectMutation.mutate({
                            userIds: Array.from(selectedUserIds),
                            reason: bulkRejectionReason,
                          });
                        }}
                        disabled={!bulkRejectionReason || bulkRejectMutation.isPending}
                        variant="destructive"
                      >
                        Confirm Rejection
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowBulkRejectDialog(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {pendingList.map((user) => (
              <Card key={user.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedUserIds.has(user.id)}
                        onCheckedChange={() => toggleUserSelection(user.id)}
                        className="mt-1"
                      />
                      <div>
                        <CardTitle>{user.full_name}</CardTitle>
                        <CardDescription>{user.email}</CardDescription>
                      </div>
                    </div>
                    {getStatusBadge(user.approval_status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Contact Information */}
                  <div>
                    <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">Contact Information</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Phone:</span> {user.phone || 'N/A'}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Applied:</span>{' '}
                        {new Date(user.created_at).toLocaleDateString()}
                      </div>
                      {user.acquisition_channel && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">How They Heard About Us:</span> {user.acquisition_channel}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Role & Application */}
                  <div>
                    <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">Role & Application</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Applied Role:</span> {user.applied_role?.replace('_', ' ') || user.roles.map(r => r.replace('_', ' ')).join(', ') || 'N/A'}
                      </div>
                      {user.terms_accepted_at && (
                        <div>
                          <span className="text-muted-foreground">Terms Accepted:</span>{' '}
                          {new Date(user.terms_accepted_at).toLocaleDateString()}
                        </div>
                      )}
                      {user.privacy_accepted_at && (
                        <div>
                          <span className="text-muted-foreground">Privacy Accepted:</span>{' '}
                          {new Date(user.privacy_accepted_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                    
                  {/* Farmer-specific fields - Use applied_role for pending applicants */}
                  {(() => {
                    const isFarmerApplicant = user.applied_role === 'farmer' || 
                      user.applied_role === 'lead_farmer' || 
                      user.roles.includes('farmer') || 
                      user.roles.includes('lead_farmer');
                    return isFarmerApplicant;
                  })() && (
                    <>
                      {/* Farm Details */}
                      <div>
                        <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">Farm Details</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Farm Name:</span> {user.farm_name || 'N/A'}
                          </div>
                          {user.farm_size && (
                            <div>
                              <span className="text-muted-foreground">Farm Size:</span> {user.farm_size}
                            </div>
                          )}
                          {user.produce_types && (
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Produce Types:</span> 
                              <div className="mt-1 space-y-1">
                                {(() => {
                                  try {
                                    const items = JSON.parse(user.produce_types);
                                    return items.map((item: string, idx: number) => (
                                      <div key={idx} className="text-sm">
                                        • {item}
                                      </div>
                                    ));
                                  } catch {
                                    return <div className="text-sm">{user.produce_types}</div>;
                                  }
                                })()}
                              </div>
                            </div>
                          )}
                          {user.street_address && (
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Full Farm Address:</span>
                              <div className="text-sm mt-1">
                                {user.street_address}<br />
                                {user.city}, {user.state} {user.zip_code}<br />
                                {user.country || 'USA'}
                              </div>
                            </div>
                          )}
                          {user.additional_info && (
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Additional Information:</span>
                              <div className="text-sm mt-1 whitespace-pre-wrap">{user.additional_info}</div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Lead Farmer Specific */}
                      {(user.applied_role === 'lead_farmer' || user.roles.includes('lead_farmer')) && (
                        <div>
                          <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">Collection Point Details</h3>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            {user.collection_point_address && (
                              <div className="col-span-2">
                                <span className="text-muted-foreground">Collection Point Address:</span> {user.collection_point_address}
                              </div>
                            )}
                            {user.delivery_days && user.delivery_days.length > 0 && (
                              <div className="col-span-2">
                                <span className="text-muted-foreground">Delivery Schedule:</span> {user.delivery_days.join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Regular Farmer Specific */}
                      {user.applied_role === 'farmer' && user.collection_point_lead_farmer_id && (
                        <div>
                          <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">Drop-off Details</h3>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Lead Farmer / Drop-off Point:</span>{' '}
                              {user.lead_farmer_farm_name && user.lead_farmer_name 
                                ? `${user.lead_farmer_farm_name} (${user.lead_farmer_name})`
                                : user.collection_point_lead_farmer_id}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                    
                  {/* Driver-specific fields - Use applied_role for pending applicants */}
                  {(user.applied_role === 'driver' || user.roles.includes('driver')) && (
                    <>
                      <div>
                        <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">Driver Details</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">License #:</span> {user.license_number || 'N/A'}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Vehicle Type:</span> {user.vehicle_type || 'N/A'}
                          </div>
                          {user.vehicle_make && (
                            <div>
                              <span className="text-muted-foreground">Vehicle Make/Model:</span> {user.vehicle_make}
                            </div>
                          )}
                          {user.vehicle_year && (
                            <div>
                              <span className="text-muted-foreground">Vehicle Year:</span> {user.vehicle_year}
                            </div>
                          )}
                          {user.delivery_days && user.delivery_days.length > 0 && (
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Availability:</span> {user.delivery_days.join(', ')}
                            </div>
                          )}
                          {user.street_address && (
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Full Address:</span>
                              <div className="text-sm mt-1">
                                {user.street_address}
                                {user.address_line_2 && <><br />{user.address_line_2}</>}
                                <br />
                                {user.city}, {user.state} {user.zip_code}
                              </div>
                            </div>
                          )}
                          {user.additional_info && (
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Additional Information:</span>
                              <div className="text-sm mt-1 whitespace-pre-wrap">{user.additional_info}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Documents */}
                  <div>
                    <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">Documents</h3>
                    <div className="space-y-2">
                      {user.driver_license_url && (
                        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <span className="text-sm font-medium">Driver's License</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => createSignedUrl(toStoragePath(user.driver_license_url))}
                            className="text-primary hover:underline text-sm flex items-center gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            View
                          </Button>
                        </div>
                      )}
                      {user.insurance_url && (
                        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <span className="text-sm font-medium">Insurance</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => createSignedUrl(toStoragePath(user.insurance_url))}
                            className="text-primary hover:underline text-sm flex items-center gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            View
                          </Button>
                        </div>
                      )}
                      {user.coi_url && (
                        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <span className="text-sm font-medium">Certificate of Insurance (COI)</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => createSignedUrl(toStoragePath(user.coi_url))}
                            className="text-primary hover:underline text-sm flex items-center gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            View
                          </Button>
                        </div>
                      )}
                      {!user.driver_license_url && !user.insurance_url && !user.coi_url && (
                        <span className="text-sm text-muted-foreground">No documents uploaded</span>
                      )}
                    </div>
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
            ))}
          </>
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
                <CardContent className="space-y-6">
                  <div className="p-3 bg-destructive/10 rounded-lg">
                    <p className="text-sm font-medium mb-1">Rejection Reason:</p>
                    <p className="text-sm text-muted-foreground">{user.rejected_reason}</p>
                  </div>

                  {/* Contact Information */}
                  <div>
                    <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">Contact Information</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Phone:</span> {user.phone || 'N/A'}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Applied:</span>{' '}
                        {new Date(user.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {/* Role & Application */}
                  <div>
                    <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">Role & Application</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Applied Role:</span> {user.applied_role?.replace('_', ' ') || user.roles.map(r => r.replace('_', ' ')).join(', ') || 'N/A'}
                      </div>
                    </div>
                  </div>

                  {/* Farmer-specific fields */}
                  {(user.roles.includes('farmer') || user.roles.includes('lead_farmer')) && (
                    <>
                      {/* Farm Details */}
                      <div>
                        <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">Farm Details</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Farm Name:</span> {user.farm_name || 'N/A'}
                          </div>
                          {user.farm_size && (
                            <div>
                              <span className="text-muted-foreground">Farm Size:</span> {user.farm_size}
                            </div>
                          )}
                          {user.street_address && (
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Full Farm Address:</span>
                              <div className="text-sm mt-1">
                                {user.street_address}<br />
                                {user.city}, {user.state} {user.zip_code}<br />
                                {user.country || 'USA'}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Regular Farmer Specific */}
                      {user.applied_role === 'farmer' && user.collection_point_lead_farmer_id && (
                        <div>
                          <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">Drop-off Details</h3>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Lead Farmer / Drop-off Point:</span>{' '}
                              {user.lead_farmer_farm_name && user.lead_farmer_name 
                                ? `${user.lead_farmer_farm_name} (${user.lead_farmer_name})`
                                : user.collection_point_lead_farmer_id}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Driver-specific fields */}
                  {(user.applied_role === 'driver' || user.roles.includes('driver')) && (
                    <div>
                      <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">Driver Details</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">License #:</span> {user.license_number || 'N/A'}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Vehicle Type:</span> {user.vehicle_type || 'N/A'}
                        </div>
                        {user.vehicle_make && (
                          <div>
                            <span className="text-muted-foreground">Vehicle Make/Model:</span> {user.vehicle_make}
                          </div>
                        )}
                        {user.vehicle_year && (
                          <div>
                            <span className="text-muted-foreground">Vehicle Year:</span> {user.vehicle_year}
                          </div>
                        )}
                        {user.delivery_days && user.delivery_days.length > 0 && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Availability:</span> {user.delivery_days.join(', ')}
                          </div>
                        )}
                        {user.street_address && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Full Address:</span>
                            <div className="text-sm mt-1">
                              {user.street_address}
                              {user.address_line_2 && <><br />{user.address_line_2}</>}
                              <br />
                              {user.city}, {user.state} {user.zip_code}
                            </div>
                          </div>
                        )}
                        {user.additional_info && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Additional Information:</span>
                            <div className="text-sm mt-1 whitespace-pre-wrap">{user.additional_info}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

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
