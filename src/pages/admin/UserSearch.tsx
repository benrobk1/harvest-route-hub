import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Loader2, User, MapPin, Phone, Mail } from 'lucide-react';
import { UserRatingDisplay, adminQueries } from '@/features/admin';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface UserSearchResult {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  approval_status: string;
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
  collection_point_lead_farmer_id: string | null;
  applied_role: string | null;
  farm_size: string | null;
  produce_types: string | null;
  acquisition_channel: string | null;
  additional_info: string | null;
  delivery_schedule: string[] | null;
  lead_farmer_name?: string;
  lead_farmer_farm_name?: string;
  // Driver fields
  vehicle_type: string | null;
  vehicle_make: string | null;
  vehicle_year: string | null;
  license_number: string | null;
  delivery_days: string[] | null;
}

type UserProfileWithLeadFarmer = UserSearchResult & {
  lead_farmer?: {
    full_name: string | null;
    farm_name: string | null;
  } | null;
};

const UserSearch = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: adminQueries.userSearch(searchTerm, roleFilter, statusFilter),
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select(`
          *,
          lead_farmer:collection_point_lead_farmer_id(
            full_name,
            farm_name
          )
        `)
        .order('created_at', { ascending: false })
        .returns<UserProfileWithLeadFarmer[]>();

      // Apply search filter
      if (searchTerm) {
        query = query.or(
          `full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,farm_name.ilike.%${searchTerm}%`
        );
      }

      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('approval_status', statusFilter);
      }

      const { data: profiles, error } = await query;
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

      // Apply role filter
      let filteredUsers = usersWithRoles;
      if (roleFilter !== 'all') {
        filteredUsers = usersWithRoles.filter((user) =>
          user.roles.includes(roleFilter)
        );
      }

      // Filter out consumers in general search (they don't apply)
      return filteredUsers.filter(user => 
        user.roles.length === 0 || !user.roles.every(r => r === 'consumer')
      ) as UserSearchResult[];
    },
  });

  const getRoleBadge = (role: string) => {
    const roleMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
      farmer: { label: 'Farmer', variant: 'default' },
      lead_farmer: { label: 'Lead Farmer', variant: 'default' },
      driver: { label: 'Driver', variant: 'secondary' },
      admin: { label: 'Admin', variant: 'outline' },
    };
    const config = roleMap[role] || { label: role, variant: 'outline' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
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

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/dashboard')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        <div>
          <h1 className="text-3xl font-bold">User Search</h1>
          <p className="text-muted-foreground">Search and view farmer and driver profiles</p>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, phone, or farm..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="farmer">Farmer</SelectItem>
                <SelectItem value="lead_farmer">Lead Farmer</SelectItem>
                <SelectItem value="driver">Driver</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : users && users.length > 0 ? (
        <div className="grid gap-4">
          {users.map((user) => (
            <Card key={user.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <User className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <h3 className="font-semibold text-lg">{user.full_name}</h3>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {user.roles.map((role) => getRoleBadge(role))}
                      {getStatusBadge(user.approval_status)}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      {user.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{user.phone}</span>
                        </div>
                      )}

                      {/* Farmer info */}
                      {(user.applied_role === 'farmer' || user.applied_role === 'lead_farmer' || 
                        user.roles.some(r => r === 'farmer' || r === 'lead_farmer')) && (
                        <>
                          {user.farm_name && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Farm:</span>
                              <span className="font-medium">{user.farm_name}</span>
                            </div>
                          )}
                          {user.city && user.state && (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <span>{user.city}, {user.state}</span>
                            </div>
                          )}
                        </>
                      )}

                      {/* Driver info */}
                      {(user.applied_role === 'driver' || user.roles.includes('driver')) && (
                        <>
                          {user.vehicle_type && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Vehicle:</span>
                              <span>{user.vehicle_type}</span>
                            </div>
                          )}
                          {user.roles.includes('driver') && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Rating:</span>
                              <UserRatingDisplay driverId={user.id} />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" onClick={() => setSelectedUser(user)}>
                        View Details
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>{user.full_name}</DialogTitle>
                        <DialogDescription>Complete profile information</DialogDescription>
                      </DialogHeader>
                      
                      {selectedUser?.id === user.id && (
                        <div className="space-y-4">
                          {/* Contact Information */}
                          <div>
                            <h4 className="font-semibold mb-2">Contact Information</h4>
                            <div className="grid gap-2 text-sm">
                              <div><span className="text-muted-foreground">Email:</span> {user.email}</div>
                              {user.phone && <div><span className="text-muted-foreground">Phone:</span> {user.phone}</div>}
                            </div>
                          </div>

                          {/* Farmer-specific fields */}
                          {(user.applied_role === 'farmer' || user.applied_role === 'lead_farmer' || 
                            user.roles.some(r => r === 'farmer' || r === 'lead_farmer')) && (
                            <div>
                              <h4 className="font-semibold mb-2">Farm Information</h4>
                              <div className="grid gap-2 text-sm">
                                {user.farm_name && <div><span className="text-muted-foreground">Farm Name:</span> {user.farm_name}</div>}
                                {user.applied_role && <div><span className="text-muted-foreground">Applied Role:</span> {user.applied_role.replace('_', ' ')}</div>}
                                {user.farm_size && <div><span className="text-muted-foreground">Farm Size:</span> {user.farm_size}</div>}
                                {user.street_address && (
                                  <div>
                                    <span className="text-muted-foreground">Full Address:</span>
                                    <div className="mt-1">
                                      {user.street_address}<br />
                                      {user.city}, {user.state} {user.zip_code}<br />
                                      {user.country || 'USA'}
                                    </div>
                                  </div>
                                )}
                                {(user.applied_role === 'lead_farmer' || user.roles.includes('lead_farmer')) && user.collection_point_address && (
                                  <div><span className="text-muted-foreground">Collection Point:</span> {user.collection_point_address}</div>
                                )}
                                {(user.applied_role === 'lead_farmer' || user.roles.includes('lead_farmer')) && user.delivery_schedule && user.delivery_schedule.length > 0 && (
                                  <div><span className="text-muted-foreground">Delivery Schedule:</span> {user.delivery_schedule.join(', ')}</div>
                                )}
                                {user.applied_role === 'farmer' && user.collection_point_lead_farmer_id && user.lead_farmer_farm_name && user.lead_farmer_name && (
                                  <div><span className="text-muted-foreground">Lead Farmer Requested:</span> {user.lead_farmer_farm_name} ({user.lead_farmer_name})</div>
                                )}
                                {user.produce_types && (
                                  <div>
                                    <span className="text-muted-foreground">Produce Types:</span>
                                    <div className="mt-1 space-y-1">
                                      {(() => {
                                        try {
                                          const items = JSON.parse(user.produce_types);
                                          return items.map((item: string, idx: number) => (
                                            <div key={idx}>• {item}</div>
                                          ));
                                        } catch {
                                          return <div>{user.produce_types}</div>;
                                        }
                                      })()}
                                    </div>
                                  </div>
                                )}
                                {user.additional_info && <div><span className="text-muted-foreground">Additional Info:</span> {user.additional_info}</div>}
                              </div>
                            </div>
                          )}

                          {/* Driver-specific fields */}
                          {(user.applied_role === 'driver' || user.roles.includes('driver')) && (
                            <div>
                              <h4 className="font-semibold mb-2">Driver Information</h4>
                              <div className="grid gap-2 text-sm">
                                {user.vehicle_type && (
                                  <div>
                                    <span className="text-muted-foreground">Vehicle:</span>{' '}
                                    {[user.vehicle_type, user.vehicle_make, user.vehicle_year].filter(Boolean).join(' ')}
                                  </div>
                                )}
                                {user.license_number && <div><span className="text-muted-foreground">License #:</span> {user.license_number}</div>}
                                {user.zip_code && <div><span className="text-muted-foreground">ZIP Code:</span> {user.zip_code}</div>}
                                {user.delivery_days && user.delivery_days.length > 0 && (
                                  <div><span className="text-muted-foreground">Availability:</span> {user.delivery_days.join(', ')}</div>
                                )}
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">Rating:</span>
                                  <UserRatingDisplay driverId={user.id} />
                                </div>
                                {user.additional_info && <div><span className="text-muted-foreground">Additional Info:</span> {user.additional_info}</div>}
                              </div>
                            </div>
                          )}

                          {/* Application Details */}
                          <div>
                            <h4 className="font-semibold mb-2">Application Details</h4>
                            <div className="grid gap-2 text-sm">
                              <div><span className="text-muted-foreground">Status:</span> {getStatusBadge(user.approval_status)}</div>
                              {user.acquisition_channel && <div><span className="text-muted-foreground">Heard About Us:</span> {user.acquisition_channel}</div>}
                              <div><span className="text-muted-foreground">Applied:</span> {new Date(user.created_at).toLocaleDateString()}</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No users found matching your search criteria
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default UserSearch;
