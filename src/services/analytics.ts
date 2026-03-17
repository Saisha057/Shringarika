// Google Analytics 4 Integration
import ReactGA from 'react-ga4';

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-XXXXXXXXXX';

export const initGA = () => {
  ReactGA.initialize(MEASUREMENT_ID);
};

// Page view tracking
export const trackPageView = (path: string) => {
  ReactGA.send({ hitType: 'pageview', page: path });
};

// Event tracking
export const trackEvent = (category: string, action: string, label?: string, value?: number) => {
  ReactGA.event({
    category,
    action,
    label,
    value,
  });
};

// E-commerce tracking
export const trackPurchase = (transactionId: string, value: number, items: any[]) => {
  ReactGA.event('purchase', {
    transaction_id: transactionId,
    value,
    currency: 'INR',
    items,
  });
};

export const trackAddToCart = (item: any) => {
  ReactGA.event('add_to_cart', {
    currency: 'INR',
    value: item.price,
    items: [item],
  });
};

export const trackRemoveFromCart = (item: any) => {
  ReactGA.event('remove_from_cart', {
    currency: 'INR',
    value: item.price,
    items: [item],
  });
};

export const trackViewItem = (item: any) => {
  ReactGA.event('view_item', {
    currency: 'INR',
    value: item.price,
    items: [item],
  });
};

export const trackSearch = (searchTerm: string) => {
  ReactGA.event('search', {
    search_term: searchTerm,
  });
};

export const trackBeginCheckout = (items: any[], value: number) => {
  ReactGA.event('begin_checkout', {
    currency: 'INR',
    value,
    items,
  });
};

// Facebook Pixel Integration
declare global {
  interface Window {
    fbq: any;
  }
}

export const initFacebookPixel = () => {
  const pixelId = import.meta.env.VITE_FB_PIXEL_ID;
  if (!pixelId) return;

  (function(f: any, b: any, e: string, v: string, n?: any, t?: any, s?: any) {
    if (f.fbq) return;
    n = f.fbq = function() {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = '2.0';
    n.queue = [];
    t = b.createElement(e);
    t.async = !0;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  window.fbq('init', pixelId);
  window.fbq('track', 'PageView');
};

export const trackFBEvent = (eventName: string, params?: any) => {
  if (window.fbq) {
    window.fbq('track', eventName, params);
  }
};

export const trackFBPurchase = (value: number, currency: string = 'INR') => {
  trackFBEvent('Purchase', { value, currency });
};

export const trackFBAddToCart = (value: number, currency: string = 'INR') => {
  trackFBEvent('AddToCart', { value, currency });
};

export const trackFBInitiateCheckout = (value: number, currency: string = 'INR') => {
  trackFBEvent('InitiateCheckout', { value, currency });
};
