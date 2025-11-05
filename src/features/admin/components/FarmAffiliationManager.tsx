import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { adminQueries } from '@/features/admin';

export function FarmAffiliationManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedLeadFarmer, setSelectedLeadFarmer] = useState('');
  const [selectedFarm, setSelectedFarm] = useState('');
  const [commissionRate, setCommissionRate] = useState(5);
  const [assigning, setAssigning] = useState(false);
  
  const { data: leadFarmers } = useQuery({
    queryKey: adminQueries.leadFarmers(),
    queryFn: async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('user_id, profiles!inner(full_name)')
        .eq('role', 'lead_farmer');
      
      return data || [];
    },
  });
  
  const { data: farms } = useQuery({
    queryKey: adminQueries.allFarms(),
    queryFn: async () => {
      const { data } = await supabase
        .from('farm_profiles')
        .select('*');
      
      return data || [];
    },
  });
  
  const handleAssign = async () => {
    if (!selectedLeadFarmer || !selectedFarm) {
      toast({
        title: 'Missing selection',
        description: 'Please select both a lead farmer and a farm',
        variant: 'destructive',
      });
      return;
    }
    
    setAssigning(true);
    
    try {
      const { error } = await supabase
        .from('farm_affiliations')
        .insert({
          lead_farmer_id: selectedLeadFarmer,
          farm_profile_id: selectedFarm,
          commission_rate: commissionRate,
          active: true,
        });
      
      if (error) throw error;
      
      toast({
        title: 'Farm assigned',
        description: 'The farm has been assigned to the lead farmer',
      });
      
      // Reset form
      setSelectedLeadFarmer('');
      setSelectedFarm('');
      setCommissionRate(5);
      
      // Refetch data
      queryClient.invalidateQueries({ queryKey: adminQueries.leadFarmers() });
      queryClient.invalidateQueries({ queryKey: adminQueries.allFarms() });
    } catch (error: any) {
      toast({
        title: 'Failed to assign',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setAssigning(false);
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Assign Farms to Lead Farmers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="lead-farmer">Lead Farmer</Label>
          <Select value={selectedLeadFarmer} onValueChange={setSelectedLeadFarmer}>
            <SelectTrigger id="lead-farmer">
              <SelectValue placeholder="Select lead farmer" />
            </SelectTrigger>
            <SelectContent>
              {leadFarmers?.map((lf: any) => (
                <SelectItem key={lf.user_id} value={lf.user_id}>
                  {lf.profiles.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="farm">Farm</Label>
          <Select value={selectedFarm} onValueChange={setSelectedFarm}>
            <SelectTrigger id="farm">
              <SelectValue placeholder="Select farm" />
            </SelectTrigger>
            <SelectContent>
              {farms?.map((farm) => (
                <SelectItem key={farm.id} value={farm.id}>
                  {farm.farm_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="commission">Commission Rate (%)</Label>
          <Input
            id="commission"
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={commissionRate}
            onChange={(e) => setCommissionRate(parseFloat(e.target.value))}
          />
        </div>
        
        <Button onClick={handleAssign} className="w-full" disabled={assigning}>
          {assigning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Assigning...
            </>
          ) : (
            'Assign Farm'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
