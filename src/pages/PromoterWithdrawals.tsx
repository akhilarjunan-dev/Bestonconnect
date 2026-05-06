import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/layout/Layout';
import { PromoterNavFooter } from '@/components/navigation/PromoterNavFooter';
import { WithdrawalRequest } from '@/components/withdrawals/WithdrawalRequest';
import { Banknote } from 'lucide-react';

export default function PromoterWithdrawals() {
  const { user, hasRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && (!user || !hasRole('promoter'))) {
      navigate('/');
    }
  }, [user, authLoading, hasRole, navigate]);

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-8 px-4 pb-24">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-xl bg-primary/10">
            <Banknote className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-display">Withdrawals</h1>
            <p className="text-muted-foreground">Request payouts from your earnings</p>
          </div>
        </div>

        <WithdrawalRequest />
      </div>
      <PromoterNavFooter />
    </Layout>
  );
}
