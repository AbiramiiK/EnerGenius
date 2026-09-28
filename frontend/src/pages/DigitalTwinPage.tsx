import { useEffect, useState } from "react";
import { Card, CardHeader, Button, EmptyState } from "../components/ui/Primitives";
import MicrogridCenterpiece, { type SimState } from "../components/MicrogridCenterpiece";
import { useSite } from "../context/SiteContext";
import { useRun } from "../hooks/useRun";
import { STRATEGIES } from "../api/client";

export default function DigitalTwinPage() {
  const { selectedDate, configured, site } = useSite();
  const { result, loading, error, run } = useRun();
  const [strategy, setStrategy] = useState("cost_efficient");
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    if (result?.optimized?.steps?.length) setStepIdx(0);
  }, [result]);

  if (!configured) {
    return <Card><EmptyState title="Complete setup first" description="The Digital Twin needs a saved site profile to simulate." /></Card>;
  }

  const steps = result?.optimized?.steps ?? [];
  const baselineSteps = result?.baseline?.steps ?? [];
  const step = steps[stepIdx] ?? null;
  const baselineStep = baselineSteps[stepIdx] ?? null;

  const simStatus: SimState = loading
    ? "running"
    : !result
    ? "ready"
    : result.solver_status !== "optimal"
    ? "infeasible"
    : result.optimized?.validation?.overall_status === "warning"
    ? "warning"
    : "optimized";

  const statusDetail =
    simStatus === "infeasible" ? result?.solver_message ?? undefined :
    simStatus === "warning" ? result?.optimized?.validation?.checks?.find(c => c.status === "warning")?.detail :
    undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold">Interactive Digital Twin</h1>
        <div className="flex items-center gap-2">
          <select className="text-sm border border-sage rounded-lg px-3 py-2 bg-surface" value={strategy} onChange={(e) => setStrategy(e.target.value)}>
            {STRATEGIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <Button onClick={() => run(selectedDate, strategy, false)} disabled={loading}>
            {loading ? "Simulating..." : "Run Simulation"}
          </Button>
        </div>
      </div>

      {error && <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-xl px-4 py-3">{error}</div>}

      <Card>
        <CardHeader title="Microgrid Energy Flows" subtitle="Driven by the backend simulation result — not randomized." />
        <MicrogridCenterpiece
          optimizedStep={step}
          baselineStep={baselineStep}
          site={site}
          status={simStatus}
          statusDetail={statusDetail}
          dataLabels={result?.data_labels}
          comparison={result?.comparison}
          size="large"
        />
        {steps.length > 0 && (
          <div className="mt-4">
            <input
              type="range" min={0} max={steps.length - 1} value={stepIdx}
              onChange={(e) => setStepIdx(Number(e.target.value))}
              className="w-full accent-emerald"
            />
            <div className="flex justify-between text-xs text-text-secondary mt-1">
              <span>{steps[0]?.timestamp}</span>
              <span className="font-medium text-text-primary">{step?.timestamp}</span>
              <span>{steps[steps.length - 1]?.timestamp}</span>
            </div>
          </div>
        )}
        {!steps.length && !loading && (
          <EmptyState title="No simulation yet" description="Run a simulation to animate energy flows across the day." />
        )}
      </Card>
    </div>
  );
}
