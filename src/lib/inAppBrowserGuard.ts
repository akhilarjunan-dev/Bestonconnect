/**
 * In-App Browser Detection and Guard
 * Detects restricted browsers (Instagram, Facebook, WhatsApp, Telegram, etc.)
 * and blocks payment attempts with helpful messaging.
 */

// Browser detection patterns
const IN_APP_PATTERNS: Record<string, RegExp> = {
  'Instagram': /Instagram/i,
  'Facebook': /FBAN|FBAV|FB_IAB/i,
  'WhatsApp': /WhatsApp/i,
  'Telegram': /TelegramBot|Telegram/i,
  'Twitter/X': /Twitter/i,
  'LinkedIn': /LinkedInApp/i,
  'Snapchat': /Snapchat/i,
  'Pinterest': /Pinterest/i,
  'TikTok': /BytedanceWebview|TikTok/i,
  'Line': /Line\//i,
  'WeChat': /MicroMessenger/i,
  'Discord': /Discord/i,
};

export interface InAppBrowserInfo {
  isInApp: boolean;
  browserName: string | null;
}

/**
 * Detect if running in an in-app browser
 * These browsers have restricted cookie/popup/intent handling that breaks payments
 */
export function detectInAppBrowser(): InAppBrowserInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { isInApp: false, browserName: null };
  }

  const ua = navigator.userAgent || (navigator as any).vendor || '';

  for (const [name, pattern] of Object.entries(IN_APP_PATTERNS)) {
    if (pattern.test(ua)) {
      console.log('[InAppGuard] Detected in-app browser:', name);
      return { isInApp: true, browserName: name };
    }
  }

  // Generic WebView detection
  if (/wv|WebView/i.test(ua)) {
    console.log('[InAppGuard] Detected generic WebView');
    return { isInApp: true, browserName: 'WebView' };
  }

  return { isInApp: false, browserName: null };
}

/**
 * Check if payment should be blocked
 */
export function shouldBlockPayment(): { blocked: boolean; reason: string | null } {
  const { isInApp, browserName } = detectInAppBrowser();
  
  if (isInApp) {
    return {
      blocked: true,
      reason: `For secure payment, please open this page in Chrome or Safari. ${browserName} browser does not support secure payments.`
    };
  }

  return { blocked: false, reason: null };
}

/**
 * Get instructions for opening in external browser based on detected browser
 */
export function getExternalBrowserInstructions(browserName: string | null): string {
  switch (browserName) {
    case 'Instagram':
      return 'Tap the ⋮ menu in the top right → "Open in browser"';
    case 'Facebook':
      return 'Tap the ⋮ menu → "Open in Chrome" or "Open in Safari"';
    case 'WhatsApp':
      return 'Tap the ⋮ menu → "Open in browser"';
    case 'Telegram':
      return 'Tap the ⋮ menu → "Open in external browser"';
    case 'Twitter/X':
      return 'Tap the share icon → "Open in Safari/Chrome"';
    default:
      return 'Copy the link and paste it in Chrome or Safari';
  }
}
