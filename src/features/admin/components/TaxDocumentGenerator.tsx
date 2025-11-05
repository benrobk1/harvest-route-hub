import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, FileText, Loader2 } from 'lucide-react';

export function TaxDocumentGenerator() {
  const { toast } = useToast();
  const [year, setYear] = useState(new Date().getFullYear() - 1);
  const [generating, setGenerating] = useState(false);
  
  const handleGenerateAll = async () => {
    setGenerating(true);
    
    try {
      // Fetch all users with tax info
      const { data: eligibleUsers } = await supabase
        .from('profiles')
        .select('id, full_name, tax_name')
        .not('w9_submitted_at', 'is', null);
      
      if (!eligibleUsers || eligibleUsers.length === 0) {
        toast({
          title: 'No eligible users',
          description: 'No users have submitted W-9 information',
          variant: 'destructive',
        });
        return;
      }
      
      let successCount = 0;
      let belowThresholdCount = 0;
      let errorCount = 0;
      
      for (const user of eligibleUsers) {
        try {
          const { data, error } = await supabase.functions.invoke('generate-1099', {
            body: { year, recipient_id: user.id },
          });
          
          if (error) throw error;
          
          if (data?.below_threshold) {
            belowThresholdCount++;
          } else {
            successCount++;
          }
        } catch (error) {
          console.error(`Failed for ${user.full_name}:`, error);
          errorCount++;
        }
      }
      
      toast({
        title: '1099 generation complete',
        description: `Generated ${successCount} forms. ${belowThresholdCount} users below $600 threshold. ${errorCount} errors.`,
      });
    } catch (error: any) {
      toast({
        title: 'Generation failed',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate 1099 Forms</CardTitle>
        <CardDescription>
          Generate IRS Form 1099-NEC for all users who earned over $600
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="tax-year">Tax Year</Label>
          <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger id="tax-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2023, 2022].map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Important</AlertTitle>
          <AlertDescription>
            Forms will only be generated for users who:
            <br />• Submitted W-9 information
            <br />• Earned $600 or more in {year}
            <br />• Have completed payouts
          </AlertDescription>
        </Alert>
        
        <Button onClick={handleGenerateAll} disabled={generating} className="w-full">
          {generating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              Generate All 1099 Forms
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
