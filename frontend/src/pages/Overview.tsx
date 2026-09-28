import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Card, CardHeader, Button, Badge, Spinner, EmptyState } from "../components/ui/Primitives";
import MicrogridCenterpiece from "../components/MicrogridCenterpiece";
import type { SimState } from "../components/dashboard/types";
import MetricCard from "../components/dashboard/MetricCard";
import AIRecommendationCard from "../components/dashboard/AIRecommendationCard";
import { ScheduleChart, SocChart } from "../components/charts/ScheduleChart";
import { useSite } from "../context/SiteContext";
import { useRun } from "../hooks/useRun";
import { STRATEGIES, listSimulationRuns } from "../api/client";

export default function Overview() {
  const { site, loading: siteLoading, configured, selectedDate } = useSite();
  const { result, loading, error, run } = useRun();
  const [strategy, setStrategy] = useState("cost_efficient");
  const [recentRuns, setRecentRuns] = useState<any[]>([]);
  const [stepIdx, setStepIdx] = useState(12);

  useEffect(() => {
    if (site) setStrategy(site.default_strategy);
  }, [site]);

  useEffect(() => {
    listSimulationRuns().then(setRecentRuns).catch(() => {});
  }, [result]);

  useEffect(() => {
    if (result?.optimized?.steps?.length) setStepIdx(Math.min(12, result.optimized.steps.length - 1));
  }, [result]);

  if (siteLoading) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!configured) return <Navigate to="/setup" replace />;

  const summary = result?.optimized?.summary;
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
        <div>
          <h1 className="text-xl font-bold text-text-primary">Smart Microgrid Overview</h1>
          <p className="text-sm text-text-secondary">{site?.site_name} · Operating date: {selectedDate}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="text-sm border border-sage rounded-lg px-3 py-2 bg-surface"
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
          >
            {STRATEGIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <Button onClick={() => run(selectedDate, strategy, true)} disabled={loading}>
            {loading ? "Running..." : "Run Optimization"}
          </Button>
        </div>
      </div>

      {error && <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-xl px-4 py-3">{error}</div>}

      {!result && !loading && (
        <Card>
          <EmptyState
            title="No simulation run yet for this date"
            description="Click 'Run Optimization' to generate a schedule from your configured site profile and daily inputs."
            action={<Button onClick={() => run(selectedDate, strategy, true)}>Run Optimization</Button>}
          />
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricCard
          label="Energy Cost" value={summary ? summary.total_cost.toFixed(2) : "—"}
          unavailable={!summary} statusTag="Simulated"
        />
        <MetricCard
          label="CO2 Emissions" value={summary ? summary.total_emissions_kg.toFixed(1) : "—"} unit="kg" tone="text-solar"
          unavailable={!summary} statusTag="Simulated"
        />
        <MetricCard
          label="Renewable Utilization" value={summary ? (summary.renewable_share * 100).toFixed(0) : "—"} unit="%" tone="text-emerald"
          unavailable={!summary} statusTag="Simulated"
        />
        <MetricCard
          label="Battery SOC" value={step ? step.battery_soc_pct.toFixed(0) : "—"} unit="%" tone="text-battery"
          unavailable={!step} statusTag="Simulated"
        />
        <MetricCard
          label="Grid Dependency" value={summary ? (100 - summary.renewable_share * 100).toFixed(0) : "—"} unit="%" tone="text-grid"
          unavailable={!summary} statusTag="Simulated"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="p-3 lg:col-span-3">
          <div className="flex items-center justify-between px-2 pt-1 pb-2">
            <h2 className="text-sm font-semibold text-text-primary">Virtual Microgrid — Interactive Digital Twin</h2>
            {(result?.data_labels?.solar_synthetic || result?.data_labels?.demand_synthetic) && (
              <Badge tone="info">Synthetic input data for this run</Badge>
            )}
          </div>
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
            <div className="mt-3 px-1">
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
        </Card>

        <div className="lg:col-span-1">
          <AIRecommendationCard recommendation={result?.recommendations?.[0] ?? null} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader title="Solar vs Demand vs Grid" subtitle="Full-day optimized schedule" />
          {steps.length ? <ScheduleChart steps={steps} /> : <EmptyState title="No data yet" />}
        </Card>
        <Card>
          <CardHeader title="Battery SOC" />
          {steps.length ? <SocChart steps={steps} /> : <EmptyState title="No data yet" />}
        </Card>
      </div>

      <Card>
        <CardHeader title="Recent Simulation Runs" />
        {recentRuns.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {recentRuns.slice(0, 6).map((r) => (
              <div key={r.run_id} className="flex justify-between items-center text-sm border-b border-sage/60 py-2">
                <div>
                  <div className="font-medium">{r.operating_date}</div>
                  <div className="text-xs text-text-secondary">{r.strategy.replace("_", " ")}</div>
                </div>
                <Badge tone={r.solver_status === "optimal" ? "success" : "danger"}>{r.solver_status}</Badge>
              </div>
            ))}
          </div>
        ) : <EmptyState title="No simulation runs yet" />}
      </Card>
    </div>
  );
}
