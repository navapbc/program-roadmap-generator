export default function ZoomControl({
  onZoomIn,
  onZoomOut,
  onReset,
  canZoomIn,
  canZoomOut,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className="w-6 h-6 flex items-center justify-center border border-slate-300 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-30"
        onClick={onZoomOut}
        disabled={!canZoomOut}
        title="Zoom out"
      >
        −
      </button>
      <button
        type="button"
        className="w-6 h-6 flex items-center justify-center border border-slate-300 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-30"
        onClick={onZoomIn}
        disabled={!canZoomIn}
        title="Zoom in"
      >
        +
      </button>
      <button
        type="button"
        className="text-xs text-slate-500 hover:text-slate-900 ml-1"
        onClick={onReset}
        title="Reset zoom"
      >
        Reset
      </button>
    </div>
  );
}
