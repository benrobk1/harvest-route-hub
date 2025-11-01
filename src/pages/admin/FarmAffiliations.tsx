import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Loader2, XCircle, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function FarmAffiliations() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedLeadFarmer, setSelectedLeadFarmer] = useState("");
  const [selectedFarm, setSelectedFarm] = useState("");
  const [commissionRate, setCommissionRate] = useState("2.0");
  const [isAssigning, setIsAssigning] = useState(false);

  const { data: leadFarmers } = useQuery({
    queryKey: ["lead-farmers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, farm_name")
        .in("id", 
          (await supabase.from("user_roles").select("user_id").eq("role", "lead_farmer")).data?.map(r => r.user_id) || []
        );
      if (error) throw error;
      return data;
    },
  });

  const { data: farms } = useQuery({
    queryKey: ["farm-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("farm_profiles")
        .select("id, farm_name, farmer_id, profiles!inner(full_name)");
      if (error) throw error;
      return data;
    },
  });

  const { data: affiliations } = useQuery({
    queryKey: ["farm-affiliations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("farm_affiliations")
        .select(`
          id,
          commission_rate,
          active,
          created_at,
          lead_farmer:profiles!farm_affiliations_lead_farmer_id_fkey(full_name, farm_name),
          farm:farm_profiles!inner(farm_name, farmer_id, profiles!inner(full_name))
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const toggleAffiliation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("farm_affiliations")
        .update({ active: !active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farm-affiliations"] });
      toast.success("Affiliation status updated");
    },
  });

  const handleAssign = async () => {
    if (!selectedLeadFarmer || !selectedFarm) {
      toast.error("Please select both lead farmer and farm");
      return;
    }

    const rate = parseFloat(commissionRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast.error("Commission rate must be between 0 and 100");
      return;
    }

    setIsAssigning(true);
    try {
      const { error } = await supabase.from("farm_affiliations").insert({
        lead_farmer_id: selectedLeadFarmer,
        farm_profile_id: selectedFarm,
        commission_rate: rate,
      });

      if (error) throw error;

      toast.success("Farm assigned successfully");
      setSelectedLeadFarmer("");
      setSelectedFarm("");
      setCommissionRate("2.0");
      queryClient.invalidateQueries({ queryKey: ["farm-affiliations"] });
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-earth">
      <header className="bg-white border-b shadow-soft">
        <div className="container mx-auto px-4 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/admin/dashboard")}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Farm Affiliations</h1>
          <p className="text-sm text-muted-foreground">
            Manage lead farmer assignments and commission rates
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Assignment Form */}
        <Card>
          <CardHeader>
            <CardTitle>Assign Farm to Lead Farmer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lead-farmer">Lead Farmer</Label>
                <Select value={selectedLeadFarmer} onValueChange={setSelectedLeadFarmer}>
                  <SelectTrigger id="lead-farmer">
                    <SelectValue placeholder="Select lead farmer" />
                  </SelectTrigger>
                  <SelectContent>
                    {leadFarmers?.map((farmer) => (
                      <SelectItem key={farmer.id} value={farmer.id}>
                        {farmer.full_name} - {farmer.farm_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="farm">Farm</Label>
                <Select value={selectedFarm} onValueChange={setSelectedFarm}>
                  <SelectTrigger id="farm">
                    <SelectValue placeholder="Select farm" />
                  </SelectTrigger>
                  <SelectContent>
                    {farms?.map((farm) => (
                      <SelectItem key={farm.id} value={farm.id}>
                        {farm.farm_name} - {farm.profiles.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="commission">Commission Rate (%)</Label>
                <Input
                  id="commission"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(e.target.value)}
                />
              </div>
            </div>

            <Button onClick={handleAssign} disabled={isAssigning}>
              {isAssigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign Farm
            </Button>
          </CardContent>
        </Card>

        {/* Affiliations List */}
        <Card>
          <CardHeader>
            <CardTitle>Current Affiliations</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead Farmer</TableHead>
                  <TableHead>Farm</TableHead>
                  <TableHead>Farmer</TableHead>
                  <TableHead>Commission Rate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {affiliations?.map((affiliation) => (
                  <TableRow key={affiliation.id}>
                    <TableCell className="font-medium">
                      {affiliation.lead_farmer.full_name}
                      <div className="text-sm text-muted-foreground">
                        {affiliation.lead_farmer.farm_name}
                      </div>
                    </TableCell>
                    <TableCell>{affiliation.farm.farm_name}</TableCell>
                    <TableCell>{affiliation.farm.profiles.full_name}</TableCell>
                    <TableCell>{affiliation.commission_rate}%</TableCell>
                    <TableCell>
                      <Badge variant={affiliation.active ? "default" : "secondary"}>
                        {affiliation.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(affiliation.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleAffiliation.mutate({
                          id: affiliation.id,
                          active: affiliation.active
                        })}
                      >
                        {affiliation.active ? (
                          <>
                            <XCircle className="h-4 w-4 mr-2 text-destructive" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                            Activate
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
