import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DriverRatingProps {
  orderId: string;
  driverId: string;
  driverName?: string;
  onRatingSubmitted?: () => void;
}

export const DriverRating = ({ orderId, driverId, driverName, onRatingSubmitted }: DriverRatingProps) => {
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({
        title: "Please select a rating",
        description: "Rate your driver from 1 to 5 stars",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const { error } = await supabase
        .from('delivery_ratings')
        .insert({
          order_id: orderId,
          driver_id: driverId,
          rating,
          feedback: feedback.trim() || null,
        });

      if (error) throw error;

      toast({
        title: "Thank you for your feedback!",
        description: "Your rating has been submitted",
      });

      onRatingSubmitted?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rate Your Driver</CardTitle>
        <CardDescription>
          How was your delivery experience{driverName ? ` with ${driverName}` : ''}?
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              className="transition-transform hover:scale-110"
            >
              <Star
                className={`h-10 w-10 ${
                  star <= (hoveredRating || rating)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-300'
                }`}
              />
            </button>
          ))}
        </div>

        {rating > 0 && (
          <p className="text-center text-sm text-muted-foreground">
            {rating === 5 && "Excellent!"}
            {rating === 4 && "Great job!"}
            {rating === 3 && "Good"}
            {rating === 2 && "Could be better"}
            {rating === 1 && "Needs improvement"}
          </p>
        )}

        <div className="space-y-2">
          <label htmlFor="feedback" className="text-sm font-medium">
            Additional Feedback (Optional)
          </label>
          <Textarea
            id="feedback"
            placeholder="Tell us more about your experience..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
            maxLength={500}
          />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || rating === 0}
          className="w-full"
        >
          {isSubmitting ? "Submitting..." : "Submit Rating"}
        </Button>
      </CardContent>
    </Card>
  );
};
