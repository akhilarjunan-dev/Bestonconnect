/**
 * Razorpay Checkout Hook - Synchronous Redirect Flow
 * 
 * This hook implements a stable payment flow that:
 * 1. Pre-creates Razorpay orders before enabling Pay button
 * 2. Opens checkout synchronously on user click (no async before rzp.open())
 * 3. Uses redirect mode for maximum compatibility
 * 4. Blocks in-app browsers completely
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { detectInAppBrowser, shouldBlockPayment, InAppBrowserInfo } from '@/lib/inAppBrowserGuard';

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

// Singleton script state
let scriptLoadPromise: Promise<boolean> | null = null;
let isScriptLoaded = false;

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: {
    email?: string;
    contact?: string;
    name?: string;
  };
  theme?: {
    color?: string;
  };
  notes?: Record<string, unknown>;
}

interface PreparedOrder {
  key_id: string;
  order_id: string;
  amount: number;
  currency: string;
}

export interface CheckoutData {
  cartData: unknown;
  buyerEmail: string;
  buyerName?: string;
  deliveryAddress?: unknown;
  promoterInfo?: unknown;
  finalTotal: number;
}

// Logging utility
const log = (event: string, data?: unknown) => {
  console.log(`[RazorpayCheckout ${new Date().toISOString()}] ${event}`, data || '');
};

/**
 * Load Razorpay script with singleton pattern
 */
const loadRazorpayScript = (): Promise<boolean> => {
  if (isScriptLoaded && (window as any).Razorpay) {
    return Promise.resolve(true);
  }

  if (scriptLoadPromise) {
    return scriptLoadPromise;
  }

  log('Loading Razorpay script...');

  scriptLoadPromise = new Promise((resolve) => {
    if ((window as any).Razorpay) {
      isScriptLoaded = true;
      resolve(true);
      return;
    }

    const existingScript = document.querySelector(`script[src="${RAZORPAY_SCRIPT_URL}"]`);
    if (existingScript) existingScript.remove();

    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.crossOrigin = 'anonymous';

    const timeout = setTimeout(() => {
      log('Script load timeout');
      scriptLoadPromise = null;
      resolve(false);
    }, 25000);

    script.onload = () => {
      clearTimeout(timeout);
      const checkReady = (retries = 10) => {
        if ((window as any).Razorpay) {
          log('Script loaded successfully');
          isScriptLoaded = true;
          resolve(true);
        } else if (retries > 0) {
          setTimeout(() => checkReady(retries - 1), 100);
        } else {
          scriptLoadPromise = null;
          resolve(false);
        }
      };
      checkReady();
    };

    script.onerror = () => {
      clearTimeout(timeout);
      log('Script load error');
      scriptLoadPromise = null;
      resolve(false);
    };

    document.head.appendChild(script);
  });

  return scriptLoadPromise;
};

/**
 * Preload Razorpay script - call early in app lifecycle
 */
export const preloadRazorpayScript = (): void => {
  if (typeof window === 'undefined') return;
  
  // Add preload link hint
  if (!document.querySelector(`link[href="${RAZORPAY_SCRIPT_URL}"]`)) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'script';
    link.href = RAZORPAY_SCRIPT_URL;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }

  loadRazorpayScript().catch(() => {});
};

/**
 * Get callback URL for redirect flow
 */
