import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Leaf, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Card, Button, Field, inputClass } from "../components/ui/Primitives";
import { createSiteProfile, loadSampleProfile, type SiteProfile } from "../api/client";
import { useSite } from "../context/SiteContext";

const STEPS = [
  "Site details", "Solar system", "Battery system", "Campus demand",
  "EV charging", "Grid connection", "Optimization preferences", "Review & save",
];

type FormState = Partial<SiteProfile> & Record<string, any>;

const DEFAULTS: FormState = {
  site_name: "", site_type: "campus", timezone: "UTC",
  operating_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  operating_hours: { start: "08:00", end: "18:00" },
  time_step_minutes: 60,
  solar_capacity_kw: 100, solar_inverter_limit_kw: undefined, solar_notes: "",
  battery_capacity_kwh: 200, battery_initial_soc_pct: 50, battery_min_soc_pct: 10,
  battery_max_soc_pct: 95, battery_max_charge_kw: 50, battery_max_discharge_kw: 50,
  battery_charge_efficiency: 0.95, battery_discharge_efficiency: 0.95,
  typical_daily_demand_kwh: 600, peak_demand_kw: 80, essential_load_kw: 20,
  ev_charger_count: 2, ev_charger_power_kw: 7, ev_default_window_start: "09:00",
  ev_default_window_end: "17:00", ev_default_energy_kwh: 20,
  grid_max_import_kw: 120, grid_max_export_kw: 10, tariff_flat_rate: 0.18,
  grid_carbon_intensity: 0.45, grid_available: true,
  default_strategy: "cost_efficient", cost_weight: 0.5, emissions_weight: 0.3, battery_weight: 0.2,
};

