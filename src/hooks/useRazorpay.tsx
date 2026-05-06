import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
const SCRIPT_LOAD_TIMEOUT = 25000; // 25 seconds
const CHECKOUT_READY_TIMEOUT = 10000; // 10 seconds for checkout to become responsive

// Script loading state - singleton pattern
let scriptLoadPromise: Promise<boolean> | null = null;
let isScriptLoaded = false;
let scriptLoadAttempts = 0;

// Razorpay types
export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
  prefill?: {
    email?: string;
    contact?: string;
    name?: string;
  };
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
    escape?: boolean;
    backdropclose?: boolean;
    confirm_close?: boolean;
  };
  retry?: {
    enabled?: boolean;
    max_count?: number;
  };
  timeout?: number;
  callback_url?: string;
  redirect?: boolean;
  // UPI and config options
  config?: {
    display?: {
      blocks?: Record<string, unknown>;
      sequence?: string[];
      preferences?: {
        show_default_blocks?: boolean;
      };
    };
  };
  // Disable features that cause freezing in in-app browsers
  features?: {
    enable_smart_recommendations?: boolean;
  };
}

export interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, callback: (response?: unknown) => void) => void;
  close: () => void;
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

// Logging utility for checkout debugging
const logCheckout = (event: string, data?: unknown) => {
  const timestamp = new Date().toISOString();
  console.log(`[Razorpay ${timestamp}] ${event}`, data || '');
};

/**
 * Detect if running in an in-app browser (Instagram, Facebook, WhatsApp, etc.)
 * These browsers have restricted cookie/popup/intent handling
 */
export const detectInAppBrowser = (): { isInApp: boolean; browser: string | null } => {
  if (typeof window === 'undefined') return { isInApp: false, browser: null };
  
  const ua = navigator.userAgent || navigator.vendor || '';
  
  // Common in-app browser signatures
  const inAppPatterns: Record<string, RegExp> = {
    'Instagram': /Instagram/i,
    'Facebook': /FBAN|FBAV|FB_IAB/i,
    'WhatsApp': /WhatsApp/i,
    'Twitter': /Twitter/i,
    'LinkedIn': /LinkedInApp/i,
    'Snapchat': /Snapchat/i,
    'Pinterest': /Pinterest/i,
    'TikTok': /BytedanceWebview|TikTok/i,
    'Line': /Line\//i,
    'WeChat': /MicroMessenger/i,
    'Telegram': /TelegramBot/i,
    'Discord': /Discord/i,
  };
  
  for (const [name, pattern] of Object.entries(inAppPatterns)) {
    if (pattern.test(ua)) {
      logCheckout('In-app browser detected:', name);
      return { isInApp: true, browser: name };
    }
  }
  
  // Generic WebView detection
  if (/wv|WebView/i.test(ua)) {
    logCheckout('Generic WebView detected');
    return { isInApp: true, browser: 'WebView' };
  }
  
  return { isInApp: false, browser: null };
};

/**
 * Detect if Safari or iOS (where UPI intents may have issues)
 */
export const detectSafariOrIOS = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  
  return isIOS || isSafari;
};

/**
 * Detect mobile devices (coarse pointer or mobile UA).
 * We prefer redirect checkout on mobile to avoid iframe/modal focus & selection conflicts.
 */
export const detectMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;

  try {
    if (window.matchMedia?.('(pointer: coarse)').matches) return true;
  } catch {
    // ignore
  }

  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
};

/**
 * Check if Razorpay might be blocked by browser/extensions
 */
const detectPotentialBlocks = (): string[] => {
  const issues: string[] = [];
  const { isInApp, browser } = detectInAppBrowser();
  
  if (isInApp) {
    issues.push(`In-app browser (${browser}) may block UPI apps. Consider opening in external browser.`);
  }
  
  // Check if third-party cookies might be blocked (Safari)
  if (detectSafariOrIOS()) {
    issues.push('Safari/iOS may block third-party cookies. Using redirect mode for better compatibility.');
  }
  
  // Check if likely in private/incognito mode
  try {
    if (typeof localStorage === 'undefined' || localStorage === null) {
      issues.push('Private browsing mode may affect payment gateway.');
    }
  } catch {
    issues.push('Browser privacy settings may affect payment gateway.');
  }
  
  return issues;
};

/**
 * Preload Razorpay script on app initialization
 * Call this early (e.g., in App.tsx or Layout) to avoid delays at checkout
 */
