export interface MarkerTick {
  id: string;
  label: string;
  offsetWeeks: number;
}

/** Thin row of labels sitting above the header, one per marker, at its x-position. */
export function MarkerLabelsRow({ markers, pixelsPerWeek }: { markers: MarkerTick[]; pixelsPerWeek: number }) {
  if (markers.length === 0) return null;
  return (
    <div className="relative h-5">
      {markers.map((m) => (
        <div
          key={m.id}
          className="absolute top-0 text-[10px] font-medium text-rose-600 whitespace-nowrap px-1 -translate-x-1/2"
          style={{ left: `${m.offsetWeeks * pixelsPerWeek}px` }}
          title={m.label}
        >
          {m.label}
        </div>
      ))}
    </div>
  );
}

/** Full-height vertical lines overlay — render as the last child of a `position: relative` ancestor spanning the whole chart. */
export function MarkerLines({
  markers,
  pixelsPerWeek,
  labelColWidth,
}: {
  markers: MarkerTick[];
  pixelsPerWeek: number;
  labelColWidth: number;
}) {
  if (markers.length === 0) return null;
  return (
    <div className="absolute inset-0 pointer-events-none">
      {markers.map((m) => (
        <div
          key={m.id}
          className="absolute top-0 bottom-0 border-l-2 border-rose-400"
          style={{ left: `${labelColWidth + m.offsetWeeks * pixelsPerWeek}px` }}
        />
      ))}
    </div>
  );
}
