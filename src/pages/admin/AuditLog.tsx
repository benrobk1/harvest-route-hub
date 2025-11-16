import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";
import { Eye, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { adminQueries } from "@/features/admin";

interface AuditLogEntry {
  id: string;
  admin_id: string;
  action_type: string;
  target_user_id: string | null;
  target_resource_type: string | null;
  target_resource_id: string | null;
  old_value: any;
  new_value: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  admin_email?: string;
  admin_name?: string;
  target_email?: string;
  target_name?: string;
}

const AuditLog = () => {
  const navigate = useNavigate();
  const { data: logs, isLoading } = useQuery({
    queryKey: adminQueries.auditLogs(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      
      // Fetch admin and target user profiles separately
      const enrichedLogs = await Promise.all(
        (data || []).map(async (log) => {
          const { data: adminProfile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', log.admin_id)
            .maybeSingle();
          
          let targetProfile = null;
          if (log.target_user_id) {
            const { data } = await supabase
              .from('profiles')
              .select('full_name, email')
              .eq('id', log.target_user_id)
              .maybeSingle();
            targetProfile = data;
          }
          
          return {
            ...log,
            admin_name: adminProfile?.full_name || 'Unknown',
            admin_email: adminProfile?.email || 'Unknown',
            target_name: targetProfile?.full_name,
            target_email: targetProfile?.email,
          } as AuditLogEntry;
        })
      );
      
      return enrichedLogs;
    },
  });

  const getActionBadgeVariant = (actionType: string) => {
    if (actionType.includes('approved') || actionType.includes('granted')) return 'default';
    if (actionType.includes('rejected') || actionType.includes('revoked')) return 'destructive';
    if (actionType.includes('resolved')) return 'secondary';
    return 'outline';
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading audit log...</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/dashboard')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Admin Audit Log</CardTitle>
          <CardDescription>
            Last 100 administrative actions • Compliance tracking
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs?.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="font-medium">
                    {log.admin_name}
                    <div className="text-xs text-muted-foreground">{log.admin_email}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getActionBadgeVariant(log.action_type)}>
                      {log.action_type.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {log.target_name ? (
                      <>
                        {log.target_name}
                        <div className="text-xs text-muted-foreground">{log.target_email}</div>
                      </>
                    ) : log.target_resource_type ? (
                      <span className="text-sm">{log.target_resource_type}</span>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Audit Log Details</DialogTitle>
                          <DialogDescription>
                            {log.action_type.replace(/_/g, ' ')} • {new Date(log.created_at).toLocaleString()}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          {log.old_value && (
                            <div>
                              <h4 className="font-semibold text-sm mb-2">Previous Value:</h4>
                              <pre className="bg-muted p-3 rounded text-xs overflow-auto">
                                {JSON.stringify(log.old_value, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.new_value && (
                            <div>
                              <h4 className="font-semibold text-sm mb-2">New Value:</h4>
                              <pre className="bg-muted p-3 rounded text-xs overflow-auto">
                                {JSON.stringify(log.new_value, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.ip_address && (
                            <div className="text-sm">
                              <span className="font-semibold">IP Address:</span> {log.ip_address}
                            </div>
                          )}
                          {log.user_agent && (
                            <div className="text-sm">
                              <span className="font-semibold">User Agent:</span> {log.user_agent}
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditLog;
