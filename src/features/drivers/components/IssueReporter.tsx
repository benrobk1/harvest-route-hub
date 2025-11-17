import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/errors/getErrorMessage';

interface IssueReporterProps {
  batchId?: string;
  orderId?: string;
  stopId?: string;
}

interface IssuePayload {
  category: string;
  severity: string;
  title: string;
  description: string;
  delivery_batch_id?: string;
  order_id?: string;
  stop_id?: string;
}

const ISSUE_CATEGORIES = [
  { value: 'delivery_delay', label: 'Delivery Delay' },
  { value: 'vehicle_problem', label: 'Vehicle Problem' },
  { value: 'customer_unavailable', label: 'Customer Unavailable' },
  { value: 'wrong_address', label: 'Wrong Address' },
  { value: 'damaged_product', label: 'Damaged Product' },
  { value: 'missing_items', label: 'Missing Items' },
  { value: 'collection_point_issue', label: 'Collection Point Issue' },
  { value: 'weather_condition', label: 'Weather Condition' },
  { value: 'other', label: 'Other' },
];

const SEVERITIES = [
  { value: 'low', label: '🔵 Low', description: 'Minor inconvenience' },
  { value: 'medium', label: '🟡 Medium', description: 'Notable issue' },
  { value: 'high', label: '🟠 High', description: 'Significant problem' },
  { value: 'critical', label: '🔴 Critical', description: 'Urgent attention needed' },
];

export const IssueReporter = ({ batchId, orderId, stopId }: IssueReporterProps) => {
  const { toast } = useToast();
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const reportMutation = useMutation({
    mutationFn: async (data: IssuePayload) => {
      // Get current location
      let location = null;
      if (navigator.geolocation) {
        try {
          location = await new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => resolve({ 
                latitude: pos.coords.latitude, 
                longitude: pos.coords.longitude 
              }),
              () => resolve(null),
              { timeout: 5000 }
            );
          });
        } catch (e) {
          console.warn('Failed to get location:', e);
        }
      }

      const { data: result, error } = await supabase.functions.invoke('report-delivery-issue', {
        body: { 
          ...data, 
          ...(location && { 
            latitude: location.latitude, 
            longitude: location.longitude 
          })
        },
      });

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast({
        title: 'Issue reported',
        description: 'Admin team has been notified and will respond shortly.',
      });
      // Reset form
      setCategory('');
      setTitle('');
      setDescription('');
      setSeverity('medium');
    },
    onError: (error: unknown) => {
      toast({
        title: 'Failed to report issue',
        description: getErrorMessage(error) || 'Please try again later.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = () => {
    if (!category || !title || !description) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    if (title.length < 5) {
      toast({
        title: 'Title too short',
        description: 'Please provide a more descriptive title (at least 5 characters).',
        variant: 'destructive',
      });
      return;
    }

    if (description.length < 10) {
      toast({
        title: 'Description too short',
        description: 'Please provide more details (at least 10 characters).',
        variant: 'destructive',
      });
      return;
    }

    reportMutation.mutate({
      category,
      severity,
      title,
      description,
      delivery_batch_id: batchId,
      order_id: orderId,
      stop_id: stopId,
    });
  };

  return (
    <Card className="border-orange-200 bg-orange-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-900">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          Report an Issue
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="category">Issue Category *</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="category">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {ISSUE_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="severity">Severity *</Label>
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger id="severity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEVERITIES.map((sev) => (
                <SelectItem key={sev.value} value={sev.value}>
                  <div className="flex flex-col">
                    <span>{sev.label}</span>
                    <span className="text-xs text-muted-foreground">{sev.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">Brief Title *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Customer not home at stop #5"
            maxLength={200}
          />
          <p className="text-xs text-muted-foreground">
            {title.length}/200 characters
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description *</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Provide details about the issue..."
            rows={4}
            maxLength={2000}
          />
          <p className="text-xs text-muted-foreground">
            {description.length}/2000 characters
          </p>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!category || !title || !description || reportMutation.isPending}
          className="w-full"
          variant="destructive"
        >
          {reportMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Report Issue to Admin
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Admin team will be notified immediately via email and push notification
        </p>

        {(orderId || stopId || batchId) && (
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-blue-600 mt-0.5">ℹ️</div>
            <p className="text-xs text-blue-900">
              Affected customers will be automatically notified about this issue to keep them informed.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
