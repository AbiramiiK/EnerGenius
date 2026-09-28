import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardHeader, Button, Badge, EmptyState, Spinner } from "../components/ui/Primitives";
import { ScheduleChart } from "../components/charts/ScheduleChart";
import { useSite } from "../context/SiteContext";
import { getAnalytics, getSimulationRun, listSimulationRuns } from "../api/client";

function toCsv(steps: any[]): string {
  if (!steps.length) return "";
  const headers = Object.keys(steps[0]);
  const rows = steps.map((s) => headers.map((h) => s[h]).join(","));
  return [headers.join(","), ...rows].join("\n");
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AnalyticsHistory() {
  const { configured } = useSite();
  const [runs, setRuns] = useState<any[]>([]);
  const [trend, setTrend] = useState<any[]>([]);
  const [selectedRun, setSelectedRun] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!configured) return;
    Promise.all([listSimulationRuns(), getAnalytics()])
      .then(([r, a]) => {
        setRuns(r);
        setTrend(a.runs.map((x: any) => ({
          date: x.operating_date,
          cost: x.optimized?.total_cost ?? null,
          baseline_cost: x.baseline?.total_cost ?? null,
          emissions: x.optimized?.total_emissions_kg ?? null,
          soc_end: null,
        })));
      })
      .finally(() => setLoading(false));
  }, [configured]);

  if (!configured) return <Card><EmptyState title="Complete setup first" /></Card>;
  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;

  async function openRun(runId: string) {
    const detail = await getSimulationRun(runId);
    setSelectedRun(detail);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Analytics & History</h1>

      {trend.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader title="Cost Trend" subtitle="Baseline vs optimized, across simulation runs" />
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E7EFEB" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#66736D" }} stroke="#E7EFEB" />
                <YAxis tick={{ fontSize: 11, fill: "#66736D" }} stroke="#E7EFEB" />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, background: "#FFFFFF", border: "1px solid #DDE6E2", color: "#17211D" }} />
                <Legend wrapperStyle={{ fontSize: 12, color: "#66736D" }} />
                <Line type="monotone" dataKey="baseline_cost" name="Baseline" stroke="#B4C0BA" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="cost" name="Optimized" stroke="#10B981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <CardHeader title="Emissions Trend" />
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E7EFEB" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#66736D" }} stroke="#E7EFEB" />
                <YAxis tick={{ fontSize: 11, fill: "#66736D" }} stroke="#E7EFEB" />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, background: "#FFFFFF", border: "1px solid #DDE6E2", color: "#17211D" }} />
                <Line type="monotone" dataKey="emissions" name="Optimized CO2 (kg)" stroke="#F5A524" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader title="Simulation Run History" />
        {runs.length === 0 ? (
          <EmptyState title="No simulation runs yet" description="Run an optimization from the Overview or Optimization page to populate history." />
        ) : (
          <div className="space-y-2">
            {runs.map((r) => (
              <button
                key={r.run_id}
                onClick={() => openRun(r.run_id)}
                className={`w-full flex items-center justify-between text-left text-sm border rounded-xl px-3 py-2.5 transition-colors ${selectedRun?.run_id === r.run_id ? "border-emerald bg-mint" : "border-sage hover:bg-mint/40"}`}
              >
                <div className="flex items-center gap-4">
                  <span className="font-medium">{r.operating_date}</span>
                  <span className="text-text-secondary">{r.strategy.replace("_", " ")}</span>
                </div>
                <Badge tone={r.solver_status === "optimal" ? "success" : "danger"}>{r.solver_status}</Badge>
              </button>
            ))}
          </div>
        )}
      </Card>

      {selectedRun && (
        <Card>
          <CardHeader
            title={`Run detail — ${selectedRun.operating_date}`}
            subtitle={`Strategy: ${selectedRun.strategy.replace("_", " ")} · Profile v${selectedRun.profile_version}`}
            action={
              <Button size="sm" variant="secondary" onClick={() => downloadCsv(`energenius_${selectedRun.run_id}.csv`, toCsv(selectedRun.steps))}>
                <span className="flex items-center gap-1"><Download size={14} /> Export CSV</span>
              </Button>
            }
          />
          {selectedRun.steps.length > 0 ? <ScheduleChart steps={selectedRun.steps} /> : <EmptyState title="No step data (infeasible run)" />}
        </Card>
      )}
    </div>
  );
}
