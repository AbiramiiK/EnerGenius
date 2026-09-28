import { useState } from "react";
import { Card, CardHeader, Button, Badge, EmptyState } from "../components/ui/Primitives";
import { ScheduleChart } from "../components/charts/ScheduleChart";
import { ComparisonBars } from "../components/charts/ComparisonBars";
import { useSite } from "../context/SiteContext";
import { useRun } from "../hooks/useRun";
import { STRATEGIES } from "../api/client";

export default function Optimization() {
  const { selectedDate, configured } = useSite();
  const { result, loading, error, run } = useRun();
  const [strategy, setStrategy] = useState("cost_efficient");

  if (!configured) return <Card><EmptyState title="Complete setup first" /></Card>;

  const chartMetrics = ["total_cost", "total_emissions_kg", "peak_grid_import_kw"];
  const comparisonData = result?.comparison
    ? chartMetrics.filter((k) => result.comparison![k]).map((key) => ({
        metric: key.replace(/_/g, " "),
        Baseline: result.comparison![key].baseline,
        Optimized: result.comparison![key].optimized,
      }))
    : [];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Optimization Engine</h1>

      <Card>
        <CardHeader title="Select Strategy" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {STRATEGIES.map((s) => (
            <button
              key={s.value}
              onClick={() => setStrategy(s.value)}
              className={`text-left border rounded-xl p-3 transition-colors ${strategy === s.value ? "border-emerald bg-mint" : "border-sage hover:bg-mint/50"}`}
            >
              <div className="font-medium text-sm">{s.label}</div>
            </button>
          ))}
        </div>
        {result?.strategy_description && strategy === result.strategy && (
          <p className="text-xs text-text-secondary mt-3 bg-mint rounded-lg p-3">{result.strategy_description}</p>
        )}
        <div className="mt-4">
          <Button onClick={() => run(selectedDate, strategy, true)} disabled={loading}>
            {loading ? "Solving..." : "Run Optimization (persisted)"}
          </Button>
        </div>
      </Card>

      {error && <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-xl px-4 py-3">{error}</div>}

      {result && (
        <>
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm text-text-secondary">Solver status</div>
                <Badge tone={result.solver_status === "optimal" ? "success" : "danger"}>{result.solver_status}</Badge>
              </div>
              {result.optimized?.objective_value !== undefined && result.solver_status === "optimal" && (
                <div className="text-right">
                  <div className="text-sm text-text-secondary">Objective value</div>
                  <div className="font-bold">{result.optimized.objective_value?.toFixed(3)}</div>
                </div>
              )}
              <div className="text-right">
                <div className="text-sm text-text-secondary">Run ID</div>
                <div className="font-mono text-xs">{result.run_id ?? "not persisted"}</div>
              </div>
            </div>

            {result.solver_status === "optimal" && result.optimized.steps.length > 0 && (
              <ScheduleChart steps={result.optimized.steps} />
            )}
          </Card>

          {comparisonData.length > 0 && (
            <Card>
              <CardHeader title="Baseline vs Optimized" subtitle="Same scenario inputs, identical constraints" />
              <ComparisonBars data={comparisonData} />
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-text-secondary border-b border-sage">
                      <th className="py-2 pr-4">Metric</th>
                      <th className="py-2 pr-4">Baseline</th>
                      <th className="py-2 pr-4">Optimized</th>
                      <th className="py-2 pr-4">% Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(result!.comparison!).map(([key, v]) => (
                      <tr key={key} className="border-b border-sage/60">
                        <td className="py-2 pr-4 capitalize">{key.replace(/_/g, " ")}</td>
                        <td className="py-2 pr-4">{v.baseline}</td>
                        <td className="py-2 pr-4">{v.optimized}</td>
                        <td className="py-2 pr-4">{v.pct_diff !== null ? `${v.pct_diff}%` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
