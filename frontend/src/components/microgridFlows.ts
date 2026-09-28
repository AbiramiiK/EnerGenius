import type { StepResult, SiteProfile } from "../api/client";

/**
 * The backend LP only tracks aggregate power per component per step
 * (solar_used_kw, battery_charge_kw, ev_charging_kw, grid_import_kw, ...).
 * It does not solve which source feeds which sink. For the Digital Twin we
 * derive a conservation-consistent split (solar first, then battery
 * discharge, then grid — serving campus demand before EV charging before
 * battery charging) purely for visualization. This is a display-only
 * allocation, not a separate calculation engine, and never invents energy
 * that the simulation didn't report.
 */
export interface DerivedFlows {
  solarToCampus: number;
  solarToEv: number;
  solarToBattery: number;
  solarCurtailed: number;
  batteryToCampus: number;
  batteryToEv: number;
  gridToCampus: number;
  gridToEv: number;
  gridToBattery: number;
  campusToGrid: number;
}

export function deriveFlows(step: StepResult): DerivedFlows {
  let solar = step.solar_used_kw;
  let battDischarge = step.battery_discharge_kw;
  let grid = step.grid_import_kw;
  let demand = step.demand_kw;
  let battCharge = step.battery_charge_kw;
  let ev = step.ev_charging_kw;

  const solarToCampus = Math.min(solar, demand); solar -= solarToCampus; demand -= solarToCampus;
  const batteryToCampus = Math.min(battDischarge, demand); battDischarge -= batteryToCampus; demand -= batteryToCampus;
  const gridToCampus = Math.min(grid, demand); grid -= gridToCampus; demand -= gridToCampus;

  const solarToEv = Math.min(solar, ev); solar -= solarToEv; ev -= solarToEv;
  const batteryToEv = Math.min(battDischarge, ev); battDischarge -= batteryToEv; ev -= batteryToEv;
  const gridToEv = Math.min(grid, ev); grid -= gridToEv; ev -= gridToEv;

  const solarToBattery = Math.min(solar, battCharge); solar -= solarToBattery; battCharge -= solarToBattery;
  const gridToBattery = Math.min(grid, battCharge); grid -= gridToBattery; battCharge -= gridToBattery;

  return {
    solarToCampus: round(solarToCampus),
    solarToEv: round(solarToEv),
    solarToBattery: round(solarToBattery),
    solarCurtailed: round(step.solar_curtailed_kw),
    batteryToCampus: round(batteryToCampus),
    batteryToEv: round(batteryToEv),
    gridToCampus: round(gridToCampus),
    gridToEv: round(gridToEv),
    gridToBattery: round(gridToBattery),
    campusToGrid: round(step.grid_export_kw),
  };
}

function round(n: number) {
  return Math.round(n * 10) / 10;
}

/** Normalizes a kW value against the site's rough scale into a 2–8px stroke width. */
export function flowWidth(kw: number, site: SiteProfile | null): number {
  const ref = Math.max(
    site?.solar_capacity_kw ?? 0,
    site?.battery_max_charge_kw ?? 0,
    site?.grid_max_import_kw ?? 0,
    site?.peak_demand_kw ?? 0,
    10
  );
  const t = Math.min(1, kw / ref);
  return 2 + t * 6;
}
