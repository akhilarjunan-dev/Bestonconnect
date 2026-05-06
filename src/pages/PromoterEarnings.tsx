import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/layout/Layout';
import { PromoterNavFooter } from '@/components/navigation/PromoterNavFooter';
import { EarningsReport } from '@/components/earnings/EarningsReport';

export default function PromoterEarnings() {
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
        <EarningsReport />
      </div>
      <PromoterNavFooter />
    </Layout>
  );
}