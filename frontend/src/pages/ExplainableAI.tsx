import { useState } from "react";
import { Lightbulb, HelpCircle, TrendingUp, AlertTriangle } from "lucide-react";
import { Card, Button, Badge, EmptyState } from "../components/ui/Primitives";
import { useSite } from "../context/SiteContext";
import { useRun } from "../hooks/useRun";
import { STRATEGIES } from "../api/client";

export default function ExplainableAI() {
  const { selectedDate, configured } = useSite();
  const { result, loading, error, run } = useRun();
  const [strategy, setStrategy] = useState("cost_efficient");

  if (!configured) return <Card><EmptyState title="Complete setup first" /></Card>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Explainable AI Recommendations</h1>
          <p className="text-sm text-text-secondary">Generated directly from solver output — no external AI service required.</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="text-sm border border-sage rounded-lg px-3 py-2 bg-surface" value={strategy} onChange={(e) => setStrategy(e.target.value)}>
            {STRATEGIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <Button onClick={() => run(selectedDate, strategy, false)} disabled={loading}>{loading ? "Analyzing..." : "Generate Recommendations"}</Button>
        </div>
      </div>

      {error && <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-xl px-4 py-3">{error}</div>}

      {!result && !loading && <Card><EmptyState title="No recommendations yet" description="Run the optimizer to generate explanations grounded in its actual output." /></Card>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {result?.recommendations?.map((r, i) => (
          <Card key={i}>
            <div className="flex items-start gap-3 mb-3">
              <div className="bg-mint rounded-lg p-2 shrink-0"><Lightbulb size={18} className="text-emerald" /></div>
              <div>
                <div className="font-semibold text-sm">{r.title}</div>
                <p className="text-sm text-text-primary mt-1">{r.recommendation}</p>
              </div>
            </div>
            <div className="space-y-2 text-xs text-text-secondary">
              <div><span className="font-semibold text-text-primary">Why: </span>{r.why}</div>
              {r.constraints.length > 0 && (
                <div><span className="font-semibold text-text-primary">Constraints considered: </span>{r.constraints.join(", ")}</div>
              )}
              <div className="flex items-start gap-1.5"><TrendingUp size={13} className="mt-0.5 shrink-0 text-emerald" /><span><span className="font-semibold text-text-primary">Expected effect: </span>{r.expected_effect}</span></div>
              <div className="flex items-start gap-1.5"><AlertTriangle size={13} className="mt-0.5 shrink-0 text-warning" /><span><span className="font-semibold text-text-primary">Trade-off: </span>{r.trade_off}</span></div>
              <div className="flex items-start gap-1.5"><HelpCircle size={13} className="mt-0.5 shrink-0 text-grid" /><span><span className="font-semibold text-text-primary">Uncertainty: </span>{r.uncertainty}</span></div>
            </div>
          </Card>
        ))}
      </div>

      {result?.solver_status !== "optimal" && result && (
        <Badge tone="danger">The optimizer could not find a feasible schedule; recommendations are limited.</Badge>
      )}
    </div>
  );
}
