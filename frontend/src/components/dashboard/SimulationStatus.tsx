import { Badge } from "../ui/Primitives";
import type { SimState } from "./types";

export const STATUS_META: Record<SimState, { label: string; tone: "neutral" | "success" | "warning" | "danger" | "info"; defaultDetail: string; dot: string }> = {
  ready: { label: "Ready", tone: "neutral", defaultDetail: "Awaiting a simulation run.", dot: "bg-text-secondary" },
  running: { label: "Running…", tone: "info", defaultDetail: "Solving the dispatch plan.", dot: "bg-grid" },
  optimized: { label: "Optimized", tone: "success", defaultDetail: "Dispatch plan generated successfully.", dot: "bg-emerald" },
  warning: { label: "Warning", tone: "warning", defaultDetail: "Schedule generated with a validation warning.", dot: "bg-warning" },
  infeasible: { label: "Infeasible", tone: "danger", defaultDetail: "No feasible dispatch plan could be found for this scenario.", dot: "bg-danger" },
};

export default function SimulationStatus({
  status, detail, simulated,
}: { status: SimState; detail?: string | null; simulated?: boolean }) {
  const meta = STATUS_META[status];
  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
        <Badge tone={meta.tone}>{meta.label.toUpperCase()}</Badge>
        {simulated && <Badge tone="neutral">Simulated</Badge>}
      </div>
      <p className="text-xs text-text-secondary mt-1 max-w-md">{detail || meta.defaultDetail}</p>
    </div>
  );
}
