/**
 * Performance Monitoring Utilities
 * 
 * Track and report performance metrics for optimization
 */

// Performance mark names
export const PERFORMANCE_MARKS = {
  // Page load metrics
  PAGE_LOAD_START: 'page-load-start',
  PAGE_LOAD_END: 'page-load-end',
  
  // Component mount metrics
  COMPONENT_MOUNT_START: 'component-mount-start',
  COMPONENT_MOUNT_END: 'component-mount-end',
  
  // API request metrics
  API_REQUEST_START: 'api-request-start',
  API_REQUEST_END: 'api-request-end',
  
  // Image loading metrics
  IMAGE_LOAD_START: 'image-load-start',
  IMAGE_LOAD_END: 'image-load-end',
  
  // User interaction metrics
  INTERACTION_START: 'interaction-start',
  INTERACTION_END: 'interaction-end',
};

/**
 * Mark performance measurement start
 */
export const markStart = (name: string) => {
  if (typeof window !== 'undefined' && window.performance) {
    window.performance.mark(`${name}-start`);
  }
};

/**
 * Mark performance measurement end and measure duration
 */
export const markEnd = (name: string): number | null => {
  if (typeof window !== 'undefined' && window.performance) {
    window.performance.mark(`${name}-end`);
    
    try {
      const measure = window.performance.measure(
        name,
        `${name}-start`,
        `${name}-end`
      );
      
      return measure.duration;
    } catch (error) {
      console.warn(`Performance measurement failed for ${name}:`, error);
      return null;
    }
  }
  
  return null;
};

/**
 * Get all performance measures
 */
export const getAllMeasures = () => {
  if (typeof window !== 'undefined' && window.performance) {
    return window.performance.getEntriesByType('measure');
  }
  return [];
};

/**
 * Clear all performance marks and measures
 */
export const clearPerformanceData = () => {
  if (typeof window !== 'undefined' && window.performance) {
    window.performance.clearMarks();
    window.performance.clearMeasures();
  }
};

/**
 * Get Core Web Vitals
 */
export const getCoreWebVitals = () => {
  if (typeof window === 'undefined' || !window.performance) {
    return null;
  }

  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  const paint = performance.getEntriesByType('paint');
  
  return {
    // First Contentful Paint (FCP)
    fcp: paint.find((entry) => entry.name === 'first-contentful-paint')?.startTime || 0,
    
    // Largest Contentful Paint (LCP)
    // Note: Requires PerformanceObserver in production
    lcp: 0,
    
    // Time to First Byte (TTFB)
    ttfb: navigation?.responseStart - navigation?.requestStart || 0,
    
    // First Input Delay (FID)
    // Note: Requires PerformanceObserver in production
    fid: 0,
    
    // Cumulative Layout Shift (CLS)
    // Note: Requires PerformanceObserver in production
    cls: 0,
    
    // Page load time
    pageLoadTime: navigation?.loadEventEnd - navigation?.fetchStart || 0,
    
    // DOM content loaded
    domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.fetchStart || 0,
  };
};

/**
 * Log performance metrics to console (development only)
 */
export const logPerformanceMetrics = () => {
  if (import.meta.env.DEV) {
    const vitals = getCoreWebVitals();
    const measures = getAllMeasures();
    
    console.group('📊 Performance Metrics');
    
    if (vitals) {
      console.log('Core Web Vitals:', {
        FCP: `${vitals.fcp.toFixed(2)}ms`,
        TTFB: `${vitals.ttfb.toFixed(2)}ms`,
        PageLoad: `${vitals.pageLoadTime.toFixed(2)}ms`,
        DOMContentLoaded: `${vitals.domContentLoaded.toFixed(2)}ms`,
      });
    }
    
    if (measures.length > 0) {
      console.log('Custom Measures:');
      measures.forEach((measure) => {
        console.log(`  ${measure.name}: ${measure.duration.toFixed(2)}ms`);
      });
    }
    
    console.groupEnd();
  }
};

/**
 * Performance monitoring hook for React components
 */
export const usePerformanceMonitor = (componentName: string) => {
  const mountTime = React.useRef<number>(0);
  
  React.useEffect(() => {
    markStart(`${componentName}-mount`);
    mountTime.current = performance.now();
    
    return () => {
      const duration = markEnd(`${componentName}-mount`);
      if (duration !== null && import.meta.env.DEV) {
        console.log(`⏱️ ${componentName} mount time: ${duration.toFixed(2)}ms`);
      }
    };
  }, [componentName]);
  
  return {
    measureAction: (actionName: string, action: () => void) => {
      markStart(`${componentName}-${actionName}`);
      action();
      const duration = markEnd(`${componentName}-${actionName}`);
      
      if (duration !== null && import.meta.env.DEV) {
        console.log(`⏱️ ${componentName} ${actionName}: ${duration.toFixed(2)}ms`);
      }
    },
  };
};

/**
 * Monitor API request performance
 */
export const monitorAPIRequest = async <T,>(
  requestName: string,
  requestFn: () => Promise<T>
): Promise<T> => {
  markStart(`api-${requestName}`);
  
  try {
    const result = await requestFn();
    const duration = markEnd(`api-${requestName}`);
    
    if (duration !== null && import.meta.env.DEV) {
      console.log(`🌐 API ${requestName}: ${duration.toFixed(2)}ms`);
    }
    
    return result;
  } catch (error) {
    markEnd(`api-${requestName}`);
    throw error;
  }
};

/**
 * Track bundle size in development
 */
export const logBundleSize = () => {
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    
    let totalSize = 0;
    const breakdown: Record<string, number> = {};
    
    resources.forEach((resource) => {
      const size = resource.transferSize || 0;
      totalSize += size;
      
      const type = resource.initiatorType;
      breakdown[type] = (breakdown[type] || 0) + size;
    });
    
    console.group('📦 Bundle Size Analysis');
    console.log(`Total Size: ${(totalSize / 1024).toFixed(2)} KB`);
    console.log('Breakdown:');
    Object.entries(breakdown)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, size]) => {
        console.log(`  ${type}: ${(size / 1024).toFixed(2)} KB`);
      });
    console.groupEnd();
  }
};

/**
 * Report performance metrics to analytics
 * (Placeholder for production analytics integration)
 */
export const reportToAnalytics = (metrics: Record<string, number>) => {
  // In production, send to analytics service (Google Analytics, Mixpanel, etc.)
  if (import.meta.env.PROD) {
    // Example: gtag('event', 'performance', metrics);
    console.log('Analytics report:', metrics);
  }
};

/**
 * Initialize performance monitoring
 * Call this in your App root component
 */
export const initPerformanceMonitoring = () => {
  if (typeof window === 'undefined') return;
  
  // Log initial metrics after page load
  window.addEventListener('load', () => {
    setTimeout(() => {
      logPerformanceMetrics();
      logBundleSize();
      
      const vitals = getCoreWebVitals();
      if (vitals) {
        reportToAnalytics({
          fcp: vitals.fcp,
          ttfb: vitals.ttfb,
          pageLoadTime: vitals.pageLoadTime,
          domContentLoaded: vitals.domContentLoaded,
        });
      }
    }, 0);
  });
  
  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    clearPerformanceData();
  });
};

// React import (add this at the top of the file)
import React from 'react';
