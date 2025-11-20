import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Shield, UserPlus, UserMinus, Loader2 } from "lucide-react";
import { adminQueries } from "@/features/admin";
import { Database } from "@/integrations/supabase/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type AdminProfile = {
  full_name: string;
  isInvitation: boolean;
  email?: string | null;
  id?: string;
};

type AdminWithProfile = Database["public"]["Tables"]["user_roles"]["Row"] & {
  profiles: Pick<Database["public"]["Tables"]["profiles"]["Row"], "full_name" | "email"> | null;
};

export const AdminRoleManager = () => {
  const [email, setEmail] = useState("");
  const [userToRevoke, setUserToRevoke] = useState<{ id: string; name: string } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: admins, isLoading } = useQuery<AdminWithProfile[]>({
    queryKey: adminQueries.admins(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('id, user_id, profiles(full_name, email)')
        .eq('role', 'admin');

      if (error) throw error;
      return data || [];
    },
  });

  const assignAdmin = useMutation({
    mutationFn: async (userEmail: string): Promise<AdminProfile> => {
      // Find user by email
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('email', userEmail)
        .maybeSingle();

      if (profileError) throw profileError;

      // If user doesn't exist, send invitation instead
      if (!profile) {
        const { data, error } = await supabase.functions.invoke('invite-admin', {
          body: { email: userEmail },
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        return { full_name: userEmail, isInvitation: true };
      }

      // User exists - check if already admin
      const { data: existing } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', profile.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (existing) throw new Error('User is already an admin');

      // Assign admin role
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: profile.id, role: 'admin' });

      if (error) throw error;
      
      // Log admin action
      await supabase.rpc('log_admin_action', {
        _action_type: 'role_granted',
        _target_user_id: profile.id,
        _new_value: { role: 'admin' },
      });

      return { ...profile, isInvitation: false };
    },
    onSuccess: (profile: AdminProfile) => {
      if (profile.isInvitation) {
        toast({
          title: 'Invitation sent',
          description: `An invitation email has been sent to ${profile.full_name}`,
        });
      } else {
        toast({
          title: 'Admin role assigned',
          description: `${profile.full_name} is now an administrator`,
        });
      }
      queryClient.invalidateQueries({ queryKey: adminQueries.admins() });
      setEmail("");
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to assign admin role',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const revokeAdmin = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', 'admin');

      if (error) throw error;
      
      // Log admin action
      await supabase.rpc('log_admin_action', {
        _action_type: 'role_revoked',
        _target_user_id: userId,
        _old_value: { role: 'admin' },
      });
    },
    onSuccess: () => {
      toast({
        title: 'Admin role revoked',
        description: 'User is no longer an administrator',
      });
      queryClient.invalidateQueries({ queryKey: adminQueries.admins() });
      setUserToRevoke(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to revoke admin role',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Admin Role Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Assign New Admin */}
          <div className="space-y-3">
            <h3 className="font-semibold">Assign New Admin</h3>
            <div className="flex gap-2">
              <Input
                placeholder="Enter user email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
              />
              <Button
                onClick={() => assignAdmin.mutate(email)}
                disabled={!email || assignAdmin.isPending}
              >
                {assignAdmin.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Assign
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Current Admins */}
          <div className="space-y-3">
            <h3 className="font-semibold">Current Administrators</h3>
            {isLoading ? (
              <div className="flex justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : admins && admins.length > 0 ? (
              <div className="space-y-2">
                {admins.map((admin) => (
                  <div
                    key={admin.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{admin.profiles?.full_name || 'Unknown'}</p>
                      <p className="text-sm text-muted-foreground">{admin.profiles?.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="default">Admin</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setUserToRevoke({
                            id: admin.user_id,
                            name: admin.profiles?.full_name || admin.profiles?.email || 'User',
                          })
                        }
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No administrators found
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Revoke Confirmation Dialog */}
      <AlertDialog open={!!userToRevoke} onOpenChange={() => setUserToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Admin Access?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke admin privileges from {userToRevoke?.name}? They will
              no longer have access to the admin portal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => userToRevoke && revokeAdmin.mutate(userToRevoke.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
