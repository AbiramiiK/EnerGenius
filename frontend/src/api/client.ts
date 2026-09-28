import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000",
  headers: { "Content-Type": "application/json" },
});

export interface SiteProfile {
  site_id: string;
  site_name: string;
  site_type: string;
  timezone: string;
  operating_days: string[];
  operating_hours: { start: string; end: string };
  time_step_minutes: number;

  solar_capacity_kw: number;
  solar_inverter_limit_kw?: number | null;
  solar_notes?: string | null;
  solar_has_history: boolean;

  battery_capacity_kwh: number;
  battery_initial_soc_pct: number;
  battery_min_soc_pct: number;
  battery_max_soc_pct: number;
  battery_max_charge_kw: number;
  battery_max_discharge_kw: number;
  battery_charge_efficiency: number;
  battery_discharge_efficiency: number;

  typical_daily_demand_kwh?: number | null;
  peak_demand_kw?: number | null;
  essential_load_kw?: number | null;
  demand_has_history: boolean;

  ev_charger_count: number;
  ev_charger_power_kw: number;
  ev_default_window_start: string;
  ev_default_window_end: string;
  ev_default_energy_kwh: number;
  ev_has_history: boolean;

  grid_max_import_kw: number;
  grid_max_export_kw: number;
  tariff_flat_rate: number;
  tariff_schedule?: { start: string; end: string; rate: number }[] | null;
  grid_carbon_intensity: number;
  grid_available: boolean;

  default_strategy: string;
  cost_weight: number;
  emissions_weight: number;
  battery_weight: number;

  profile_version: number;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface StepResult {
  step_index: number;
  timestamp: string;
  solar_generation_kw: number;
  solar_used_kw: number;
  solar_curtailed_kw: number;
  demand_kw: number;
  battery_charge_kw: number;
  battery_discharge_kw: number;
  battery_soc_pct: number;
  ev_charging_kw: number;
  grid_import_kw: number;
  grid_export_kw: number;
  cost: number;
  emissions_kg: number;
}

export interface ScheduleSummary {
  total_cost: number;
  total_emissions_kg: number;
  total_demand_kwh: number;
  total_solar_generation_kwh: number;
  total_solar_used_kwh: number;
  solar_curtailed_kwh: number;
  total_battery_discharge_kwh: number;
  total_ev_charged_kwh: number;
  ev_completion_fraction: number;
  total_grid_import_kwh: number;
  total_grid_export_kwh: number;
  peak_grid_import_kw: number;
  renewable_share: number;
  battery_cycling_kwh: number;
}

export interface ValidationCheck {
  name: string;
  status: "validated" | "warning" | "infeasible";
  detail: string;
}

export interface ValidationResult {
  overall_status: string;
  checks: ValidationCheck[];
}

export interface RecommendationCard {
  title: string;
  recommendation: string;
  why: string;
  inputs_considered: Record<string, unknown>;
  constraints: string[];
  expected_effect: string;
  trade_off: string;
  uncertainty: string;
}

export interface OptimizeResponse {
  run_id: string | null;
  strategy: string;
  strategy_description: string;
  solver_status: "optimal" | "infeasible" | "error";
  solver_message?: string;
  data_labels: { solar_synthetic: boolean; demand_synthetic: boolean };
  baseline: { steps: StepResult[]; summary: ScheduleSummary; validation: ValidationResult; status: string };
  optimized: { steps: StepResult[]; summary: ScheduleSummary | null; validation: ValidationResult | null; status: string; objective_value?: number };
  comparison?: Record<string, { baseline: number; optimized: number; absolute_diff: number; pct_diff: number | null }>;
  recommendations: RecommendationCard[];
}

export const STRATEGIES = [
  { value: "cost_efficient", label: "Cost Efficient" },
  { value: "more_sustainable", label: "More Sustainable" },
  { value: "balanced", label: "Balanced" },
  { value: "reliability_first", label: "Reliability First" },
];

export async function getHealth() {
  const { data } = await api.get("/api/health");
  return data as { status: string; site_configured: boolean };
}

export async function getSiteProfile() {
  const { data } = await api.get("/api/site-profile");
  return data as SiteProfile;
}

export async function createSiteProfile(payload: Partial<SiteProfile>) {
  const { data } = await api.post("/api/site-profile", payload);
  return data as SiteProfile;
}

export async function updateSiteProfile(siteId: string, payload: Partial<SiteProfile>) {
  const { data } = await api.put(`/api/site-profile/${siteId}`, payload);
  return data as SiteProfile;
}

export async function loadSampleProfile() {
  const { data } = await api.post("/api/demo/load-sample");
  return data as SiteProfile;
}

export async function getDailyInput(date: string) {
  const { data } = await api.get(`/api/daily-inputs/${date}`);
  return data;
}

export async function saveDailyInput(payload: Record<string, unknown>) {
  const { data } = await api.post("/api/daily-inputs", payload);
  return data;
}

export async function uploadDataset(kind: "demand" | "solar" | "ev", file: File) {
  const form = new FormData();
  form.append("kind", kind);
  form.append("file", file);
  const { data } = await api.post("/api/data/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function runForecast(target: "solar" | "demand", operating_date: string) {
  const { data } = await api.post("/api/forecast", { target, operating_date });
  return data;
}

export async function runOptimize(operating_date: string, strategy: string, scenario_overrides?: Record<string, unknown>) {
  const { data } = await api.post("/api/optimize", { operating_date, strategy, scenario_overrides });
  return data as OptimizeResponse;
}

export async function runSimulate(operating_date: string, strategy: string, scenario_overrides?: Record<string, unknown>) {
  const { data } = await api.post("/api/simulate", { operating_date, strategy, scenario_overrides });
  return data as OptimizeResponse;
}

export async function listSimulationRuns() {
  const { data } = await api.get("/api/simulation-runs");
  return data as Array<{
    run_id: string; operating_date: string; strategy: string; solver_status: string;
    objective_value: number | null; created_at: string; output_snapshot: any;
  }>;
}

export async function getSimulationRun(runId: string) {
  const { data } = await api.get(`/api/simulation-runs/${runId}`);
  return data;
}

export async function getAnalytics(start_date?: string, end_date?: string) {
  const { data } = await api.get("/api/analytics", { params: { start_date, end_date } });
  return data;
}

export async function getSystemHealth(runId: string) {
  const { data } = await api.get(`/api/system-health/${runId}`);
  return data as ValidationResult;
}
