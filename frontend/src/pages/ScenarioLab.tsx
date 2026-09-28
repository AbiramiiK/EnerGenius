import { useState } from "react";
import { Card, CardHeader, Button, Badge, EmptyState } from "../components/ui/Primitives";
import MicrogridCenterpiece, { type SimState } from "../components/MicrogridCenterpiece";
import { ComparisonBars } from "../components/charts/ComparisonBars";
import { useSite } from "../context/SiteContext";
import { useRun } from "../hooks/useRun";
import { STRATEGIES } from "../api/client";

const PRESETS: Record<string, Record<string, number>> = {
  "Sunny day": { solar_availability_factor: 1.3, demand_scale_factor: 1.0 },
  "Cloudy day": { solar_availability_factor: 0.4, demand_scale_factor: 1.0 },
  "Evening peak demand": { solar_availability_factor: 0.9, demand_scale_factor: 1.4 },
  "Low battery": { battery_initial_soc_pct: 15 },
  "High EV demand": { ev_count_override: 6 },
  "Restricted grid import": { grid_max_import_kw: 30 },
};

function Slider({ label, value, min, max, step, onChange, unit }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; unit?: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-text-primary font-medium">{label}</span>
        <span className="text-text-secondary">{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-emerald" />
    </div>
  );
}

export default function ScenarioLab() {
  const { site, selectedDate, configured } = useSite();
  const [strategy, setStrategy] = useState("cost_efficient");
  const [solarFactor, setSolarFactor] = useState(1.0);
  const [demandFactor, setDemandFactor] = useState(1.0);
  const [batterySoc, setBatterySoc] = useState(50);
  const [evCount, setEvCount] = useState(2);
  const [gridLimit, setGridLimit] = useState(120);
  const [tariff, setTariff] = useState(0.18);

  const scenario = useRun();

  if (!configured) return <Card><EmptyState title="Complete setup first" /></Card>;

  function applyPreset(name: string) {
    const p = PRESETS[name];
    if (p.solar_availability_factor !== undefined) setSolarFactor(p.solar_availability_factor);
    if (p.demand_scale_factor !== undefined) setDemandFactor(p.demand_scale_factor);
    if (p.battery_initial_soc_pct !== undefined) setBatterySoc(p.battery_initial_soc_pct);
    if (p.ev_count_override !== undefined) setEvCount(p.ev_count_override);
    if (p.grid_max_import_kw !== undefined) setGridLimit(p.grid_max_import_kw);
  }

  async function handleRun() {
    const overrides = {
      solar_availability_factor: solarFactor,
      demand_scale_factor: demandFactor,
      battery_initial_soc_pct: batterySoc,
      ev_count_override: evCount,
      grid_max_import_kw: gridLimit,
      tariff_flat_rate: tariff,
    };
    await scenario.run(selectedDate, strategy, false, overrides);
  }

  const result = scenario.result;
  const comparisonData = result?.comparison
    ? [
        { metric: "Cost", Baseline: result.comparison.total_cost.baseline, Optimized: result.comparison.total_cost.optimized },
        { metric: "Emissions (kg)", Baseline: result.comparison.total_emissions_kg.baseline, Optimized: result.comparison.total_emissions_kg.optimized },
        { metric: "Peak grid (kW)", Baseline: result.comparison.peak_grid_import_kw.baseline, Optimized: result.comparison.peak_grid_import_kw.optimized },
      ]
    : [];

  const steps = result?.optimized?.steps ?? [];
  const baselineSteps = result?.baseline?.steps ?? [];
  const midIdx = Math.min(12, steps.length - 1);
  const midStep = steps[midIdx] ?? null;
  const midBaselineStep = baselineSteps[midIdx] ?? null;
  const simStatus: SimState = scenario.loading
    ? "running"
    : !result
    ? "ready"
    : result.solver_status !== "optimal"
    ? "infeasible"
    : result.optimized?.validation?.overall_status === "warning"
    ? "warning"
    : "optimized";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Scenario Lab — What-If Simulator</h1>
        <p className="text-sm text-text-secondary">Adjust inputs, then re-run to see the backend recompute the optimized schedule.</p>
      </div>

      <Card>
        <CardHeader title="Preset Scenarios" />
        <div className="flex flex-wrap gap-2">
          {Object.keys(PRESETS).map((name) => (
            <Button key={name} variant="secondary" size="sm" onClick={() => applyPreset(name)}>{name}</Button>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Scenario Inputs" />
          <div className="space-y-5">
            <Slider label="Solar availability" value={solarFactor} min={0} max={1.5} step={0.05} onChange={setSolarFactor} unit="×" />
            <Slider label="Demand scale" value={demandFactor} min={0.5} max={2} step={0.05} onChange={setDemandFactor} unit="×" />
            <Slider label="Battery starting SOC" value={batterySoc} min={0} max={100} step={5} onChange={setBatterySoc} unit="%" />
            <Slider label="Number of EVs" value={evCount} min={0} max={10} step={1} onChange={setEvCount} />
            <Slider label="Grid import limit" value={gridLimit} min={0} max={site?.grid_max_import_kw ?? 200} step={5} onChange={setGridLimit} unit=" kW" />
            <Slider label="Tariff scenario" value={tariff} min={0.05} max={0.5} step={0.01} onChange={setTariff} unit="/kWh" />
            <div className="flex items-center gap-2">
              <select className="text-sm border border-sage rounded-lg px-3 py-2 bg-surface flex-1" value={strategy} onChange={(e) => setStrategy(e.target.value)}>
                {STRATEGIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <Button onClick={handleRun} disabled={scenario.loading}>
                {scenario.loading ? "Re-optimizing..." : "Run Simulation"}
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Virtual Microgrid (scenario result)" />
          {scenario.error && <div className="text-sm text-danger mb-2">{scenario.error}</div>}
          {result?.solver_status === "infeasible" && <Badge tone="danger">Infeasible under these inputs — relax a constraint and re-run.</Badge>}
          <MicrogridCenterpiece
            optimizedStep={midStep}
            baselineStep={midBaselineStep}
            site={site}
            status={simStatus}
            dataLabels={result?.data_labels}
            comparison={result?.comparison}
            size="compact"
          />
        </Card>
      </div>

      {comparisonData.length > 0 && (
        <Card>
          <CardHeader title="Before / After Comparison" subtitle="Rule-based baseline vs. optimized schedule under this scenario's inputs" />
          <ComparisonBars data={comparisonData} />
        </Card>
      )}
    </div>
  );
}
