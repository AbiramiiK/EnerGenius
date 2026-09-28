import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { StepResult } from "../../api/client";

const GRID_COLOR = "#E7EFEB";
const AXIS_COLOR = "#66736D";
const TOOLTIP_STYLE = {
  fontSize: 12,
  borderRadius: 8,
  background: "#FFFFFF",
  border: "1px solid #DDE6E2",
  color: "#17211D",
  boxShadow: "0 4px 12px rgba(23,33,29,0.08)",
};
const LEGEND_STYLE = { fontSize: 12, color: "#66736D" };

export function ScheduleChart({ steps }: { steps: StepResult[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={steps} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
        <XAxis dataKey="timestamp" tick={{ fontSize: 11, fill: AXIS_COLOR }} stroke={GRID_COLOR} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11, fill: AXIS_COLOR }} stroke={GRID_COLOR} label={{ value: "kW", angle: -90, position: "insideLeft", fontSize: 11, fill: AXIS_COLOR }} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => Number(v).toFixed(2)} />
        <Legend wrapperStyle={LEGEND_STYLE} />
        <Area type="monotone" dataKey="solar_generation_kw" name="Solar (kW)" fill="#F59E0B" stroke="#F59E0B" fillOpacity={0.18} />
        <Line type="monotone" dataKey="demand_kw" name="Demand (kW)" stroke="#17211D" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="grid_import_kw" name="Grid Import (kW)" stroke="#3B82F6" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="battery_discharge_kw" name="Battery Discharge (kW)" stroke="#8B5CF6" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="ev_charging_kw" name="EV Charging (kW)" stroke="#14B8A6" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function SocChart({ steps }: { steps: StepResult[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={steps} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
        <XAxis dataKey="timestamp" tick={{ fontSize: 11, fill: AXIS_COLOR }} stroke={GRID_COLOR} interval="preserveStartEnd" />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: AXIS_COLOR }} stroke={GRID_COLOR} label={{ value: "SOC %", angle: -90, position: "insideLeft", fontSize: 11, fill: AXIS_COLOR }} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => `${Number(v).toFixed(1)}%`} />
        <Area type="monotone" dataKey="battery_soc_pct" name="Battery SOC" fill="#8B5CF6" stroke="#8B5CF6" fillOpacity={0.2} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