export const getPaymentCallbackUrl = (): string => {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/payment-callback`;
};

/**
 * Store checkout data for recovery after redirect
 */
export const storeCheckoutData = (data: CheckoutData & { orderId: string }) => {
  localStorage.setItem('pending_checkout_data', JSON.stringify({
    ...data,
    timestamp: Date.now()
  }));
  log('Checkout data stored for redirect recovery');
};

/**
 * Retrieve stored checkout data after redirect
 */
export const retrieveCheckoutData = () => {
  const data = localStorage.getItem('pending_checkout_data');
  if (data) {
    const parsed = JSON.parse(data);
    if (Date.now() - parsed.timestamp < 30 * 60 * 1000) {
      return parsed;
    }
    localStorage.removeItem('pending_checkout_data');
  }
  return null;
};

export const clearCheckoutData = () => {
  localStorage.removeItem('pending_checkout_data');
};

export interface UseRazorpayCheckoutReturn {
  // State
  isScriptReady: boolean;
  isPreparing: boolean;
  preparedOrder: PreparedOrder | null;
  error: string | null;
  inAppBrowserInfo: InAppBrowserInfo;
  
  // Actions
  prepareOrder: (params: {
    amount: number;
    currency?: string;
    receipt?: string;
    notes?: Record<string, unknown>;
  }) => Promise<PreparedOrder | null>;
  
  openCheckout: (options: {
    description: string;
    prefill?: RazorpayOptions['prefill'];
    theme?: RazorpayOptions['theme'];
    checkoutData: CheckoutData;
  }) => void;
  
  resetError: () => void;
  preload: () => void;
}

/**
 * Main hook for Razorpay checkout
 */
export function useRazorpayCheckout(): UseRazorpayCheckoutReturn {
  const [isScriptReady, setIsScriptReady] = useState(isScriptLoaded);
  const [isPreparing, setIsPreparing] = useState(false);
  const [preparedOrder, setPreparedOrder] = useState<PreparedOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inAppBrowserInfo] = useState(() => detectInAppBrowser());
  
  const razorpayRef = useRef<any>(null);

  // Load script on mount
  useEffect(() => {
    loadRazorpayScript().then(setIsScriptReady);
  }, []);

  const resetError = useCallback(() => setError(null), []);

  const preload = useCallback(() => {
    preloadRazorpayScript();
  }, []);

  /**
   * Pre-create Razorpay order - call this BEFORE user clicks Pay
   */
  const prepareOrder = useCallback(async (params: {
    amount: number;
    currency?: string;
    receipt?: string;
    notes?: Record<string, unknown>;
  }): Promise<PreparedOrder | null> => {
    log('Preparing order...', params);
    setIsPreparing(true);
    setError(null);
    setPreparedOrder(null);

    try {
      // Ensure script is loaded
      const scriptReady = await loadRazorpayScript();
      if (!scriptReady) {
        throw new Error('Payment gateway unavailable. Please try a different browser.');
      }
      setIsScriptReady(true);

      // Create order on server
      const { data, error: orderError } = await supabase.functions.invoke('razorpay', {
        body: {
          action: 'create_order',
          amount: params.amount,
          currency: params.currency || 'INR',
          receipt: params.receipt || `order_${Date.now()}`,
          notes: params.notes || {}
        }
      });

      if (orderError || !data?.order_id) {
        throw new Error('Failed to create payment order. Please try again.');
      }

      const order: PreparedOrder = {
        key_id: data.key_id,
        order_id: data.order_id,
        amount: data.amount,
        currency: data.currency
      };

      log('Order prepared:', order);
      setPreparedOrder(order);
      return order;

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to prepare payment';
      log('Prepare order error:', message);
      setError(message);
      return null;
    } finally {
      setIsPreparing(false);
    }
  }, []);

  /**
   * Open checkout - MUST be called synchronously in click handler
   * NO async/await before rzp.open()
   */
  const openCheckout = useCallback((options: {
    description: string;
    prefill?: RazorpayOptions['prefill'];
    theme?: RazorpayOptions['theme'];
    checkoutData: CheckoutData;
  }) => {
    log('openCheckout called');

    // Check for in-app browser block
    const blockCheck = shouldBlockPayment();
    if (blockCheck.blocked) {
      log('Payment blocked - in-app browser');
      setError(blockCheck.reason);
      return;
    }

    // Verify order is prepared
    if (!preparedOrder) {
      log('ERROR: No prepared order');
      setError('Payment not ready. Please wait and try again.');
      return;
    }

    // Verify script is loaded
    if (!(window as any).Razorpay) {
      log('ERROR: Razorpay not available');
      setError('Payment gateway not loaded. Please refresh the page.');
      return;
    }

    // Store checkout data for redirect recovery
    storeCheckoutData({
      ...options.checkoutData,
      orderId: preparedOrder.order_id
    });

    // Build Razorpay options - REDIRECT MODE ONLY
    const rzpOptions = {
      key: preparedOrder.key_id,
      amount: preparedOrder.amount,
      currency: preparedOrder.currency,
      name: 'Beston Connect',
      description: options.description,
      order_id: preparedOrder.order_id,
      callback_url: getPaymentCallbackUrl(),
      redirect: true,
      prefill: options.prefill,
      theme: options.theme || { color: '#6366f1' },
      retry: { enabled: true, max_count: 3 },
      timeout: 300,
    };

    log('Creating Razorpay instance with redirect mode...', {
      order_id: rzpOptions.order_id,
      callback_url: rzpOptions.callback_url
    });

    // Create and open SYNCHRONOUSLY - no await/async here!
    try {
      // Blur any focused element to prevent focus conflicts
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      const razorpay = new (window as any).Razorpay(rzpOptions);
      razorpayRef.current = razorpay;

      // Open immediately - this will redirect
      razorpay.open();
      log('Checkout opened - redirecting to Razorpay');

    } catch (err) {
      log('Error opening checkout:', err);
      setError('Failed to open payment gateway. Please try again.');
    }
  }, [preparedOrder]);

  return {
    isScriptReady,
    isPreparing,
    preparedOrder,
    error,
    inAppBrowserInfo,
    prepareOrder,
    openCheckout,
    resetError,
    preload,
  };
}

/**
 * Preload hook - use in Layout or early components
 */
export function useRazorpayPreload(): void {
  useEffect(() => {
    preloadRazorpayScript();
  }, []);
}
