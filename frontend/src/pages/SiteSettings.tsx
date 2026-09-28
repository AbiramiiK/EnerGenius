import { useEffect, useState } from "react";
import { Card, CardHeader, Button, Field, inputClass, Badge } from "../components/ui/Primitives";
import { useSite } from "../context/SiteContext";
import { updateSiteProfile, type SiteProfile } from "../api/client";

export default function SiteSettings() {
  const { site, refresh } = useSite();
  const [form, setForm] = useState<SiteProfile | null>(site);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => setForm(site), [site]);

  if (!form) return <Card>No site profile loaded.</Card>;

  const set = (patch: Partial<SiteProfile>) => setForm((f) => (f ? { ...f, ...patch } : f));

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    try {
      await updateSiteProfile(form.site_id, form);
      await refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Site Settings</h1>
          <p className="text-sm text-text-secondary">Profile version {form.profile_version} · last updated {new Date(form.updated_at).toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <Badge tone="success">Saved</Badge>}
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
        </div>
      </div>

      <Card>
        <CardHeader title="Site Details" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Site name"><input className={inputClass} value={form.site_name} onChange={(e) => set({ site_name: e.target.value })} /></Field>
          <Field label="Time zone"><input className={inputClass} value={form.timezone} onChange={(e) => set({ timezone: e.target.value })} /></Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Solar System" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Solar capacity (kW)"><input type="number" className={inputClass} value={form.solar_capacity_kw} onChange={(e) => set({ solar_capacity_kw: Number(e.target.value) })} /></Field>
          <Field label="Inverter limit (kW)"><input type="number" className={inputClass} value={form.solar_inverter_limit_kw ?? ""} onChange={(e) => set({ solar_inverter_limit_kw: Number(e.target.value) })} /></Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Battery System" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Capacity (kWh)"><input type="number" className={inputClass} value={form.battery_capacity_kwh} onChange={(e) => set({ battery_capacity_kwh: Number(e.target.value) })} /></Field>
          <Field label="Min SOC (%)"><input type="number" className={inputClass} value={form.battery_min_soc_pct} onChange={(e) => set({ battery_min_soc_pct: Number(e.target.value) })} /></Field>
          <Field label="Max SOC (%)"><input type="number" className={inputClass} value={form.battery_max_soc_pct} onChange={(e) => set({ battery_max_soc_pct: Number(e.target.value) })} /></Field>
          <Field label="Max charge power (kW)"><input type="number" className={inputClass} value={form.battery_max_charge_kw} onChange={(e) => set({ battery_max_charge_kw: Number(e.target.value) })} /></Field>
          <Field label="Max discharge power (kW)"><input type="number" className={inputClass} value={form.battery_max_discharge_kw} onChange={(e) => set({ battery_max_discharge_kw: Number(e.target.value) })} /></Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Grid & Tariff" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Max grid import (kW)"><input type="number" className={inputClass} value={form.grid_max_import_kw} onChange={(e) => set({ grid_max_import_kw: Number(e.target.value) })} /></Field>
          <Field label="Max grid export (kW)"><input type="number" className={inputClass} value={form.grid_max_export_kw} onChange={(e) => set({ grid_max_export_kw: Number(e.target.value) })} /></Field>
          <Field label="Flat tariff (currency/kWh)"><input type="number" step="0.01" className={inputClass} value={form.tariff_flat_rate} onChange={(e) => set({ tariff_flat_rate: Number(e.target.value) })} /></Field>
          <Field label="Carbon intensity (kg CO2/kWh)"><input type="number" step="0.01" className={inputClass} value={form.grid_carbon_intensity} onChange={(e) => set({ grid_carbon_intensity: Number(e.target.value) })} /></Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Optimization Preferences" />
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
          <Field label="Cost weight"><input type="number" step="0.1" className={inputClass} value={form.cost_weight} onChange={(e) => set({ cost_weight: Number(e.target.value) })} /></Field>
          <Field label="Emissions weight"><input type="number" step="0.1" className={inputClass} value={form.emissions_weight} onChange={(e) => set({ emissions_weight: Number(e.target.value) })} /></Field>
          <Field label="Battery-use weight"><input type="number" step="0.1" className={inputClass} value={form.battery_weight} onChange={(e) => set({ battery_weight: Number(e.target.value) })} /></Field>
        </div>
      </Card>
    </div>
  );
}
