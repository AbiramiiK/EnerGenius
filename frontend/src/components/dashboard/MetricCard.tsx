import type { ReactNode } from "react";
import { Card } from "../ui/Primitives";

interface Props {
  label: string;
  value: string;
  unit?: string;
  tone?: string;
  icon?: ReactNode;
  statusTag?: string;
  unavailable?: boolean;
}

/** Compact KPI tile. Shows a data-status tag (e.g. "Simulated") and handles
 * missing data honestly instead of rendering a misleading placeholder number. */
export default function MetricCard({ label, value, unit, tone, icon, statusTag, unavailable }: Props) {
  return (
    <Card className="py-3 px-4 flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-text-secondary font-semibold">{label}</span>
        {icon}
      </div>
      {unavailable ? (
        <div className="text-sm font-medium text-text-secondary mt-1">Not available</div>
      ) : (
        <div className={`text-xl font-bold tabular-nums mt-0.5 ${tone ?? "text-text-primary"}`}>
          {value}{unit && <span className="text-xs font-medium text-text-secondary ml-1">{unit}</span>}
        </div>
      )}
      {statusTag && <span className="text-[10px] text-text-secondary/80 mt-0.5">{statusTag}</span>}
    </Card>
  );
}
