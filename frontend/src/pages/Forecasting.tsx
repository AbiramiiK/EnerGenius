import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardHeader, Button, Badge, EmptyState } from "../components/ui/Primitives";
import { useSite } from "../context/SiteContext";
import { runForecast } from "../api/client";

const METHOD_LABEL: Record<string, string> = {
  baseline_typical_shape: "Baseline typical-day shape",
  historical_average: "Historical hour-of-day average",
  random_forest: "RandomForest model",
};

const STATUS_TONE: Record<string, "warning" | "info" | "success"> = {
  no_history: "warning",
  limited_history: "info",
  trained: "success",
};

export default function Forecasting() {
  const { selectedDate, configured } = useSite();
  const [target, setTarget] = useState<"solar" | "demand">("solar");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  if (!configured) return <Card><EmptyState title="Complete setup first" /></Card>;

  async function handleRun() {
    setLoading(true);
    try {
      const data = await runForecast(target, selectedDate);
      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  const chartData = result?.values?.map((v: number, i: number) => ({ step: i, value: v })) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold">Forecasting</h1>
        <div className="flex items-center gap-2">
          <select className="text-sm border border-sage rounded-lg px-3 py-2 bg-surface" value={target} onChange={(e) => setTarget(e.target.value as any)}>
            <option value="solar">Solar generation</option>
            <option value="demand">Campus demand</option>
          </select>
          <Button onClick={handleRun} disabled={loading}>{loading ? "Forecasting..." : "Run Forecast"}</Button>
        </div>
      </div>

      {!result && !loading && (
        <Card><EmptyState title="No forecast run yet" description="Select a target and run a forecast for the selected date." /></Card>
      )}

      {result && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={STATUS_TONE[result.status] ?? "info"}>{METHOD_LABEL[result.method] ?? result.method}</Badge>
            {result.mae !== null && <Badge tone="info">MAE: {result.mae}</Badge>}
            {result.rmse !== null && <Badge tone="info">RMSE: {result.rmse}</Badge>}
          </div>

          <Card>
            <CardHeader title={`${target === "solar" ? "Solar Generation" : "Campus Demand"} Forecast`} subtitle={`Horizon: ${chartData.length} steps for ${selectedDate}`} />
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E7EFEB" />
                <XAxis dataKey="step" tick={{ fontSize: 11, fill: "#66736D" }} stroke="#E7EFEB" />
                <YAxis tick={{ fontSize: 11, fill: "#66736D" }} stroke="#E7EFEB" label={{ value: "kW", angle: -90, position: "insideLeft", fontSize: 11, fill: "#66736D" }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, background: "#FFFFFF", border: "1px solid #DDE6E2", color: "#17211D" }} />
                <Line type="monotone" dataKey="value" stroke={target === "solar" ? "#F59E0B" : "#10B981"} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <p className="text-sm text-text-secondary">{result.notes}</p>
          </Card>
        </>
      )}
    </div>
  );
}
