import { useCallback, useLayoutEffect, useState } from 'react';

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
 *
 * Default behavior is "fit to width": pixelsPerWeek is derived live from the
 * measured width of whatever element `containerRef` is attached to (via
 * ResizeObserver), so the whole timeline always exactly fills the available
 * space with no manual zoom needed. That derived value is clamped to
 * [MIN_PX_PER_WEEK, MAX_PX_PER_WEEK] — for a very long timeline, fitting
 * would require going narrower than MIN_PX_PER_WEEK, so instead of shrinking
 * further the chart holds at the floor and overflows its container (the
 * page then scrolls horizontally, rather than the ticks becoming illegible).
 * zoomIn/zoomOut/reset let the user override the fit with an explicit value;
 * reset clears the override and returns to auto-fit.
 */
export function useZoom(totalDurationWeeks: number, labelColWidth: number) {
  // A callback ref, not useRef: the element this attaches to is often
  // rendered conditionally further down the tree (e.g. GanttChart only
  // mounts once its data has loaded), sometimes well after this hook's own
  // caller first mounts. A plain useRef + effect-with-empty-deps would only
  // ever check containerRef.current at the hook caller's own mount time —
  // too early, before that element exists — and then never look again, so
  // the ResizeObserver would never actually get attached. A callback ref
  // fires exactly when the DOM node attaches (whenever that happens), which
  // is what re-running this effect needs to key off of.
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const containerRef = useCallback((el: HTMLDivElement | null) => setContainer(el), []);
  const [containerWidth, setContainerWidth] = useState(0);
  const [manualPxPerWeek, setManualPxPerWeek] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!container) return;
    setContainerWidth(container.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [container]);

  const availableChartWidth = Math.max(0, containerWidth - labelColWidth);
  const fitPxPerWeek = totalDurationWeeks > 0 ? availableChartWidth / totalDurationWeeks : DEFAULT_PX_PER_WEEK;
  const rawPxPerWeek = manualPxPerWeek ?? fitPxPerWeek;
  const pixelsPerWeek = Math.min(MAX_PX_PER_WEEK, Math.max(MIN_PX_PER_WEEK, rawPxPerWeek || DEFAULT_PX_PER_WEEK));

  function zoomIn() {
    setManualPxPerWeek(Math.min(MAX_PX_PER_WEEK, pixelsPerWeek * ZOOM_STEP));
  }
  function zoomOut() {
    setManualPxPerWeek(Math.max(MIN_PX_PER_WEEK, pixelsPerWeek / ZOOM_STEP));
  }
  function reset() {
    setManualPxPerWeek(null);
  }

  return {
    pixelsPerWeek,
    zoomIn,
    zoomOut,
    reset,
    canZoomIn: pixelsPerWeek < MAX_PX_PER_WEEK,
    canZoomOut: pixelsPerWeek > MIN_PX_PER_WEEK,
    containerRef,
  };
}
