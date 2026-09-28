import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Card, Badge, EmptyState, Spinner } from "../components/ui/Primitives";
import { useSite } from "../context/SiteContext";
import { getSystemHealth, listSimulationRuns } from "../api/client";

const ICONS: Record<string, any> = {
  validated: <CheckCircle2 size={18} className="text-emerald" />,
  warning: <AlertTriangle size={18} className="text-warning" />,
  infeasible: <XCircle size={18} className="text-danger" />,
};

export default function SystemHealth() {
  const { configured } = useSite();
  const [runs, setRuns] = useState<any[]>([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!configured) return;
    listSimulationRuns().then((r) => {
      setRuns(r);
      if (r.length) setSelectedRunId(r[0].run_id);
      setLoading(false);
    });
  }, [configured]);

  useEffect(() => {
    if (selectedRunId) getSystemHealth(selectedRunId).then(setHealth);
  }, [selectedRunId]);

  if (!configured) return <Card><EmptyState title="Complete setup first" /></Card>;
  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold">System Health & Constraint Validation</h1>
        {runs.length > 0 && (
          <select className="text-sm border border-sage rounded-lg px-3 py-2 bg-surface" value={selectedRunId} onChange={(e) => setSelectedRunId(e.target.value)}>
            {runs.map((r) => <option key={r.run_id} value={r.run_id}>{r.operating_date} — {r.strategy.replace("_", " ")}</option>)}
          </select>
        )}
      </div>

      {!runs.length && <Card><EmptyState title="No simulation runs yet" description="Run an optimization to evaluate system health." /></Card>}

      {health && (
        <>
          <Card>
            <div className="flex items-center gap-3">
              <span className="text-sm text-text-secondary">Overall status:</span>
              <Badge tone={health.overall_status === "validated" ? "success" : health.overall_status === "infeasible" ? "danger" : "warning"}>
                {health.overall_status}
              </Badge>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {health.checks.map((c: any, i: number) => (
              <Card key={i} className="flex items-start gap-3">
                {ICONS[c.status] ?? ICONS.warning}
                <div>
                  <div className="font-medium text-sm">{c.name}</div>
                  <p className="text-xs text-text-secondary mt-1">{c.detail}</p>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
