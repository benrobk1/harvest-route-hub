import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Share2, Copy, CheckCircle2, Users, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatMoney } from "@/lib/formatMoney";

interface ReferralStats {
  referral_code: string;
  total_referrals: number;
  pending_referrals: number;
  completed_referrals: number;
  total_credits_earned: number;
  referrals: Array<{
    id: string;
    status: string;
    credit_amount: number;
    created_at: string;
    credited_at: string | null;
  }>;
}

export const ReferralManager = () => {
  const { toast } = useToast();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadReferralStats();
  }, []);

  const loadReferralStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's referral code
      const { data: profile } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('id', user.id)
        .single();

      // Get referral records
      const { data: referrals } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false });

      const pending = referrals?.filter(r => r.status === 'pending').length || 0;
      const completed = referrals?.filter(r => r.status === 'completed').length || 0;
      const totalCredits = referrals?.reduce((sum, r) => 
        r.status === 'completed' ? sum + parseFloat(r.credit_amount.toString()) : sum, 0
      ) || 0;

      setStats({
        referral_code: profile?.referral_code || '',
        total_referrals: referrals?.length || 0,
        pending_referrals: pending,
        completed_referrals: completed,
        total_credits_earned: totalCredits,
        referrals: referrals || []
      });
    } catch (error) {
      console.error('Error loading referral stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!stats?.referral_code) return;
    
    try {
      await navigator.clipboard.writeText(stats.referral_code);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Referral code copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Error",
        description: "Failed to copy code",
        variant: "destructive",
      });
    }
  };

  const handleShareLink = async () => {
    if (!stats?.referral_code) return;

    const shareUrl = `${window.location.origin}/auth/consumer?ref=${stats.referral_code}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Blue Harvests',
          text: 'Use my referral code to get fresh farm produce delivered!',
          url: shareUrl,
        });
      } catch {
        // User cancelled share or error occurred
      }
    } else {
      // Fallback to copying link
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast({
          title: "Link Copied!",
          description: "Share this link with friends",
        });
      } catch {
        toast({
          title: "Error",
          description: "Failed to copy link",
          variant: "destructive",
        });
      }
    }
  };

  if (isLoading) {
    return <Card><CardContent className="p-6">Loading...</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Referral Program
            </CardTitle>
            <CardDescription>
              Invite friends and earn $25 credit when they complete their first order
            </CardDescription>
          </div>
          <Badge variant="outline" className="flex items-center gap-1">
            <Gift className="h-3 w-3" />
            {formatMoney(stats?.total_credits_earned || 0)} Earned
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Referral Code */}
        <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg space-y-3">
          <p className="text-sm font-medium">Your Referral Code</p>
          <div className="flex gap-2">
            <Input 
              value={stats?.referral_code || ''} 
              readOnly 
              className="font-mono text-lg text-center"
            />
            <Button 
              variant="outline" 
              size="icon"
              onClick={handleCopyCode}
            >
              {copied ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <Button 
            variant="default" 
            className="w-full"
            onClick={handleShareLink}
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share Referral Link
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold">{stats?.total_referrals || 0}</div>
            <div className="text-xs text-muted-foreground">Total Referrals</div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{stats?.pending_referrals || 0}</div>
            <div className="text-xs text-muted-foreground">Pending</div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-green-600">{stats?.completed_referrals || 0}</div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </div>
        </div>

        {/* Recent Referrals */}
        {stats && stats.referrals.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Recent Referrals</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {stats.referrals.map((referral) => (
                <div 
                  key={referral.id}
                  className="flex items-center justify-between p-3 border rounded-lg text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {formatMoney(parseFloat(referral.credit_amount.toString()))} Credit
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(referral.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={referral.status === 'completed' ? 'default' : 'secondary'}>
                    {referral.status === 'completed' ? 'Earned' : 'Pending'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* How it Works */}
        <div className="bg-muted p-4 rounded-lg space-y-2">
          <h4 className="font-semibold text-sm">How It Works</h4>
          <ol className="text-sm text-muted-foreground space-y-1 ml-4 list-decimal">
            <li>Share your referral code with friends</li>
            <li>They sign up and enter your code</li>
            <li>When they complete their first order, you get $25 credit!</li>
            <li>Credits expire after 6 months</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};
