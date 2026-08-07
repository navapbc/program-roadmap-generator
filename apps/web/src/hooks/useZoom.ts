import { useState } from 'react';

const MIN_PX_PER_WEEK = 4;
const MAX_PX_PER_WEEK = 200;
const DEFAULT_PX_PER_WEEK = 24;
const ZOOM_STEP = 1.4;

/**
 * Drives the Gantt's horizontal scale in real pixels-per-week rather than a
 * percentage of the viewport — the same mechanism fixes both zoom (bars and
 * ticks can be made wider) and header readability (ticks stop being
 * squeezed into illegible slivers on long timelines), since both come down
 * to "how many pixels does a week get."
 */
export function useZoom(initial = DEFAULT_PX_PER_WEEK) {
  const [pixelsPerWeek, setPixelsPerWeek] = useState(initial);

  function zoomIn() {
    setPixelsPerWeek((px) => Math.min(MAX_PX_PER_WEEK, px * ZOOM_STEP));
  }
  function zoomOut() {
    setPixelsPerWeek((px) => Math.max(MIN_PX_PER_WEEK, px / ZOOM_STEP));
  }
  function reset() {
    setPixelsPerWeek(DEFAULT_PX_PER_WEEK);
  }

  return {
    pixelsPerWeek,
    zoomIn,
    zoomOut,
    reset,
    canZoomIn: pixelsPerWeek < MAX_PX_PER_WEEK,
    canZoomOut: pixelsPerWeek > MIN_PX_PER_WEEK,
  };
}