export const preloadRazorpayScript = (): void => {
  if (typeof window === 'undefined') return;
  
  // Check if already loaded or loading
  if (isScriptLoaded || document.querySelector(`script[src="${RAZORPAY_SCRIPT_URL}"]`)) {
    logCheckout('Script already loaded or loading');
    return;
  }
  
  logCheckout('Preloading Razorpay script...');
  
  // Add preload link hint for faster loading
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'script';
  link.href = RAZORPAY_SCRIPT_URL;
  link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
  
  // Start loading the script in background
  loadRazorpayScript().catch((err) => {
    logCheckout('Preload failed:', err);
  });
};

/**
 * Core script loading function - singleton pattern ensures single load
 */
const loadRazorpayScript = (): Promise<boolean> => {
  // Already loaded
  if (isScriptLoaded && window.Razorpay) {
    logCheckout('Script already available');
    return Promise.resolve(true);
  }

  // Loading in progress
  if (scriptLoadPromise) {
    logCheckout('Script load already in progress');
    return scriptLoadPromise;
  }

  logCheckout('Starting script load...');
  scriptLoadAttempts++;

  scriptLoadPromise = new Promise((resolve) => {
    // Double-check if already loaded
    if (window.Razorpay) {
      logCheckout('Razorpay already on window');
      isScriptLoaded = true;
      resolve(true);
      return;
    }

    // Remove any existing failed scripts
    const existingScript = document.querySelector(`script[src="${RAZORPAY_SCRIPT_URL}"]`);
    if (existingScript) {
      logCheckout('Removing existing script for retry');
      existingScript.remove();
    }

    // Create script element with proper attributes for cross-origin loading
    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.crossOrigin = 'anonymous';
    
    // Set up timeout
    const timeoutId = setTimeout(() => {
      logCheckout('Script load timeout');
      scriptLoadPromise = null;
      resolve(false);
    }, SCRIPT_LOAD_TIMEOUT);

    script.onload = () => {
      clearTimeout(timeoutId);
      logCheckout('Script loaded successfully');
      
      // Wait for Razorpay to initialize on window
      const checkRazorpay = (retries = 10) => {
        if (window.Razorpay) {
          logCheckout('Razorpay initialized on window');
          isScriptLoaded = true;
          resolve(true);
        } else if (retries > 0) {
          setTimeout(() => checkRazorpay(retries - 1), 100);
        } else {
          logCheckout('Razorpay not available after script load');
          scriptLoadPromise = null;
          resolve(false);
        }
      };
      checkRazorpay();
    };

    script.onerror = (error) => {
      clearTimeout(timeoutId);
      logCheckout('Script load error:', error);
      scriptLoadPromise = null;
      resolve(false);
    };

    document.head.appendChild(script);
  });

  return scriptLoadPromise;
};

/**
 * Get the base URL for payment callback (handles both preview and production)
 */
