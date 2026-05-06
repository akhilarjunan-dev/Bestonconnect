import { useEffect } from 'react';

interface PaymentOverlayProps {
  isActive: boolean;
  children?: React.ReactNode;
}

/**
 * PaymentOverlay creates a full-screen blocking layer when payment is in progress.
 * This prevents any touch/click events from reaching underlying form inputs,
 * which can cause the Razorpay checkout to freeze on mobile devices.
 * 
 * The overlay:
 * - Blocks all pointer events on the background
 * - Prevents any focusable elements from receiving focus
 * - Uses high z-index but below Razorpay (which uses 99999+)
 */
export function PaymentOverlay({ isActive, children }: PaymentOverlayProps) {
  useEffect(() => {
    if (isActive) {
      const root = document.getElementById('root');

      // Blur any currently focused element
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      // Make the React app subtree inert so it can't receive focus/click/selection.
      // Razorpay injects its UI outside of #root, so it remains interactive.
      root?.setAttribute('inert', '');
      root?.setAttribute('aria-hidden', 'true');

      // Extra defense: if anything inside #root tries to focus while payment is active, immediately blur.
      const handleFocusIn = (e: FocusEvent) => {
        const target = e.target as HTMLElement | null;
        if (target && root?.contains(target)) {
          target.blur?.();
        }
      };
      document.addEventListener('focusin', handleFocusIn, true);
      
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
      
      // Add a class to body to help with additional styling if needed
      document.body.classList.add('payment-in-progress');
      
      return () => {
        document.removeEventListener('focusin', handleFocusIn, true);

        root?.removeAttribute('inert');
        root?.removeAttribute('aria-hidden');

        document.body.style.overflow = '';
        document.body.classList.remove('payment-in-progress');
      };
    }
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div 
      // Keep this *below* Razorpay's injected container so we never steal clicks.
      // Razorpay typically uses very high z-index (often 9999+). We stay just under.
      className="fixed inset-0 bg-background/80 z-[9998]"
      style={{ 
        touchAction: 'none',
        pointerEvents: 'all',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      {/* Content shown during payment */}
      <div className="flex flex-col items-center justify-center h-full">
        <div className="animate-pulse text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">Processing Payment</h3>
          <p className="text-muted-foreground text-sm">
            Please complete the payment in the Razorpay window
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
