'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { loadMaritimeCache, saveMaritimeCache } from '@/app/service/maritimeCache';
import { AUTO_REFRESH_MS, INDONESIA_MARINE_REGIONS } from './constants';
import { fetchRegionWaveData, fetchWindField } from './services';
import type { WaveRegionPoint, WindFieldGrid, WindFieldMeta } from './types';

export interface WaveMapData {
  regionPoints: WaveRegionPoint[];
  windGrid: WindFieldGrid | null;
  windFieldMeta: WindFieldMeta | null;
  lastUpdatedTime: string;
  autoRefreshCountdown: number;
  isLoading: boolean;
  isRefreshing: boolean;
  fetchError: boolean;
  refreshAll: (force?: boolean) => Promise<void>;
}

export function useWaveMapData(): WaveMapData {
  const countdownRef = useRef(AUTO_REFRESH_MS / 1000);

  const [windGrid, setWindGrid] = useState<WindFieldGrid | null>(null);
  const [windFieldMeta, setWindFieldMeta] = useState<WindFieldMeta | null>(null);
  const [regionPoints, setRegionPoints] = useState<WaveRegionPoint[]>(
    INDONESIA_MARINE_REGIONS.map((r) => ({ ...r, loading: true }))
  );
  const [lastUpdatedTime, setLastUpdatedTime] = useState('');
  const [autoRefreshCountdown, setAutoRefreshCountdown] = useState(AUTO_REFRESH_MS / 1000);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const refreshAll = useCallback(async (force = false) => {
    setIsRefreshing(true);
    setIsLoading(false);

    const [regionResult, windResult] = await Promise.all([
      fetchRegionWaveData(force),
      fetchWindField(force),
    ]);

    setRegionPoints(regionResult.points);
    setFetchError(regionResult.allFailed);
    if (windResult.grid && windResult.meta) {
      setWindGrid(windResult.grid);
      setWindFieldMeta(windResult.meta);
    }

    // Persist the latest successful snapshot to Firestore (best-effort).
    // When all region requests fail, keep last-known data instead of overwriting.
    if (!regionResult.allFailed) {
      saveMaritimeCache(regionResult.points, windResult.grid, windResult.meta);
    }

    setLastUpdatedTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    countdownRef.current = AUTO_REFRESH_MS / 1000;
    setAutoRefreshCountdown(countdownRef.current);
    setIsRefreshing(false);
  }, []);

  // Seed instantly from the last Firestore snapshot (if any), then fetch fresh
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await loadMaritimeCache();
      if (cancelled || !cached) return;
      if (cached.points?.length) {
        setRegionPoints(cached.points);
        setFetchError(false);
      }
      if (cached.grid && cached.meta) {
        setWindGrid(cached.grid);
        setWindFieldMeta(cached.meta);
      }
      const savedAtMs = cached.savedAt
        ? typeof (cached.savedAt as { toMillis?: () => number }).toMillis === 'function'
          ? (cached.savedAt as { toMillis: () => number }).toMillis()
          : Date.parse(String(cached.savedAt))
        : NaN;
      if (!Number.isNaN(savedAtMs)) {
        setLastUpdatedTime(new Date(savedAtMs).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Initial load
  useEffect(() => {
    const timer = setTimeout(() => refreshAll(false), 0);
    return () => clearTimeout(timer);
  }, [refreshAll]);

  // Auto-refresh countdown (tick every second)
  useEffect(() => {
    const interval = setInterval(() => {
      countdownRef.current -= 1;
      if (countdownRef.current <= 0) {
        countdownRef.current = AUTO_REFRESH_MS / 1000;
        refreshAll(false);
      }
      setAutoRefreshCountdown(countdownRef.current);
    }, 1000);
    return () => clearInterval(interval);
  }, [refreshAll]);

  return {
    regionPoints,
    windGrid,
    windFieldMeta,
    lastUpdatedTime,
    autoRefreshCountdown,
    isLoading,
    isRefreshing,
    fetchError,
    refreshAll,
  };
}
