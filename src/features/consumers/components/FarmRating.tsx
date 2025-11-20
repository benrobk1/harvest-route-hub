import { useState } from 'react';
import { Star } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { FARM_FEEDBACK_TAGS, type FeedbackTag } from '../types/feedback';

interface FarmRatingProps {
  farmName: string;
  farmProfileId: string;
  rating: number;
  onRatingChange: (rating: number) => void;
  feedback: string;
  onFeedbackChange: (feedback: string) => void;
  selectedTags: FeedbackTag[];
  onTagsChange: (tags: FeedbackTag[]) => void;
}

export const FarmRating = ({
  farmName,
  rating,
  onRatingChange,
  feedback,
  onFeedbackChange,
  selectedTags,
  onTagsChange,
}: FarmRatingProps) => {
  const [hover, setHover] = useState(0);

  const toggleTag = (tag: FeedbackTag) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag];
    onTagsChange(newTags);
  };

  const getTagVariant = (tag: FeedbackTag): 'default' | 'destructive' => {
    return FARM_FEEDBACK_TAGS.positive.includes(tag) ? 'default' : 'destructive';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Rate {farmName}</CardTitle>
        <CardDescription>How was the quality of products from this farm?</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onRatingChange(star)}
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
                {Object.entries(FARM_FEEDBACK_TAGS).map(([, tags]) =>
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
              <label htmlFor={`feedback-farm`} className="text-sm font-medium">
                Additional Comments (Optional)
              </label>
              <Textarea
                id={`feedback-farm`}
                value={feedback}
                onChange={(e) => onFeedbackChange(e.target.value)}
                placeholder="Share your thoughts about this farm..."
                rows={3}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