export const getPaymentCallbackUrl = (): string => {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/payment-callback`;
};

/**
 * Store checkout data before redirect for recovery after payment
 */
export const storeCheckoutData = (data: {
  orderId: string;
  cartData: unknown;
  buyerEmail: string;
  buyerName?: string;
  deliveryAddress?: unknown;
  promoterInfo?: unknown;
  finalTotal: number;
}) => {
  localStorage.setItem('pending_checkout_data', JSON.stringify({
    ...data,
    timestamp: Date.now()
  }));
  logCheckout('Checkout data stored for redirect recovery');
};

/**
 * Retrieve and clear stored checkout data after redirect
 */
export const retrieveCheckoutData = () => {
  const data = localStorage.getItem('pending_checkout_data');
  if (data) {
    const parsed = JSON.parse(data);
    // Only use if less than 30 minutes old
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

export interface UseRazorpayReturn {
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  isInAppBrowser: boolean;
  inAppBrowserName: string | null;
  openCheckout: (
    options: RazorpayOptions, 
    callbacks?: {
      onFailed?: () => void;
      onDismiss?: () => void;
      onReady?: () => void;
    },
    useRedirect?: boolean
  ) => Promise<void>;
  loadScript: () => Promise<boolean>;
  resetError: () => void;
  preload: () => void;
}

export function useRazorpay(): UseRazorpayReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(isScriptLoaded);
  const [error, setError] = useState<string | null>(null);
  const razorpayInstanceRef = useRef<RazorpayInstance | null>(null);
  const checkoutTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCheckoutOpenRef = useRef(false);
  
  // Detect in-app browser on mount
  const [inAppInfo] = useState(() => detectInAppBrowser());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (checkoutTimeoutRef.current) clearTimeout(checkoutTimeoutRef.current);
      if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
      
      if (razorpayInstanceRef.current && isCheckoutOpenRef.current) {
        try {
          razorpayInstanceRef.current.close();
        } catch {
          // Ignore close errors
        }
      }
    };
  }, []);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  const preload = useCallback(() => {
    preloadRazorpayScript();
  }, []);

  const loadScript = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      // Detect potential blocking issues first
      const issues = detectPotentialBlocks();
      if (issues.length > 0) {
        logCheckout('Potential issues detected:', issues);
      }

      const loaded = await loadRazorpayScript();
      setIsReady(loaded);
      
      if (!loaded) {
        const errorMsg = scriptLoadAttempts >= 3 
          ? 'Payment gateway unavailable. Please try a different browser or disable ad blockers.'
          : 'Failed to load payment gateway. Please check your internet connection.';
        setError(errorMsg);
        logCheckout('Script load failed', { attempts: scriptLoadAttempts });
      } else {
        logCheckout('Script load successful');
      }
      
      return loaded;
    } catch (err) {
      logCheckout('Error loading script:', err);
      setError('Failed to initialize payment gateway');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const openCheckout = useCallback(async (
    options: RazorpayOptions,
    callbacks?: {
      onFailed?: () => void;
      onDismiss?: () => void;
      onReady?: () => void;
    },
    useRedirect?: boolean
  ): Promise<void> => {
    logCheckout('openCheckout called', { 
      order_id: options.order_id,
      useRedirect,
      isInAppBrowser: inAppInfo.isInApp
    });
    
    // Defensive check: Ensure order_id exists
    if (!options.order_id) {
      const errorMsg = 'Payment order not created. Please try again.';
      setError(errorMsg);
      toast.error(errorMsg);
      logCheckout('ERROR: No order_id provided');
      callbacks?.onFailed?.();
      return;
    }

    setIsLoading(true);
    setError(null);
    isCheckoutOpenRef.current = false;

    try {
      // Load script with retries
      let scriptReady = isScriptLoaded && !!window.Razorpay;
      const maxAttempts = 3;
      
      for (let attempt = 1; attempt <= maxAttempts && !scriptReady; attempt++) {
        logCheckout(`Loading script, attempt ${attempt}/${maxAttempts}`);
        
        // Reset promise for retry
        if (attempt > 1) {
          scriptLoadPromise = null;
        }
        
        scriptReady = await loadScript();
        
        if (!scriptReady && attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
        }
      }

      if (!window.Razorpay) {
        const errorMsg = 'Payment gateway unavailable. Please try again, use a different browser, or disable ad blockers.';
        setError(errorMsg);
        toast.error(errorMsg);
        logCheckout('ERROR: Razorpay not available after retries');
        callbacks?.onFailed?.();
        setIsLoading(false);
        return;
      }

      // Determine if we should use redirect based on environment
      // IMPORTANT: For mobile devices and in-app browsers, use popup mode first
      // because redirect mode often fails in WebViews. If popup fails, show error.
      // Desktop: prefer popup for better UX. Redirect only if explicitly requested.
      const shouldUseRedirect = useRedirect === true;
      
      logCheckout('Checkout mode:', shouldUseRedirect ? 'REDIRECT' : 'POPUP');

      // Enhanced options for better stability - DISABLE SMART RECOMMENDATIONS
      const enhancedOptions: RazorpayOptions = {
        ...options,
        // Disable smart recommendations which cause UPI intent freezing
        config: {
          display: {
            preferences: {
              show_default_blocks: true, // Use standard payment blocks
            },
          },
        },
        modal: {
          ondismiss: () => {
            logCheckout('Modal dismissed by user');
            isCheckoutOpenRef.current = false;
            setIsLoading(false);
            if (checkoutTimeoutRef.current) clearTimeout(checkoutTimeoutRef.current);
            if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
            callbacks?.onDismiss?.();
            options.modal?.ondismiss?.();
          },
          escape: true,
          backdropclose: false,
          confirm_close: true,
        },
        retry: {
          enabled: true,
          max_count: 3,
        },
        timeout: 300, // 5 minutes
      };

      // For redirect mode, set callback_url and redirect flag
      if (shouldUseRedirect) {
        enhancedOptions.callback_url = getPaymentCallbackUrl();
        enhancedOptions.redirect = true;
        logCheckout('Using redirect mode with callback:', enhancedOptions.callback_url);
      }

      // Wrap handler to track completion (only for popup mode)
      if (!shouldUseRedirect) {
        const originalHandler = enhancedOptions.handler;
        enhancedOptions.handler = (response) => {
          logCheckout('Payment completed', { 
            payment_id: response.razorpay_payment_id,
            order_id: response.razorpay_order_id 
          });
          
          if (checkoutTimeoutRef.current) clearTimeout(checkoutTimeoutRef.current);
          if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
          isCheckoutOpenRef.current = false;
          setIsLoading(false);
          originalHandler(response);
        };
      }

      // Create Razorpay instance
      logCheckout('Creating Razorpay instance...', {
        key: options.key?.substring(0, 10) + '...',
        amount: options.amount,
        order_id: options.order_id,
        redirect: shouldUseRedirect
      });
      
      const razorpay = new window.Razorpay(enhancedOptions);
      razorpayInstanceRef.current = razorpay;

      // Set up failure handler
      razorpay.on('payment.failed', (response: unknown) => {
        logCheckout('Payment failed:', response);
        isCheckoutOpenRef.current = false;
        setIsLoading(false);
        if (checkoutTimeoutRef.current) clearTimeout(checkoutTimeoutRef.current);
        if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
        toast.error('Payment failed. Please try again.');
        callbacks?.onFailed?.();
      });

      // Track ready event - this fires when checkout is fully loaded
      razorpay.on('ready', () => {
        logCheckout('Checkout ready and responsive');
        if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
        callbacks?.onReady?.();
      });

      // Set up freeze detection - if ready doesn't fire in time
      readyTimeoutRef.current = setTimeout(() => {
        if (isCheckoutOpenRef.current) {
          logCheckout('WARN: Checkout may be frozen - ready event not received');
          
          // Show helpful message based on environment
          if (inAppInfo.isInApp) {
            toast.info(
              `Payment may not work in ${inAppInfo.browser}. Tap ⋮ menu → "Open in browser" for best experience.`,
              { duration: 20000 }
            );
          } else {
            toast.info(
              'Payment screen loading slowly. If frozen, close and retry.',
              { duration: 15000 }
            );
          }
        }
      }, CHECKOUT_READY_TIMEOUT);

      // Additional timeout for complete unresponsiveness
      checkoutTimeoutRef.current = setTimeout(() => {
        if (isCheckoutOpenRef.current) {
          logCheckout('WARN: Checkout likely frozen after extended period');
          toast.warning(
            'Payment gateway may be blocked. Try opening in your default browser.',
            { duration: 20000 }
          );
        }
      }, CHECKOUT_READY_TIMEOUT * 2);

      // Open checkout
      logCheckout('Opening checkout...');
      isCheckoutOpenRef.current = true;

      // Defensive focus management:
      // Some browsers keep focus/selection on underlying inputs, causing taps to be treated as background interaction.
      // We blur any active element and then try to focus Razorpay's injected iframe/container.
      try {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      } catch {
        // ignore
      }

      razorpay.open();
      logCheckout('Checkout open command issued');

      const focusRazorpayFrame = () => {
        try {
          const container = document.querySelector<HTMLElement>('.razorpay-container');
          const iframe =
            container?.querySelector<HTMLIFrameElement>('iframe') ||
            Array.from(document.querySelectorAll('iframe')).find((f) =>
              (f.src || '').toLowerCase().includes('razorpay')
            );

          // Focusing the iframe is allowed even if it's cross-origin.
          iframe?.focus?.();
        } catch {
          // ignore
        }
      };

      // Try a couple times in case Razorpay injects asynchronously.
      setTimeout(focusRazorpayFrame, 0);
      setTimeout(focusRazorpayFrame, 250);

    } catch (err) {
      logCheckout('ERROR opening checkout:', err);
      const errorMsg = 'Failed to open payment gateway. Please refresh and try again.';
      setError(errorMsg);
      toast.error(errorMsg);
      callbacks?.onFailed?.();
      setIsLoading(false);
    }
  }, [loadScript, inAppInfo]);

  return {
    isLoading,
    isReady,
    error,
    isInAppBrowser: inAppInfo.isInApp,
    inAppBrowserName: inAppInfo.browser,
    openCheckout,
    loadScript,
    resetError,
    preload,
  };
}

/**
 * Hook to preload Razorpay on component mount
 * Use this in Layout or checkout-related pages
 */
export function useRazorpayPreload(): void {
  useEffect(() => {
    logCheckout('useRazorpayPreload: Initializing preload');
    preloadRazorpayScript();
  }, []);
}
