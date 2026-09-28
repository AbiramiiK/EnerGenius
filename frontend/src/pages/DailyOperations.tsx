import { useEffect, useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { Card, CardHeader, Button, Field, inputClass, Badge, EmptyState } from "../components/ui/Primitives";
import { useSite } from "../context/SiteContext";
import { getDailyInput, saveDailyInput, uploadDataset } from "../api/client";

interface EvSession { charger_id: string; arrival: string; departure: string; required_kwh: number; }

export default function DailyOperations() {
  const { site, selectedDate, configured } = useSite();
  const [startingSoc, setStartingSoc] = useState<number | "">("");
  const [gridRestricted, setGridRestricted] = useState(false);
  const [gridLimit, setGridLimit] = useState<number | "">("");
  const [tariffOverride, setTariffOverride] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [evSessions, setEvSessions] = useState<EvSession[]>([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadedExisting, setLoadedExisting] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<Record<string, string>>({});

  useEffect(() => {
    setSaved(false);
    getDailyInput(selectedDate)
      .then((d) => {
        setStartingSoc(d.starting_battery_soc_pct ?? "");
        setGridRestricted(!!d.grid_restricted);
        setGridLimit(d.grid_restricted_limit_kw ?? "");
        setTariffOverride(d.tariff_override ?? "");
        setNotes(d.notes ?? "");
        setEvSessions(d.ev_sessions ?? []);
        setLoadedExisting(true);
      })
      .catch(() => {
        setStartingSoc(site?.battery_initial_soc_pct ?? "");
        setGridRestricted(false);
        setGridLimit("");
        setTariffOverride("");
        setNotes("");
        setEvSessions(
          site && site.ev_charger_count > 0
            ? Array.from({ length: site.ev_charger_count }, (_, i) => ({
                charger_id: `EV-${i + 1}`,
                arrival: site.ev_default_window_start,
                departure: site.ev_default_window_end,
                required_kwh: site.ev_default_energy_kwh,
              }))
            : []
        );
        setLoadedExisting(false);
      });
  }, [selectedDate, site]);

  if (!configured) {
    return <Card><EmptyState title="Complete setup first" /></Card>;
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveDailyInput({
        operating_date: selectedDate,
        starting_battery_soc_pct: startingSoc === "" ? null : Number(startingSoc),
        demand_source: "user-entered",
        solar_source: "estimated",
        ev_sessions: evSessions,
        tariff_override: tariffOverride === "" ? null : Number(tariffOverride),
        grid_restricted: gridRestricted,
        grid_restricted_limit_kw: gridLimit === "" ? null : Number(gridLimit),
        notes,
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(kind: "demand" | "solar" | "ev", file: File) {
    setUploadMsg((m) => ({ ...m, [kind]: "Uploading..." }));
    try {
      const res = await uploadDataset(kind, file);
      setUploadMsg((m) => ({ ...m, [kind]: `${res.row_count} rows validated${res.warnings.length ? `, ${res.warnings.length} warning(s)` : ""}.` }));
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setUploadMsg((m) => ({ ...m, [kind]: typeof detail === "string" ? detail : (detail?.errors ?? ["Upload failed"]).join(" ") }));
    }
  }

  function updateSession(i: number, patch: Partial<EvSession>) {
    setEvSessions((s) => s.map((sess, idx) => (idx === i ? { ...sess, ...patch } : sess)));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Daily Operations</h1>
          <p className="text-sm text-text-secondary">Only enter what changes day to day — fixed infrastructure is loaded from your saved site profile.</p>
        </div>
        <Badge tone={loadedExisting ? "info" : "warning"}>{loadedExisting ? "Editing saved record" : "No record yet for this date"}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Battery & Grid" subtitle={`Date: ${selectedDate}`} />
          <div className="space-y-4">
            <Field label="Current / starting battery SOC (%)" hint={`Site default: ${site?.battery_initial_soc_pct}%`}>
              <input type="number" className={inputClass} value={startingSoc} onChange={(e) => setStartingSoc(e.target.value === "" ? "" : Number(e.target.value))} />
            </Field>
            <Field label="Tariff override (currency/kWh)" hint={`Site default: ${site?.tariff_flat_rate}`}>
              <input type="number" step="0.01" className={inputClass} value={tariffOverride} onChange={(e) => setTariffOverride(e.target.value === "" ? "" : Number(e.target.value))} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={gridRestricted} onChange={(e) => setGridRestricted(e.target.checked)} />
              Grid restricted / outage today
            </label>
            {gridRestricted && (
              <Field label="Restricted grid import limit (kW)">
                <input type="number" className={inputClass} value={gridLimit} onChange={(e) => setGridLimit(e.target.value === "" ? "" : Number(e.target.value))} />
              </Field>
            )}
            <Field label="Notes" hint="Optional">
              <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="EV Sessions Today"
            action={<Button size="sm" variant="secondary" onClick={() => setEvSessions((s) => [...s, { charger_id: `EV-${s.length + 1}`, arrival: "09:00", departure: "17:00", required_kwh: 20 }])}><Plus size={14} /></Button>}
          />
          <div className="space-y-3 max-h-80 overflow-y-auto scrollbar-thin pr-1">
            {evSessions.map((s, i) => (
              <div key={i} className="grid grid-cols-5 gap-2 items-end border border-sage rounded-lg p-2">
                <input className={inputClass} value={s.charger_id} onChange={(e) => updateSession(i, { charger_id: e.target.value })} />
                <input type="time" className={inputClass} value={s.arrival} onChange={(e) => updateSession(i, { arrival: e.target.value })} />
                <input type="time" className={inputClass} value={s.departure} onChange={(e) => updateSession(i, { departure: e.target.value })} />
                <input type="number" className={inputClass} value={s.required_kwh} onChange={(e) => updateSession(i, { required_kwh: Number(e.target.value) })} />
                <button onClick={() => setEvSessions((arr) => arr.filter((_, idx) => idx !== i))} className="text-danger p-2"><Trash2 size={16} /></button>
              </div>
            ))}
            {!evSessions.length && <EmptyState title="No EV sessions" description="Add a session or leave empty if no EVs are charging today." />}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Historical Data Upload" subtitle="CSV/Excel — validated for columns, types, timestamps, and duplicates." />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(["demand", "solar", "ev"] as const).map((kind) => (
            <div key={kind} className="border border-sage rounded-xl p-3">
              <div className="font-medium text-sm capitalize mb-2">{kind} history</div>
              <label className="flex items-center gap-2 text-sm text-emerald cursor-pointer">
                <Upload size={16} />
                <span>Choose file</span>
                <input type="file" accept=".csv,.xlsx" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(kind, e.target.files[0])} />
              </label>
              {uploadMsg[kind] && <p className="text-xs text-text-secondary mt-2">{uploadMsg[kind]}</p>}
              <p className="text-[11px] text-text-secondary mt-2">
                {kind === "ev" ? "Columns: arrival, departure, required_kwh" : `Columns: timestamp, ${kind}_kw`}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        {saved && <Badge tone="success">Saved</Badge>}
        <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Daily Inputs"}</Button>
      </div>
    </div>
  );
}
