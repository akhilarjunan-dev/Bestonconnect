import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { Loader2 } from 'lucide-react';

export default function ReferralRedirect() {
  const { code } = useParams<{ code: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (code) {
      handleReferralRedirect(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const handleReferralRedirect = async (referralCode: string) => {
    try {
      const cleaned = referralCode.trim();
      const productParam = searchParams.get('product');

      const { data, error: fnError } = await supabase.functions.invoke('validate-referral-code', {
        body: { code: cleaned },
      });

      if (fnError || !data?.valid || !data?.promoter_id) {
        console.error('Referral validation failed:', fnError || 'Invalid response', data);
        setError('Invalid referral link');
        setTimeout(() => navigate('/shop', { replace: true }), 1500);
        return;
      }

      const resolvedCode = (data.link_code as string) || cleaned;
      const promoterId = data.promoter_id as string;
      const referralLinkId = data.referral_link_id as string;

      // Track click (server-side, no RLS issues)
      await supabase.functions.invoke('track-referral', {
        body: { action: 'track_click', link_code: resolvedCode },
      });

      // Store referral info
      localStorage.setItem('referral_code', resolvedCode);
      localStorage.setItem('referral_link_id', referralLinkId);
      localStorage.setItem('referral_promoter_id', promoterId);
      localStorage.setItem(
        'bestonconnect_referral',
        JSON.stringify({ promoter_id: promoterId, referral_link_id: referralLinkId })
      );

      // Priority: URL ?product= param > legacy product_id on link > shop
      const targetProductId = productParam || (data.product_id as string | null) || null;

      if (targetProductId) {
        navigate(`/product/${targetProductId}?ref=${encodeURIComponent(resolvedCode)}`, { replace: true });
      } else {
        navigate(`/shop?ref=${encodeURIComponent(resolvedCode)}`, { replace: true });
      }
    } catch (err) {
      console.error('Error processing referral:', err);
      setError('Error processing referral');
      setTimeout(() => navigate('/shop', { replace: true }), 1500);
    }
  };

  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        {error ? (
          <div className="text-center">
            <p className="text-destructive font-medium">{error}</p>
            <p className="text-muted-foreground text-sm">Redirecting…</p>
          </div>
        ) : (
          <>
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Processing referral link…</p>
          </>
        )}
      </div>
    </Layout>
  );
}
