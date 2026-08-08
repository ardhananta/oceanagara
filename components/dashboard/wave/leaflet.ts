declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    L: any;
  }
}

// Shared Leaflet loader — same promise for all remounts, so the script is only
// injected once and components never mark "ready" before the JS is actually loaded.
let leafletPromise: Promise<void> | null = null;

export function loadLeaflet(): Promise<void> {
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || window.L) {
      resolve();
      return;
    }

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const script = document.createElement('script');
    script.id = 'leaflet-js';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => resolve();
    script.onerror = () => {
      leafletPromise = null; // allow retry on next mount
      reject(new Error('Gagal memuat Leaflet dari CDN'));
    };
    document.head.appendChild(script);
  });

  return leafletPromise;
}

/** Access the Leaflet global once its script has loaded */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getLeaflet(): any {
  return window.L;
}

export {};
