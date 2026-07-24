'use client';

import { useEffect } from 'react';

const ENABLE_PARAM = 'perf';
const STORAGE_KEY = 'tikplay:performance-observer';

function isEnabled(): boolean {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get(ENABLE_PARAM);
  if (requested === '1') {
    window.localStorage.setItem(STORAGE_KEY, '1');
    return true;
  }
  if (requested === '0') {
    window.localStorage.removeItem(STORAGE_KEY);
    return false;
  }
  return window.localStorage.getItem(STORAGE_KEY) === '1';
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export default function PerformanceObserver() {
  useEffect(() => {
    let enabled = false;
    try {
      enabled = isEnabled();
    } catch {
      return;
    }
    if (!enabled) return;

    const navigation = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (navigation) {
      console.info('[TikPlay performance] navigation', {
        ttfb: round(navigation.responseStart - navigation.requestStart),
        htmlDownload: round(navigation.responseEnd - navigation.responseStart),
        domInteractive: round(navigation.domInteractive),
        domContentLoaded: round(navigation.domContentLoadedEventEnd),
        load: round(navigation.loadEventEnd),
        transferSize: navigation.transferSize,
        encodedBodySize: navigation.encodedBodySize,
      });
    }

    if (!('PerformanceObserver' in window)) return;
    const observer = new window.PerformanceObserver((list) => {
      const entry = list.getEntries().at(-1) as
        | (PerformanceEntry & {
            element?: Element;
            renderTime?: number;
            loadTime?: number;
            size?: number;
            url?: string;
          })
        | undefined;
      if (!entry) return;
      const element = entry.element;
      console.info('[TikPlay performance] LCP', {
        value: round(entry.renderTime || entry.loadTime || entry.startTime),
        size: entry.size,
        element: element?.tagName?.toLowerCase(),
        id: element?.id || undefined,
        className:
          typeof element?.className === 'string'
            ? element.className.slice(0, 160)
            : undefined,
        resourceType: entry.url ? 'image' : 'text',
      });
    });

    try {
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      return;
    }
    return () => observer.disconnect();
  }, []);

  return null;
}
