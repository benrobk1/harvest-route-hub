import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Copy, Share2, Mail } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { consumerQueries } from '@/features/consumers';

interface ReferralModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ReferralModal = ({ open, onOpenChange }: ReferralModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: profile } = useQuery({
    queryKey: consumerQueries.profile(user?.id),
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('id', user.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const referralLink = profile?.referral_code
    ? `${window.location.origin}/?ref=${profile.referral_code}`
    : '';

  const handleCopyCode = () => {
    if (profile?.referral_code) {
      navigator.clipboard.writeText(profile.referral_code);
      toast({
        title: 'Copied!',
        description: 'Referral code copied to clipboard',
      });
    }
  };

  const handleCopyLink = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink);
      toast({
        title: 'Copied!',
        description: 'Referral link copied to clipboard',
      });
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: 'Join Blue Harvests',
      text: `Get fresh produce from local farmers! Use my referral code ${profile?.referral_code} and we both get $25 in credits!`,
      url: referralLink,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  const handleEmailShare = () => {
    const subject = encodeURIComponent('Join Blue Harvests with me!');
    const body = encodeURIComponent(
      `I've been using Blue Harvests to get fresh produce from local farmers, and I think you'd love it too!\n\nUse my referral code ${profile?.referral_code} when you sign up and we'll both get $25 in credits.\n\nSign up here: ${referralLink}`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">Refer & Earn $25</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* How It Works */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <h4 className="font-semibold">How It Works</h4>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Share your referral code with friends</li>
              <li>They sign up and place their first order</li>
              <li>You both get $25 in credits!</li>
            </ol>
          </div>

          {/* Referral Code */}
          <div>
            <label className="text-sm font-medium mb-2 block">Your Referral Code</label>
            <div className="flex gap-2">
              <Input value={profile?.referral_code || ''} readOnly className="font-mono" />
              <Button onClick={handleCopyCode} variant="outline" size="icon">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Referral Link */}
          <div>
            <label className="text-sm font-medium mb-2 block">Your Referral Link</label>
            <div className="flex gap-2">
              <Input value={referralLink} readOnly className="text-sm" />
              <Button onClick={handleCopyLink} variant="outline" size="icon">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Share Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={handleShare} variant="outline" className="w-full">
              <Share2 className="mr-2 h-4 w-4" />
              Share Link
            </Button>
            <Button onClick={handleEmailShare} variant="outline" className="w-full">
              <Mail className="mr-2 h-4 w-4" />
              Email
            </Button>
          </div>

          {/* Gift Box Section */}
          <div className="pt-4 border-t">
            <h4 className="font-semibold mb-2">Gift a Box</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Send a personal message with your referral link to introduce someone to Blue Harvests
            </p>
            <Button onClick={handleEmailShare} variant="secondary" className="w-full">
              Send Gift Message
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
