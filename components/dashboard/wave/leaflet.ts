declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    L: any;
  }
}

/** Access the Leaflet global once its script has loaded */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getLeaflet(): any {
  return window.L;
}

export {};
