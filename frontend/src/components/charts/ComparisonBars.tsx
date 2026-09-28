import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

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

export function ComparisonBars({ data }: { data: { metric: string; Baseline: number; Optimized: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
        <XAxis dataKey="metric" tick={{ fontSize: 11, fill: AXIS_COLOR }} stroke={GRID_COLOR} />
        <YAxis tick={{ fontSize: 11, fill: AXIS_COLOR }} stroke={GRID_COLOR} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(16,185,129,0.06)" }} />
        <Legend wrapperStyle={{ fontSize: 12, color: AXIS_COLOR }} />
        <Bar dataKey="Baseline" fill="#B4C0BA" radius={[6, 6, 0, 0]} />
        <Bar dataKey="Optimized" fill="#10B981" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