export default function SetupWizard() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refresh } = useSite();
  const navigate = useNavigate();

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const canProceed = () => {
    if (step === 0) return !!form.site_name;
    if (step === 1) return !!form.solar_capacity_kw;
    if (step === 2) return !!form.battery_capacity_kwh && !!form.battery_max_charge_kw && !!form.battery_max_discharge_kw;
    if (step === 5) return !!form.grid_max_import_kw;
    return true;
  };

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await createSiteProfile(form);
      await refresh();
      navigate("/");
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Could not save site profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLoadSample() {
    setSaving(true);
    try {
      await loadSampleProfile();
      await refresh();
      navigate("/");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <div className="flex items-center gap-2 justify-center mb-6">
          <div className="bg-emerald rounded-lg p-2 glow-emerald"><Leaf size={22} className="text-forest" /></div>
          <div>
            <div className="font-bold text-xl text-text-primary">EnerGenius</div>
            <div className="text-xs text-emerald uppercase tracking-wide">Think Smart. Power Green.</div>
          </div>
        </div>

        <Card>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold">First-Time Site Setup</h2>
              <p className="text-sm text-text-secondary">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLoadSample} disabled={saving}>
              Load sample campus instead
            </Button>
          </div>

          <div className="flex gap-1 mb-6">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-emerald" : "bg-sage"}`} />
            ))}
          </div>

          {error && <div className="mb-4 text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">{error}</div>}

          <div className="space-y-4">
            {step === 0 && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Site / campus name">
                  <input className={inputClass} value={form.site_name} onChange={(e) => set({ site_name: e.target.value })} placeholder="e.g. Riverside Campus" />
                </Field>
                <Field label="Site type">
                  <select className={inputClass} value={form.site_type} onChange={(e) => set({ site_type: e.target.value })}>
                    <option value="campus">Campus</option>
                    <option value="commercial">Commercial building</option>
                    <option value="residential">Residential microgrid</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
                <Field label="Time zone">
                  <input className={inputClass} value={form.timezone} onChange={(e) => set({ timezone: e.target.value })} />
                </Field>
                <Field label="Time-step interval" hint="Resolution used by the optimizer">
                  <select className={inputClass} value={form.time_step_minutes} onChange={(e) => set({ time_step_minutes: Number(e.target.value) })}>
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>60 minutes</option>
                  </select>
                </Field>
                <Field label="Operating hours start">
                  <input type="time" className={inputClass} value={form.operating_hours?.start} onChange={(e) => set({ operating_hours: { start: e.target.value, end: form.operating_hours?.end ?? "18:00" } })} />
                </Field>
                <Field label="Operating hours end">
                  <input type="time" className={inputClass} value={form.operating_hours?.end} onChange={(e) => set({ operating_hours: { start: form.operating_hours?.start ?? "08:00", end: e.target.value } })} />
                </Field>
              </div>
            )}

            {step === 1 && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Installed solar capacity (kW)">
                  <input type="number" className={inputClass} value={form.solar_capacity_kw} onChange={(e) => set({ solar_capacity_kw: Number(e.target.value) })} />
                </Field>
                <Field label="Inverter / max output limit (kW)" hint="Optional">
                  <input type="number" className={inputClass} value={form.solar_inverter_limit_kw ?? ""} onChange={(e) => set({ solar_inverter_limit_kw: e.target.value ? Number(e.target.value) : undefined })} />
                </Field>
                <Field label="Notes" hint="Optional">
                  <input className={inputClass} value={form.solar_notes ?? ""} onChange={(e) => set({ solar_notes: e.target.value })} />
                </Field>
                <div className="col-span-2 text-xs text-text-secondary bg-mint rounded-lg p-3">
                  Historical solar generation data can be uploaded later from Daily Operations or Forecasting.
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Battery capacity (kWh)"><input type="number" className={inputClass} value={form.battery_capacity_kwh} onChange={(e) => set({ battery_capacity_kwh: Number(e.target.value) })} /></Field>
                <Field label="Initial / default SOC (%)"><input type="number" className={inputClass} value={form.battery_initial_soc_pct} onChange={(e) => set({ battery_initial_soc_pct: Number(e.target.value) })} /></Field>
                <Field label="Minimum SOC (%)"><input type="number" className={inputClass} value={form.battery_min_soc_pct} onChange={(e) => set({ battery_min_soc_pct: Number(e.target.value) })} /></Field>
                <Field label="Maximum SOC (%)"><input type="number" className={inputClass} value={form.battery_max_soc_pct} onChange={(e) => set({ battery_max_soc_pct: Number(e.target.value) })} /></Field>
                <Field label="Max charge power (kW)"><input type="number" className={inputClass} value={form.battery_max_charge_kw} onChange={(e) => set({ battery_max_charge_kw: Number(e.target.value) })} /></Field>
                <Field label="Max discharge power (kW)"><input type="number" className={inputClass} value={form.battery_max_discharge_kw} onChange={(e) => set({ battery_max_discharge_kw: Number(e.target.value) })} /></Field>
                <Field label="Charge efficiency" hint="0–1"><input type="number" step="0.01" className={inputClass} value={form.battery_charge_efficiency} onChange={(e) => set({ battery_charge_efficiency: Number(e.target.value) })} /></Field>
                <Field label="Discharge efficiency" hint="0–1"><input type="number" step="0.01" className={inputClass} value={form.battery_discharge_efficiency} onChange={(e) => set({ battery_discharge_efficiency: Number(e.target.value) })} /></Field>
              </div>
            )}

            {step === 3 && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Typical daily demand (kWh)" hint="Used if no historical data is uploaded"><input type="number" className={inputClass} value={form.typical_daily_demand_kwh ?? ""} onChange={(e) => set({ typical_daily_demand_kwh: Number(e.target.value) })} /></Field>
                <Field label="Peak demand estimate (kW)"><input type="number" className={inputClass} value={form.peak_demand_kw ?? ""} onChange={(e) => set({ peak_demand_kw: Number(e.target.value) })} /></Field>
                <Field label="Essential load (kW)" hint="Optional, used for reliability reference"><input type="number" className={inputClass} value={form.essential_load_kw ?? ""} onChange={(e) => set({ essential_load_kw: Number(e.target.value) })} /></Field>
                <div className="text-xs text-text-secondary bg-mint rounded-lg p-3 flex items-center">
                  Historical demand CSV/Excel can be uploaded later from Daily Operations.
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Number of EV chargers"><input type="number" className={inputClass} value={form.ev_charger_count} onChange={(e) => set({ ev_charger_count: Number(e.target.value) })} /></Field>
                <Field label="Max charger power (kW)"><input type="number" className={inputClass} value={form.ev_charger_power_kw} onChange={(e) => set({ ev_charger_power_kw: Number(e.target.value) })} /></Field>
                <Field label="Default charging window start"><input type="time" className={inputClass} value={form.ev_default_window_start} onChange={(e) => set({ ev_default_window_start: e.target.value })} /></Field>
                <Field label="Default charging window end"><input type="time" className={inputClass} value={form.ev_default_window_end} onChange={(e) => set({ ev_default_window_end: e.target.value })} /></Field>
                <Field label="Default required energy per EV (kWh)"><input type="number" className={inputClass} value={form.ev_default_energy_kwh} onChange={(e) => set({ ev_default_energy_kwh: Number(e.target.value) })} /></Field>
                <div className="text-xs text-text-secondary bg-mint rounded-lg p-3 flex items-center">
                  Daily EV arrivals/departures remain editable each day in Daily Operations.
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Max grid import power (kW)"><input type="number" className={inputClass} value={form.grid_max_import_kw} onChange={(e) => set({ grid_max_import_kw: Number(e.target.value) })} /></Field>
                <Field label="Max grid export power (kW)" hint="Optional, 0 if none"><input type="number" className={inputClass} value={form.grid_max_export_kw} onChange={(e) => set({ grid_max_export_kw: Number(e.target.value) })} /></Field>
                <Field label="Flat electricity tariff (currency/kWh)"><input type="number" step="0.01" className={inputClass} value={form.tariff_flat_rate} onChange={(e) => set({ tariff_flat_rate: Number(e.target.value) })} /></Field>
                <Field label="Grid carbon intensity (kg CO2/kWh)"><input type="number" step="0.01" className={inputClass} value={form.grid_carbon_intensity} onChange={(e) => set({ grid_carbon_intensity: Number(e.target.value) })} /></Field>
                <Field label="Grid available">
                  <select className={inputClass} value={form.grid_available ? "yes" : "no"} onChange={(e) => set({ grid_available: e.target.value === "yes" })}>
                    <option value="yes">Yes</option>
                    <option value="no">No / restricted</option>
                  </select>
                </Field>
              </div>
            )}

            {step === 6 && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Default strategy">
                  <select className={inputClass} value={form.default_strategy} onChange={(e) => set({ default_strategy: e.target.value })}>
                    <option value="cost_efficient">Cost Efficient</option>
                    <option value="more_sustainable">More Sustainable</option>
                    <option value="balanced">Balanced</option>
                    <option value="reliability_first">Reliability First</option>
                  </select>
                </Field>
                <div />
                <Field label="Cost weight" hint="Used by the Balanced strategy"><input type="number" step="0.1" className={inputClass} value={form.cost_weight} onChange={(e) => set({ cost_weight: Number(e.target.value) })} /></Field>
                <Field label="Emissions weight"><input type="number" step="0.1" className={inputClass} value={form.emissions_weight} onChange={(e) => set({ emissions_weight: Number(e.target.value) })} /></Field>
                <Field label="Battery-use weight" hint="Degradation proxy"><input type="number" step="0.1" className={inputClass} value={form.battery_weight} onChange={(e) => set({ battery_weight: Number(e.target.value) })} /></Field>
              </div>
            )}

            {step === 7 && (
              <div className="space-y-3">
                <p className="text-sm text-text-secondary">Review your configuration before saving. You can edit any of this later from Site Settings.</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <ReviewRow label="Site" value={`${form.site_name} (${form.site_type})`} />
                  <ReviewRow label="Solar capacity" value={`${form.solar_capacity_kw} kW`} />
                  <ReviewRow label="Battery" value={`${form.battery_capacity_kwh} kWh, ${form.battery_max_charge_kw}/${form.battery_max_discharge_kw} kW`} />
                  <ReviewRow label="Typical demand" value={`${form.typical_daily_demand_kwh} kWh/day`} />
                  <ReviewRow label="EV chargers" value={`${form.ev_charger_count} × ${form.ev_charger_power_kw} kW`} />
                  <ReviewRow label="Grid import limit" value={`${form.grid_max_import_kw} kW`} />
                  <ReviewRow label="Tariff" value={`${form.tariff_flat_rate}/kWh`} />
                  <ReviewRow label="Default strategy" value={form.default_strategy?.replace("_", " ")} />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between mt-8">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              <span className="flex items-center gap-1"><ArrowLeft size={16} /> Back</span>
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canProceed()}>
                <span className="flex items-center gap-1">Next <ArrowRight size={16} /></span>
              </Button>
            ) : (
              <Button onClick={handleSave} disabled={saving}>
                <span className="flex items-center gap-1"><CheckCircle2 size={16} /> {saving ? "Saving..." : "Save & finish setup"}</span>
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between border-b border-sage/60 py-1.5">
      <span className="text-text-secondary">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
