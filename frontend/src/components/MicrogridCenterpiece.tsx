import { useMemo, useState } from "react";
import { Sun, Battery, Building2, Car, Zap, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import type { StepResult, SiteProfile, OptimizeResponse } from "../api/client";
import { deriveFlows, flowWidth } from "./microgridFlows";
import SimulationStatus from "./dashboard/SimulationStatus";
import BaselineOptimizedToggle from "./dashboard/BaselineOptimizedToggle";
import ComponentDetailsPanel, { type PanelInfo } from "./dashboard/ComponentDetailsPanel";
import type { SimState } from "./dashboard/types";

export type { SimState };

type ComponentId = "solar" | "battery" | "campus" | "ev" | "grid" | null;

interface Props {
  optimizedStep: StepResult | null;
  baselineStep?: StepResult | null;
  site: SiteProfile | null;
  status: SimState;
  statusDetail?: string | null;
  dataLabels?: { solar_synthetic: boolean; demand_synthetic: boolean };
  comparison?: OptimizeResponse["comparison"];
  size?: "large" | "compact";
}

const COS30 = 0.866;
const SIN30 = 0.5;

const INK = {
  textPrimary: "#17211D",
  textSecondary: "#66736D",
  idleFlow: "#C7D3CE",
  solar: "#F59E0B",
  battery: "#8B5CF6",
  grid: "#3B82F6",
  ev: "#14B8A6",
  campus: "#0E7490",
  road: "#B7C4BE",
};

function iso(originX: number, originY: number, x: number, y: number, z: number) {
  return [originX + (x - y) * COS30, originY + (x + y) * SIN30 - z];
}

function ptsToStr(pts: number[][]) {
  return pts.map((p) => p.join(",")).join(" ");
}

function IsoBox({
  ox, oy, w, d, h, topColor, leftColor, rightColor, opacity = 1,
}: { ox: number; oy: number; w: number; d: number; h: number; topColor: string; leftColor: string; rightColor: string; opacity?: number }) {
  const top = [iso(ox, oy, 0, 0, h), iso(ox, oy, w, 0, h), iso(ox, oy, w, d, h), iso(ox, oy, 0, d, h)];
  const left = [iso(ox, oy, 0, 0, 0), iso(ox, oy, 0, d, 0), iso(ox, oy, 0, d, h), iso(ox, oy, 0, 0, h)];
  const right = [iso(ox, oy, 0, d, 0), iso(ox, oy, w, d, 0), iso(ox, oy, w, d, h), iso(ox, oy, 0, d, h)];
  return (
    <g opacity={opacity}>
      <polygon points={ptsToStr(right)} fill={rightColor} />
      <polygon points={ptsToStr(left)} fill={leftColor} />
      <polygon points={ptsToStr(top)} fill={topColor} />
    </g>
  );
}

/** Small decorative isometric tree — not interactive, purely for campus landscaping. */
function Tree({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`} opacity={0.85}>
      <rect x={-1.5} y={0} width={3} height={7} fill="#4A3B24" />
      <ellipse cx={0} cy={-4} rx={8} ry={7} fill="#1E5A45" />
      <ellipse cx={-2} cy={-6} rx={5} ry={4} fill="#26714F" />
    </g>
  );
}

function FlowPath({
  d, kw, site, color, label,
}: { d: string; kw: number; site: SiteProfile | null; color: string; label?: { x: number; y: number } }) {
  const active = kw > 0.05;
  const width = active ? flowWidth(kw, site) : 1.25;
  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={active ? color : INK.idleFlow}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={active ? "7 6" : "3 5"}
        className={active ? "twin-flow" : ""}
        style={active ? { filter: `drop-shadow(0 0 ${2 + width}px ${color}80)` } : undefined}
      />
      {active && label && (
        <text x={label.x} y={label.y} textAnchor="middle" fontSize={9.5} fontWeight={700} fill={color}
          style={{ paintOrder: "stroke", stroke: "#FFFFFF", strokeWidth: 3 }}>
          {kw.toFixed(1)} kW
        </text>
      )}
    </g>
  );
}

export default function MicrogridCenterpiece({
  optimizedStep, baselineStep, site, status, statusDetail, dataLabels, comparison, size = "large",
}: Props) {
  const [selected, setSelected] = useState<ComponentId>(null);
  const [hovered, setHovered] = useState<ComponentId>(null);
  const [view, setView] = useState<"optimized" | "baseline">("optimized");
  const [zoom, setZoom] = useState(1);

  const step = view === "baseline" && baselineStep ? baselineStep : optimizedStep;
  const flows = useMemo(() => (step ? deriveFlows(step) : null), [step]);

  const height = size === "large" ? 480 : 260;
  const evStalls = Math.max(1, Math.min(4, site?.ev_charger_count ?? 2));

  const panelInfo: PanelInfo | null = useMemo(() => {
    if (!selected) return null;
    switch (selected) {
      case "solar":
        return {
          icon: <Sun size={16} className="text-solar" />,
          title: "Solar PV Farm",
          rows: [
            ["Installed capacity", `${site?.solar_capacity_kw ?? "—"} kW`],
            ["Available generation", step ? `${step.solar_generation_kw.toFixed(1)} kW` : "—"],
            ["Utilization (used / available)", step && step.solar_generation_kw > 0 ? `${((step.solar_used_kw / step.solar_generation_kw) * 100).toFixed(0)}%` : "—"],
            ["Curtailed", step ? `${step.solar_curtailed_kw.toFixed(1)} kW` : "—"],
            ["Status", step ? (step.solar_used_kw > 0.05 ? "Generating" : "Idle") : "Unavailable"],
            ["Data source", dataLabels?.solar_synthetic ? "Simulated (synthetic estimate)" : "Simulated (from uploaded/forecast data)"],
          ],
        };
      case "battery": {
        const st = (step?.battery_charge_kw ?? 0) > 0.05 ? "Charging" : (step?.battery_discharge_kw ?? 0) > 0.05 ? "Discharging" : "Idle";
        return {
          icon: <Battery size={16} className="text-battery" />,
          title: "Battery Energy Storage",
          rows: [
            ["Capacity", `${site?.battery_capacity_kwh ?? "—"} kWh`],
            ["Current SOC", step ? `${step.battery_soc_pct.toFixed(1)}%` : "—"],
            ["Operating limits", `${site?.battery_min_soc_pct ?? "—"}% – ${site?.battery_max_soc_pct ?? "—"}%`],
            ["Charge power", step ? `${step.battery_charge_kw.toFixed(1)} kW` : "—"],
            ["Discharge power", step ? `${step.battery_discharge_kw.toFixed(1)} kW` : "—"],
            ["Status", step ? st : "Unavailable"],
          ],
        };
      }
      case "campus":
        return {
          icon: <Building2 size={16} className="text-[#0E7490]" />,
          title: "Campus Load",
          rows: [
            ["Current demand", step ? `${step.demand_kw.toFixed(1)} kW` : "—"],
            ["Peak demand (configured)", site?.peak_demand_kw ? `${site.peak_demand_kw} kW` : "Not configured"],
            ["Essential load", site?.essential_load_kw ? `${site.essential_load_kw} kW (reference only)` : "Not configured"],
            ["Status", step ? "Consuming" : "Unavailable"],
            ["Data source", dataLabels?.demand_synthetic ? "Simulated (synthetic estimate)" : "Simulated (from uploaded/forecast data)"],
          ],
        };
      case "ev":
        return {
          icon: <Car size={16} className="text-[#14B8A6]" />,
          title: "EV Charging Station",
          rows: [
            ["Chargers configured", `${site?.ev_charger_count ?? 0} × ${site?.ev_charger_power_kw ?? "—"} kW`],
            ["Current charging load", step ? `${step.ev_charging_kw.toFixed(1)} kW` : "—"],
            ["Required energy / session", `${site?.ev_default_energy_kwh ?? "—"} kWh`],
            ["Default charging window", `${site?.ev_default_window_start ?? "—"} – ${site?.ev_default_window_end ?? "—"}`],
            ["Status", step ? (step.ev_charging_kw > 0.05 ? "Charging" : "Idle") : "Unavailable"],
            ["Completion status", "Set per-session in Daily Operations"],
          ],
        };
      case "grid":
        return {
          icon: <Zap size={16} className="text-grid" />,
          title: "Utility Grid Connection",
          rows: [
            ["Import power", step ? `${step.grid_import_kw.toFixed(1)} kW` : "—"],
            ["Export power", step ? `${step.grid_export_kw.toFixed(1)} kW` : "—"],
            ["Import / export limits", `${site?.grid_max_import_kw ?? "—"} kW / ${site?.grid_max_export_kw ?? "—"} kW`],
            ["Tariff (flat reference)", `${site?.tariff_flat_rate ?? "—"} / kWh`],
            ["Grid status", site?.grid_available === false ? "Restricted" : "Available"],
          ],
        };
      default:
        return null;
    }
  }, [selected, step, site, dataLabels]);

  const cls = (id: ComponentId) => `cursor-pointer transition-opacity ${hovered && hovered !== id ? "opacity-50" : "opacity-100"}`;

  return (
    <div>
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .twin-flow { animation: dashfwd 1s linear infinite; }
        }
        @keyframes dashfwd { to { stroke-dashoffset: -26; } }
      `}</style>

      <div className="flex items-start justify-between mb-2 gap-3 flex-wrap">
        <SimulationStatus status={status} detail={statusDetail} simulated={!!step} />
        {baselineStep && <BaselineOptimizedToggle view={view} onChange={setView} />}
      </div>

      <div className="flex flex-col lg:flex-row gap-3">
        <div
          className="flex-1 min-w-0 rounded-xl border border-sage p-2 relative overflow-hidden"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 500px 260px at 50% 30%, rgba(16,185,129,0.06), transparent), linear-gradient(#E7EFEB 1px, transparent 1px), linear-gradient(90deg, #E7EFEB 1px, transparent 1px), linear-gradient(180deg, #FCFDFC 0%, #F4F8F6 100%)",
            backgroundSize: "auto, 28px 28px, 28px 28px, auto",
          }}
        >
          <div className="absolute top-2 right-2 z-10 flex gap-1">
            <button type="button" onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.15).toFixed(2)))}
              className="p-1.5 rounded-md bg-surface/80 border border-sage text-text-secondary hover:text-text-primary" title="Zoom in">
              <ZoomIn size={13} />
            </button>
            <button type="button" onClick={() => setZoom((z) => Math.max(0.7, +(z - 0.15).toFixed(2)))}
              className="p-1.5 rounded-md bg-surface/80 border border-sage text-text-secondary hover:text-text-primary" title="Zoom out">
              <ZoomOut size={13} />
            </button>
            <button type="button" onClick={() => setZoom(1)}
              className="p-1.5 rounded-md bg-surface/80 border border-sage text-text-secondary hover:text-text-primary" title="Reset view">
              <RotateCcw size={13} />
            </button>
          </div>

          <div style={{ transform: `scale(${zoom})`, transformOrigin: "50% 50%", transition: "transform 0.15s ease" }}>
            <svg viewBox="0 0 760 460" width="100%" height={height} role="img" aria-label="Interactive virtual microgrid">
              {/* ground */}
              <ellipse cx={380} cy={340} rx={340} ry={115} fill="#DFF7EC" opacity={0.7} />
              <ellipse cx={380} cy={340} rx={340} ry={115} fill="none" stroke="#BFE5D3" strokeWidth={1} />

              {/* roads */}
              <path d="M260,300 C300,320 330,335 370,345" stroke={INK.road} strokeWidth={10} fill="none" strokeLinecap="round" />
              <path d="M260,300 C300,320 330,335 370,345" stroke="#EDF2EF" strokeWidth={1} strokeDasharray="4 6" fill="none" />
              <path d="M370,345 C440,365 480,370 520,345" stroke={INK.road} strokeWidth={9} fill="none" strokeLinecap="round" />
              <path d="M370,345 C440,365 480,370 520,345" stroke="#EDF2EF" strokeWidth={1} strokeDasharray="4 6" fill="none" />

              {/* landscaping */}
              <Tree x={245} y={355} scale={0.9} />
              <Tree x={470} y={390} scale={1.1} />
              <Tree x={300} y={230} scale={0.8} />
              <Tree x={630} y={230} scale={0.8} />

              {/* Flow paths — pairwise, magnitude-scaled, value-labeled */}
              {flows && (
                <>
                  <FlowPath d="M215,145 C260,180 300,205 345,222" kw={flows.solarToCampus} site={site} color={INK.solar} label={{ x: 265, y: 178 }} />
                  <FlowPath d="M185,180 C172,230 168,255 172,282" kw={flows.solarToBattery} site={site} color={INK.solar} label={{ x: 148, y: 235 }} />
                  <FlowPath d="M235,150 C320,175 420,220 470,270" kw={flows.solarToEv} site={site} color={INK.solar} label={{ x: 330, y: 185 }} />
                  <FlowPath d="M172,282 C220,300 285,292 340,258" kw={flows.batteryToCampus} site={site} color={INK.battery} label={{ x: 230, y: 312 }} />
                  <FlowPath d="M190,300 C300,340 420,345 470,290" kw={flows.batteryToEv} site={site} color={INK.battery} label={{ x: 330, y: 355 }} />
                  <FlowPath d="M600,150 C540,190 470,212 412,232" kw={flows.gridToCampus} site={site} color={INK.grid} label={{ x: 520, y: 178 }} />
                  <FlowPath d="M600,165 C560,230 520,270 480,285" kw={flows.gridToEv} site={site} color={INK.grid} label={{ x: 570, y: 250 }} />
                  <FlowPath d="M600,180 C450,230 280,260 190,280" kw={flows.gridToBattery} site={site} color={INK.grid} label={{ x: 400, y: 250 }} />
                  <FlowPath d="M412,232 C470,205 540,185 600,150" kw={flows.campusToGrid} site={site} color={INK.campus} label={{ x: 500, y: 200 }} />
                </>
              )}

              {/* Solar PV farm — 2x3 grid */}
              <g
                className={cls("solar")}
                onClick={() => setSelected("solar")}
                onMouseEnter={() => setHovered("solar")}
                onMouseLeave={() => setHovered(null)}
              >
                {[0, 1].map((row) =>
                  [0, 1, 2].map((col) => (
                    <IsoBox
                      key={`${row}-${col}`}
                      ox={90 + col * 26} oy={110 + row * 22 - col * 6} w={20} d={14} h={3.5}
                      topColor={flows && flows.solarToCampus + flows.solarToBattery + flows.solarToEv > 0.05 ? "#FFD98A" : "#5B4522"}
                      leftColor={flows && flows.solarToCampus + flows.solarToBattery + flows.solarToEv > 0.05 ? "#B9822B" : "#3A2C16"}
                      rightColor={flows && flows.solarToCampus + flows.solarToBattery + flows.solarToEv > 0.05 ? "#DDA23A" : "#4A3A1E"}
                    />
                  ))
                )}
                <text x={140} y={95} textAnchor="middle" fontSize={11} fontWeight={700} fill={INK.textPrimary}>Solar PV Farm</text>
                <text x={140} y={108} textAnchor="middle" fontSize={10} fill={INK.solar}>
                  {step ? `${step.solar_generation_kw.toFixed(0)} kW` : "—"}
                </text>
              </g>

              {/* Secondary decorative building (non-interactive) */}
              <g opacity={0.55}>
                <IsoBox ox={430} oy={280} w={26} d={20} h={26} topColor="#182233" leftColor="#0C121C" rightColor="#111A28" />
              </g>

              {/* Campus building (interactive, primary) */}
              <g
                className={cls("campus")}
                onClick={() => setSelected("campus")}
                onMouseEnter={() => setHovered("campus")}
                onMouseLeave={() => setHovered(null)}
              >
                <IsoBox ox={340} oy={255} w={40} d={30} h={46} topColor="#1B2A3D" leftColor="#0B1420" rightColor="#101B29" />
                <IsoBox ox={352} oy={240} w={16} d={14} h={12} topColor={INK.campus} leftColor="#1E97AD" rightColor="#2BB6CE" />
                <text x={368} y={205} textAnchor="middle" fontSize={11} fontWeight={700} fill={INK.textPrimary}>Campus</text>
                <text x={368} y={218} textAnchor="middle" fontSize={10} fill={INK.campus}>
                  {step ? `${step.demand_kw.toFixed(0)} kW` : "—"}
                </text>
              </g>

              {/* Battery */}
              <g
                className={cls("battery")}
                onClick={() => setSelected("battery")}
                onMouseEnter={() => setHovered("battery")}
                onMouseLeave={() => setHovered(null)}
              >
                <IsoBox ox={140} oy={300} w={22} d={20} h={26} topColor={INK.battery} leftColor="#6D28D9" rightColor="#7C3AED" />
                <rect x={126} y={278 - (step ? Math.min(100, step.battery_soc_pct) * 0.3 : 0)} width={6} height={step ? Math.min(100, step.battery_soc_pct) * 0.3 : 0} fill={INK.battery} opacity={0.95} />
                <rect x={126} y={248} width={6} height={30} fill="none" stroke={INK.textSecondary} strokeWidth={0.75} />
                <text x={150} y={355} textAnchor="middle" fontSize={11} fontWeight={700} fill={INK.textPrimary}>Battery</text>
                <text x={150} y={368} textAnchor="middle" fontSize={10} fill={INK.battery}>
                  {step ? `${step.battery_soc_pct.toFixed(0)}% SOC` : "—"}
                </text>
              </g>

              {/* EV charging station with canopy */}
              <g
                className={cls("ev")}
                onClick={() => setSelected("ev")}
                onMouseEnter={() => setHovered("ev")}
                onMouseLeave={() => setHovered(null)}
              >
                <polygon
                  points={ptsToStr([iso(548, 292, 0, 0, 22), iso(548, 292, 78, 0, 22), iso(548, 292, 78, 26, 22), iso(548, 292, 0, 26, 22)])}
                  fill="#CCFBF1" opacity={0.7} stroke={INK.ev} strokeWidth={0.75}
                />
                <line x1={iso(548, 292, 2, 2, 0)[0]} y1={iso(548, 292, 2, 2, 0)[1]} x2={iso(548, 292, 2, 2, 22)[0]} y2={iso(548, 292, 2, 2, 22)[1]} stroke={INK.ev} strokeWidth={2} opacity={0.6} />
                <line x1={iso(548, 292, 76, 24, 0)[0]} y1={iso(548, 292, 76, 24, 0)[1]} x2={iso(548, 292, 76, 24, 22)[0]} y2={iso(548, 292, 76, 24, 22)[1]} stroke={INK.ev} strokeWidth={2} opacity={0.6} />
                {Array.from({ length: evStalls }).map((_, i) => (
                  <g key={i}>
                    <IsoBox ox={558 + i * 20} oy={300 + i * 4} w={12} d={16} h={2.5} topColor="#E2E8E5" leftColor="#C7D0CC" rightColor="#D3DBD7" />
                    <IsoBox ox={561 + i * 20} oy={295 + i * 4} w={7} d={10} h={7}
                      topColor={(flows && (flows.solarToEv + flows.batteryToEv + flows.gridToEv) > 0.05) ? INK.ev : "#CBD5D2"}
                      leftColor={(flows && (flows.solarToEv + flows.batteryToEv + flows.gridToEv) > 0.05) ? "#0F9488" : "#A9B5B0"}
                      rightColor={(flows && (flows.solarToEv + flows.batteryToEv + flows.gridToEv) > 0.05) ? "#12A99B" : "#BAC4C0"} />
                  </g>
                ))}
                <text x={597} y={345} textAnchor="middle" fontSize={11} fontWeight={700} fill={INK.textPrimary}>EV Charging</text>
                <text x={597} y={358} textAnchor="middle" fontSize={10} fill={INK.ev}>
                  {step ? `${step.ev_charging_kw.toFixed(0)} kW` : "—"}
                </text>
              </g>

              {/* Grid pylon */}
              <g
                className={cls("grid")}
                onClick={() => setSelected("grid")}
                onMouseEnter={() => setHovered("grid")}
                onMouseLeave={() => setHovered(null)}
              >
                <line x1={615} y1={150} x2={615} y2={95} stroke={INK.grid} strokeWidth={4} />
                <line x1={595} y1={105} x2={635} y2={105} stroke={INK.grid} strokeWidth={3} />
                <line x1={600} y1={118} x2={630} y2={118} stroke={INK.grid} strokeWidth={3} />
                <circle cx={615} cy={95} r={5} fill={INK.grid} />
                <text x={615} y={78} textAnchor="middle" fontSize={11} fontWeight={700} fill={INK.textPrimary}>Grid</text>
                <text x={615} y={165} textAnchor="middle" fontSize={10} fill={INK.grid}>
                  {step ? `${step.grid_import_kw > 0.05 ? `↓${step.grid_import_kw.toFixed(0)}` : step.grid_export_kw > 0.05 ? `↑${step.grid_export_kw.toFixed(0)}` : "0"} kW` : "—"}
                </text>
              </g>
            </svg>
          </div>

          {!step && (
            <div className="absolute inset-0 flex items-center justify-center bg-forest/60 text-sm text-text-secondary">
              {status === "running" ? "Running simulation…" : "Run a simulation to activate live energy flows."}
            </div>
          )}
        </div>

        <ComponentDetailsPanel info={panelInfo} compact={size === "compact"} />
      </div>

      <div className="flex flex-wrap gap-3 justify-center text-xs text-text-secondary mt-2">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: INK.solar }} /> Solar Flow</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: INK.battery }} /> Battery Flow</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: INK.ev }} /> EV Flow</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: INK.grid }} /> Grid Flow</span>
        <span className="flex items-center gap-1"><span className="w-3 border-t border-dashed inline-block" style={{ borderColor: INK.idleFlow }} /> No flow</span>
        {step && <span>Time step: {step.timestamp}</span>}
      </div>

      {comparison && (
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg border border-sage bg-surface p-2.5">
            <div className="font-semibold text-text-secondary mb-1">Baseline</div>
            <Row label="Cost" value={comparison.total_cost.baseline.toFixed(2)} />
            <Row label="CO2" value={`${comparison.total_emissions_kg.baseline.toFixed(1)} kg`} />
            <Row label="Grid import" value={`${comparison.peak_grid_import_kw?.baseline?.toFixed?.(1) ?? "—"} kW pk`} />
            <Row label="Renewable" value={`${(comparison.renewable_share.baseline * 100).toFixed(0)}%`} />
          </div>
          <div className="rounded-lg border border-emerald/30 bg-emerald/5 p-2.5">
            <div className="font-semibold text-emerald mb-1">Optimized</div>
            <Row label="Cost" value={comparison.total_cost.optimized.toFixed(2)} />
            <Row label="CO2" value={`${comparison.total_emissions_kg.optimized.toFixed(1)} kg`} />
            <Row label="Grid import" value={`${comparison.peak_grid_import_kw?.optimized?.toFixed?.(1) ?? "—"} kW pk`} />
            <Row label="Renewable" value={`${(comparison.renewable_share.optimized * 100).toFixed(0)}%`} />
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-text-secondary">{label}</span>
      <span className="font-medium text-text-primary">{value}</span>
    </div>
  );
}
