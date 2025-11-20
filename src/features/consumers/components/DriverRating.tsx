import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Star } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { DRIVER_FEEDBACK_TAGS, type FeedbackTag } from '../types/feedback';

interface DriverRatingProps {
  orderId: string;
  driverId: string;
  driverName?: string;
  onRatingSubmitted?: () => void;
}

export const DriverRating = ({
  orderId,
  driverId,
  driverName,
  onRatingSubmitted,
}: DriverRatingProps) => {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [selectedTags, setSelectedTags] = useState<FeedbackTag[]>([]);
  const queryClient = useQueryClient();

  const submitRating = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('delivery_ratings').insert({
        order_id: orderId,
        driver_id: driverId,
        rating,
        feedback: feedback || null,
        feedback_tags: selectedTags,
        reviewer_type: 'consumer',
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Rating submitted',
        description: 'Thank you for rating your driver!',
      });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      onRatingSubmitted?.();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error submitting rating',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = () => {
    if (rating === 0) {
      toast({
        title: 'Please select a rating',
        variant: 'destructive',
      });
      return;
    }
    submitRating.mutate();
  };

  const toggleTag = (tag: FeedbackTag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const getTagVariant = (tag: FeedbackTag): 'default' | 'secondary' | 'destructive' => {
    if (DRIVER_FEEDBACK_TAGS.positive.includes(tag)) return 'default';
    if (DRIVER_FEEDBACK_TAGS.negative.includes(tag)) return 'destructive';
    return 'secondary';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Rate Your Driver</CardTitle>
        <CardDescription>
          {driverName ? `How was your experience with ${driverName}?` : 'How was your delivery experience?'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(0)}
              className="transition-transform hover:scale-110"
            >
              <Star
                className={`h-8 w-8 ${
                  star <= (hover || rating)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-300'
                }`}
              />
            </button>
          ))}
        </div>

        {rating > 0 && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">Quick Feedback (Optional)</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(DRIVER_FEEDBACK_TAGS).map(([, tags]) =>
                  tags.map(tag => (
                    <Badge
                      key={tag}
                      variant={selectedTags.includes(tag) ? getTagVariant(tag) : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </Badge>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="feedback" className="text-sm font-medium">
                Additional Comments (Optional)
              </label>
              <Textarea
                id="feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Share more details about your experience..."
                rows={3}
              />
            </div>
          </>
        )}

        <Button
          onClick={handleSubmit}
          disabled={rating === 0 || submitRating.isPending}
          className="w-full"
        >
          {submitRating.isPending ? 'Submitting...' : 'Submit Rating'}
        </Button>
      </CardContent>
    </Card>
  );
};
