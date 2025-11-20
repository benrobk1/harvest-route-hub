import { useState } from 'react';
import { Star, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ITEM_FEEDBACK_TAGS, type FeedbackTag } from '../types/feedback';

interface ItemRatingProps {
  productName: string;
  quantity: number;
  unit: string;
  rating: number;
  onRatingChange: (rating: number) => void;
  feedback: string;
  onFeedbackChange: (feedback: string) => void;
  selectedTags: FeedbackTag[];
  onTagsChange: (tags: FeedbackTag[]) => void;
}

export const ItemRating = ({
  productName,
  quantity,
  unit,
  rating,
  onRatingChange,
  feedback,
  onFeedbackChange,
  selectedTags,
  onTagsChange,
}: ItemRatingProps) => {
  const [hover, setHover] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const toggleTag = (tag: FeedbackTag) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag];
    onTagsChange(newTags);
  };

  const getTagVariant = (tag: FeedbackTag): 'default' | 'destructive' => {
    return ITEM_FEEDBACK_TAGS.positive.includes(tag) ? 'default' : 'destructive';
  };

  return (
    <Card className="w-full">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="text-left">
                <p className="font-medium">{productName}</p>
                <p className="text-sm text-muted-foreground">
                  {quantity} {unit}
                </p>
              </div>
              {rating > 0 && (
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-medium">{rating}</span>
                </div>
              )}
            </div>
            {isOpen ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
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
                    className={`h-6 w-6 ${
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
                {Object.entries(ITEM_FEEDBACK_TAGS).map(([, tags]) =>
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
                  <label className="text-sm font-medium">
                    Additional Comments (Optional)
                  </label>
                  <Textarea
                    value={feedback}
                    onChange={(e) => onFeedbackChange(e.target.value)}
                    placeholder="Any specific thoughts about this item..."
                    rows={2}
                  />
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
