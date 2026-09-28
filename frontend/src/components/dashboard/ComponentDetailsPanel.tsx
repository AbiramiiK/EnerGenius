import type { ReactNode } from "react";
import { MousePointerClick } from "lucide-react";

export interface PanelInfo {
  icon: ReactNode;
  title: string;
  rows: [string, string][];
}

/** Persistent right-side details panel for the selected microgrid component
 * (not a floating overlay) — shows a placeholder when nothing is selected. */
export default function ComponentDetailsPanel({ info, compact }: { info: PanelInfo | null; compact?: boolean }) {
  return (
    <div className={`shrink-0 rounded-xl border border-sage bg-surface p-3 text-xs flex flex-col ${compact ? "w-full lg:w-56" : "w-full lg:w-64"}`}>
      {info ? (
        <>
          <div className="flex items-center gap-2 font-semibold text-sm text-text-primary mb-3 pb-2 border-b border-sage/60">
            {info.icon}{info.title}
          </div>
          <div className="space-y-2">
            {info.rows.map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <span className="text-text-secondary">{label}</span>
                <span className="font-medium text-text-primary">{value}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-6 text-text-secondary">
          <MousePointerClick size={20} className="mb-2 opacity-60" />
          <p>Select a component in the scene<br />to inspect its live values.</p>
        </div>
      )}
    </div>
  );
}
