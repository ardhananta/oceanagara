'use client';

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { sampleWindFromPoints, sampleWindGrid, windStrokeColor } from './calculations';
import { getLeaflet } from './leaflet';
import type { WaveRegionPoint, WindFieldGrid } from './types';
import type { MapViewMode } from './useMapLayers';

interface UseVelocityCanvasParams {
  leafletReady: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapInstanceRef: RefObject<any>;
  mapViewMode: MapViewMode;
  regionPoints: WaveRegionPoint[];
  windGrid: WindFieldGrid | null;
}

interface StreamParticle {
  x: number;
  y: number;
  age: number;
  maxAge: number;
}

/**
 * Native canvas velocity streamline engine (matching Leaflet-Velocity & Windy).
 * Animates wind vector flow as moving particles with arrowheads.
 */
export function useVelocityCanvas({ leafletReady, mapInstanceRef, mapViewMode, regionPoints, windGrid }: UseVelocityCanvasParams) {
  const animFrameIdRef = useRef<number | null>(null);
  const canvasOverlayRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!leafletReady || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    const L = getLeaflet();

    // Cleanup previous canvas & animation frame
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (canvasOverlayRef.current && canvasOverlayRef.current.parentNode) {
      canvasOverlayRef.current.parentNode.removeChild(canvasOverlayRef.current);
      canvasOverlayRef.current = null;
    }

    if (mapViewMode !== 'wind') return;

    // Create Canvas overlay
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '400';

    const overlayPane = map.getPanes().overlayPane;
    overlayPane.appendChild(canvas);
    canvasOverlayRef.current = canvas;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: StreamParticle[] = [];

    const resetParticle = (p: Partial<StreamParticle> = {}): StreamParticle => {
      const size = map.getSize();
      return {
        x: p.x ?? Math.random() * size.x,
        y: p.y ?? Math.random() * size.y,
        age: p.age ?? Math.floor(Math.random() * 80),
        maxAge: 60 + Math.floor(Math.random() * 60),
      };
    };

    const updateCanvasSize = () => {
      const size = map.getSize();
      const dpr = window.devicePixelRatio || 1;

      // DPI-aware canvas for crisp lines on retina displays
      canvas.width = size.x * dpr;
      canvas.height = size.y * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const topLeft = map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(canvas, topLeft);

      // Adaptive particle density based on visible area
      const area = size.x * size.y;
      const count = Math.max(220, Math.min(700, Math.round(area / 1800)));
      particles = Array.from({ length: count }, () => resetParticle());
    };

    updateCanvasSize();

    map.on('moveend zoomend resize', updateCanvasSize);

    // Particle Flow Animation Loop
    const drawVelocityFrame = () => {
      const size = map.getSize();

      // Semi-transparent overlay to create smooth particle trails
      ctx.globalCompositeOperation = 'destination-in';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.92)';
      ctx.fillRect(0, 0, size.x, size.y);
      ctx.globalCompositeOperation = 'source-over';

      particles.forEach((p, idx) => {
        if (p.age > p.maxAge || p.x < 0 || p.x > size.x || p.y < 0 || p.y > size.y) {
          particles[idx] = resetParticle();
          return;
        }

        // Convert pixel to LatLng and sample wind vector
        const latLng = map.containerPointToLatLng(L.point(p.x, p.y));

        // Use real BMKG grid if available, else fallback to IDW
        const vec = windGrid
          ? sampleWindGrid(latLng.lat, latLng.lng, windGrid)
          : sampleWindFromPoints(latLng.lat, latLng.lng, regionPoints);

        // Movement scale factor
        const scale = 0.45;
        const dx = vec.u * scale;
        const dy = -vec.v * scale; // screen Y is inverted

        const nextX = p.x + dx;
        const nextY = p.y + dy;

        // Color based on wind speed knots
        const strokeColor = windStrokeColor(vec.speedKnots);

        // Draw Streamline Path Line
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(nextX, nextY);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Draw Panah Vector Arrowhead along streamline
        if (p.age % 14 === 0) {
          const angle = Math.atan2(dy, dx);
          const arrowLen = 7;
          ctx.beginPath();
          ctx.moveTo(nextX, nextY);
          ctx.lineTo(
            nextX - arrowLen * Math.cos(angle - Math.PI / 6),
            nextY - arrowLen * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            nextX - arrowLen * Math.cos(angle + Math.PI / 6),
            nextY - arrowLen * Math.sin(angle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fillStyle = strokeColor;
          ctx.fill();
        }

        p.x = nextX;
        p.y = nextY;
        p.age += 1;
      });

      animFrameIdRef.current = requestAnimationFrame(drawVelocityFrame);
    };

    animFrameIdRef.current = requestAnimationFrame(drawVelocityFrame);

    // Pause animation when tab is hidden (saves CPU)
    const onVisibilityChange = () => {
      if (document.hidden) {
        if (animFrameIdRef.current) {
          cancelAnimationFrame(animFrameIdRef.current);
          animFrameIdRef.current = null;
        }
      } else if (!animFrameIdRef.current) {
        animFrameIdRef.current = requestAnimationFrame(drawVelocityFrame);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      map.off('moveend zoomend resize', updateCanvasSize);
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      if (canvasOverlayRef.current && canvasOverlayRef.current.parentNode) {
        canvasOverlayRef.current.parentNode.removeChild(canvasOverlayRef.current);
        canvasOverlayRef.current = null;
      }
    };
  }, [leafletReady, mapViewMode, regionPoints, windGrid, mapInstanceRef]);

  return animFrameIdRef;
}
