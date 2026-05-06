import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { retrieveCheckoutData, clearCheckoutData } from '@/hooks/useRazorpay';

type PaymentStatus = 'verifying' | 'success' | 'failed' | 'error';

export default function PaymentCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<PaymentStatus>('verifying');
  const [message, setMessage] = useState('Verifying your payment...');

  useEffect(() => {
    const verifyPayment = async () => {
      console.log('[PaymentCallback] Processing payment callback');
      
      // Get Razorpay response from URL params
      const razorpay_payment_id = searchParams.get('razorpay_payment_id');
      const razorpay_order_id = searchParams.get('razorpay_order_id');
      const razorpay_signature = searchParams.get('razorpay_signature');
      
      // Check for failure indicators
      const error_code = searchParams.get('error[code]');
      const error_description = searchParams.get('error[description]');
      
      console.log('[PaymentCallback] Params:', { 
        razorpay_payment_id, 
        razorpay_order_id, 
        hasSignature: !!razorpay_signature,
        error_code 
      });

      // Handle explicit failure
      if (error_code) {
        console.log('[PaymentCallback] Payment failed with error:', error_code, error_description);
        setStatus('failed');
        setMessage(error_description || 'Payment was cancelled or failed');
        clearCheckoutData();
        return;
      }

      // Missing required params
      if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
        console.log('[PaymentCallback] Missing required params');
        setStatus('error');
        setMessage('Invalid payment response. Please contact support if amount was deducted.');
        return;
      }

      // Retrieve stored checkout data
      const checkoutData = retrieveCheckoutData();
      console.log('[PaymentCallback] Retrieved checkout data:', !!checkoutData);

      if (!checkoutData) {
        console.log('[PaymentCallback] No checkout data found - may have expired');
        // Still try to verify with Razorpay, but we can't create the order
        setStatus('error');
        setMessage('Session expired. Please check My Orders for order status, or contact support.');
        return;
      }

      try {
        // Process each item from cart
        const { cartData, buyerName } = checkoutData;
        
        for (const item of (cartData as Array<{
          product_id: string;
          buyer_email: string;
          quantity: number;
          unit_price: number;
          total_amount: number;
          delivery_address: unknown;
          is_digital: boolean;
          promoter_id: string | null;
          referral_link_id: string | null;
          commission_rate: number;
        }>)) {
          // Get current user for user_id
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          
          const orderPayload = {
            product_id: item.product_id,
            buyer_email: item.buyer_email,
            buyer_name: buyerName || null,
            user_id: currentUser?.id || null,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_amount: item.total_amount,
            delivery_address: item.is_digital ? null : item.delivery_address,
            is_digital: item.is_digital,
            promoter_id: item.promoter_id,
            referral_link_id: item.referral_link_id
          };

          // Build sale data if promoter is involved
          const saleData = item.promoter_id ? {
            referral_link_id: item.referral_link_id,
            product_id: item.product_id,
            promoter_id: item.promoter_id,
            buyer_email: item.buyer_email,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_amount: item.total_amount,
            commission_rate: item.commission_rate,
            commission_amount: item.total_amount * (item.commission_rate / 100),
            is_digital: item.is_digital,
          } : null;

          // Verify payment and create order
          const { data: verifyResult, error: verifyError } = await supabase.functions.invoke('razorpay', {
            body: {
              action: 'verify_payment',
              razorpay_order_id,
              razorpay_payment_id,
              razorpay_signature,
              order_data: orderPayload,
              sale_data: saleData
            }
          });

          if (verifyError) {
            console.error('[PaymentCallback] Verification error:', verifyError);
            throw new Error('Payment verification failed');
          }

          if (!verifyResult?.verified) {
            throw new Error('Payment signature mismatch');
          }
        }

        // Success! Clear cart and checkout data
        localStorage.removeItem('bestonconnect_cart');
        localStorage.removeItem('bestonconnect_referral');
        localStorage.removeItem('referral_code');
        clearCheckoutData();
        
        // Dispatch cart update event
        window.dispatchEvent(new CustomEvent('cartUpdated', { detail: 0 }));

        setStatus('success');
        setMessage('Payment successful! Your order has been placed.');
        toast.success('Order placed successfully!');

        console.log('[PaymentCallback] Payment verified and order created');

        // Redirect to order confirmation after a short delay
        setTimeout(() => {
          navigate(`/order-confirmation?payment_id=${razorpay_payment_id}&order_id=${razorpay_order_id}`);
        }, 1500);

      } catch (err) {
        console.error('[PaymentCallback] Error processing payment:', err);
        setStatus('error');
        setMessage('Failed to process payment. Please check My Orders or contact support.');
      }
    };

    verifyPayment();
  }, [searchParams]);

  const getStatusIcon = () => {
    switch (status) {
      case 'verifying':
        return <Loader2 className="h-16 w-16 text-primary animate-spin" />;
      case 'success':
        return <CheckCircle className="h-16 w-16 text-green-600 dark:text-green-400" />;
      case 'failed':
        return <XCircle className="h-16 w-16 text-destructive" />;
      case 'error':
        return <AlertTriangle className="h-16 w-16 text-amber-500" />;
    }
  };

  const getStatusTitle = () => {
    switch (status) {
      case 'verifying':
        return 'Processing Payment';
      case 'success':
        return 'Payment Successful!';
      case 'failed':
        return 'Payment Failed';
      case 'error':
        return 'Something Went Wrong';
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 min-h-[60vh] flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center space-y-6">
            <div className="flex justify-center">
              {getStatusIcon()}
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">{getStatusTitle()}</h1>
              <p className="text-muted-foreground">{message}</p>
            </div>

            <div className="flex flex-col gap-3">
              {status === 'success' && (
                <>
                  <Button onClick={() => navigate('/my-orders')} className="w-full">
                    View My Orders
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/shop')} className="w-full">
                    Continue Shopping
                  </Button>
                </>
              )}
              
              {status === 'failed' && (
                <>
                  <Button onClick={() => navigate('/cart')} className="w-full">
                    Try Again
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/')} className="w-full">
                    Go Home
                  </Button>
                </>
              )}
              
              {status === 'error' && (
                <>
                  <Button onClick={() => navigate('/my-orders')} className="w-full">
                    Check My Orders
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/contact')} className="w-full">
                    Contact Support
                  </Button>
                </>
              )}
              
              {status === 'verifying' && (
                <p className="text-sm text-muted-foreground">
                  Please wait while we confirm your payment...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
