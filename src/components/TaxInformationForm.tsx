import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Loader2, ChevronDown } from 'lucide-react';
import { getErrorMessage } from '@/lib/errors';

export function TaxInformationForm() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [taxIdType, setTaxIdType] = useState<'ssn' | 'ein'>('ssn');
  const [taxId, setTaxId] = useState('');
  const [taxName, setTaxName] = useState('');
  const [taxAddress, setTaxAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!taxId || !taxName || !taxAddress) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }
    
    setSubmitting(true);
    
    try {
      const { error } = await supabase.functions.invoke('store-tax-info', {
        body: {
          tax_id: taxId,
          tax_id_type: taxIdType,
          tax_name: taxName,
          tax_address: taxAddress,
        },
      });
      
      if (error) throw error;
      
      toast({
        title: 'Tax information saved',
        description: 'Your W-9 information has been securely stored',
      });
      
      // Clear form
      setTaxId('');
      setTaxName('');
      setTaxAddress('');
    } catch (error: unknown) {
      toast({
        title: 'Failed to save',
        description: getErrorMessage(error) || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CardHeader>
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <div>
                <CardTitle>Tax Information (W-9)</CardTitle>
                <CardDescription>
                  Required for annual 1099 tax forms if you earn over $600/year
                </CardDescription>
              </div>
              <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="tax-id-type">Tax ID Type</Label>
            <Select value={taxIdType} onValueChange={(v) => setTaxIdType(v as 'ssn' | 'ein')}>
              <SelectTrigger id="tax-id-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ssn">Social Security Number (SSN)</SelectItem>
                <SelectItem value="ein">Employer ID Number (EIN)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="tax-id">
              {taxIdType === 'ssn' ? 'Social Security Number' : 'Employer ID Number'}
            </Label>
            <Input
              id="tax-id"
              type="password"
              placeholder={taxIdType === 'ssn' ? 'XXX-XX-XXXX' : 'XX-XXXXXXX'}
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              maxLength={taxIdType === 'ssn' ? 11 : 10}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Encrypted and stored securely. Never shared without your consent.
            </p>
          </div>
          
          <div>
            <Label htmlFor="tax-name">Legal Name (as it appears on tax returns)</Label>
            <Input
              id="tax-name"
              value={taxName}
              onChange={(e) => setTaxName(e.target.value)}
              placeholder="John Doe / Blue Harvests LLC"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="tax-address">Tax Address</Label>
            <Textarea
              id="tax-address"
              value={taxAddress}
              onChange={(e) => setTaxAddress(e.target.value)}
              placeholder="123 Main St, City, State 12345"
              rows={3}
              required
            />
          </div>
          
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Shield className="mr-2 h-4 w-4" />
                Save Tax Information Securely
              </>
            )}
          </Button>
        </form>
      </CardContent>
        </CollapsibleContent>
    </Card>
    </Collapsible>
  );
}
