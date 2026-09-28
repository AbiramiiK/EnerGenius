# EnerGenius

**AI-Driven Renewable Energy Optimization for Smart Microgrids**
*Think Smart. Power Green.*

EnerGenius is a working prototype that coordinates solar generation, battery storage,
campus/building demand, EV charging, and utility-grid electricity through a real
constrained optimization engine, with a greenery-themed React dashboard for
configuration, daily operations, scenario testing, and analysis.

This is a hackathon prototype. It uses simulated/synthetic data when real historical
data is unavailable — every such value is clearly labeled in the UI as an estimate.

---

## 1. Architecture

```
ENERGENIUS/
  backend/            FastAPI + SQLAlchemy + SQLite + PuLP optimization engine
    app/
      main.py          FastAPI app, CORS, health check, demo profile seeding
      models.py        SQLAlchemy models (SiteProfile, DailyInput, SimulationRun, ...)
      schemas.py        Pydantic request/response schemas
      engine.py         Scenario builder shared by optimizer + baseline
      optimizer.py       PuLP constrained LP optimizer (4 strategies)
      baseline.py         Rule-based baseline schedule (solar-first)
      validation.py        Constraint validation + KPI summarization
      forecasting.py         Historical-average / RandomForest / baseline-shape forecasting
      explain.py               Explainable-AI recommendation generation (no LLM required)
      upload_validation.py      CSV/Excel validation
      core_run.py                Orchestrates optimize + baseline + validate + explain + persist
      routers/                    API endpoints
    tests/                         pytest suite (27 tests)
  frontend/           React + Vite + TypeScript + Tailwind CSS v4
    src/
      pages/            One page per navigation item (Overview, Digital Twin, ...)
      components/        Layout, Digital Twin SVG visualization, chart wrappers, UI primitives
      context/            Site profile + selected-date global state
      api/client.ts         Typed API client
  .claude/launch.json  Dev-server config for the frontend preview
```

## 2. Prerequisites

- Python 3.11+
- Node.js 18+ / npm

## 3. Running locally (Windows PowerShell)

### Backend

```powershell
cd backend
python -m venv venv
./venv/Scripts/Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API is now at `http://127.0.0.1:8000` (interactive docs at `/docs`). A SQLite
database file `backend/energenius.db` is created automatically on first run.

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

The app is now at `http://localhost:5173`.

## 4. First-time site setup

1. Open `http://localhost:5173`. With no site profile saved, the **First-Time Site
   Setup** wizard appears automatically.
2. Either complete the 8-step wizard (site details → solar → battery → demand → EV →
   grid → optimization preferences → review & save), or click **"Load sample campus
   instead"** for an instant synthetic demo profile (100 kW solar, 250 kWh battery,
   4 EV chargers, time-of-use tariff).
3. On save, you're redirected to the **Overview** dashboard. The profile persists in
   SQLite — closing and reopening the app does not require re-entering it.

## 5. Daily operations

Go to **Daily Operations**, pick a date (top-right date picker), and enter only what
changes day to day: starting battery SOC, EV sessions (arrival/departure/required
energy), tariff override, grid restrictions, and notes. Historical demand/solar/EV
CSV or Excel files can be uploaded here (validated for columns, types, timestamps,
duplicates, and value ranges).

## 6. Running optimization & scenarios

- **Overview** / **Optimization**: pick a strategy (Cost Efficient, More Sustainable,
  Balanced, Reliability First) and click **Run Optimization** — this persists a
  `SimulationRun` you can revisit later in Analytics & History.
- **Scenario Lab**: adjust sliders (solar availability, demand scale, battery SOC, EV
  count, grid limit, tariff) or click a preset (Sunny day, Cloudy day, ...), then
  click **Run Simulation** — this recomputes via the same backend optimizer but does
  **not** persist a run, so you can experiment freely.
- **Digital Twin**: drag the time slider to see the optimized energy flows (solar,
  battery, grid, EV, campus demand) animate across the day.
- **Explainable AI**: recommendation cards generated directly from the solver's
  actual output (no external LLM call).
- **System Health**: constraint validation (energy balance, SOC bounds, power limits,
  solar/grid limits) for any past run.
- **Analytics & History**: cost/emissions trends across runs, per-run detail, CSV
  export.

## 7. Sample data

`backend/sample_data/` contains synthetic `sample_demand_history.csv`,
`sample_solar_history.csv`, and `sample_ev_history.csv` files (5 days of hourly data)
that can be uploaded from **Daily Operations → Historical Data Upload** to exercise
the CSV validation and forecasting pipeline end-to-end.

## 8. Running tests

```powershell
cd backend
./venv/Scripts/Activate.ps1
pytest -q
```

27 tests cover: site profile persistence & reload, daily input isolation per date,
CSV/Excel validation (bad timestamps, negatives, duplicates, invalid EV rows), energy
balance, battery SOC/power limits, solar/grid limits, EV energy constraints,
infeasible-scenario detection, strategy objective differentiation, baseline vs
optimized comparison, simulation history persistence, and dashboard/backend KPI
consistency.

```powershell
cd frontend
npm run build
```

confirms the frontend type-checks and builds cleanly.

## 9. Optimization objectives & constraints

The optimizer (PuLP, CBC solver) uses hourly (or configured-interval) time steps with
decision variables for solar used, battery charge/discharge, battery SOC, per-EV-session
charging power, and grid import/export. Hard constraints: energy balance at every step,
solar-used ≤ available generation, battery SOC within configured bounds, battery
charge/discharge within configured power limits, EV per-session energy requirement
(hard — infeasible if physically unattainable in the window), and grid import/export
within configured limits.

| Strategy | Objective |
|---|---|
| Cost Efficient | Minimize grid-import cost (tariff-weighted), net of export credit |
| More Sustainable | Minimize grid-import CO2 emissions (carbon-intensity-weighted) |
| Balanced | Minimize `cost_weight·cost + emissions_weight·emissions + battery_weight·battery_use` |
| Reliability First | Maximize end-of-day battery reserve (resilience proxy), cost-aware secondary term |

A transparent **rule-based baseline** (solar-first, then battery, then grid; EVs
charge at full power for their whole window) is evaluated on the identical scenario
for every run, so the comparison in Optimization / Scenario Lab / Analytics is
apples-to-apples.

## 10. Limitations & assumptions

- **Reliability First** is a system-level battery-reserve proxy, not per-device
  essential-load metering — the codebase does not track which physical loads are
  "essential" beyond the single `essential_load_kw` reference value captured at setup.
- Forecasting falls back through three tiers depending on available history: no
  history → the configured typical-day shape (labeled `no_history`); some history →
  an hour-of-day historical average (labeled `limited_history`); ≥72 records → a
  RandomForest model evaluated on a real train/test holdout split (MAE/RMSE reported
  only when actually computed — never fabricated).
- The demo/sample profile and any auto-generated solar/demand shapes are clearly
  labeled as synthetic in the UI (`data_labels` in the API response, badges in
  Overview/Scenario Lab).
- Single-site prototype: one `SiteProfile` per database. Historical `SimulationRun`s
  and `DailyInput`s are retained across profile edits (profile is updated in place,
  version incremented).
- No authentication is implemented; this is explicitly a local/demo environment
  (stated in the sidebar).
- EV charging is modeled as one dedicated charger per session at a fixed max power;
  overlapping sessions beyond the configured charger count are not capacity-checked
  against a shared pool.
- The CBC solver bundled with PuLP is used; very large time-step counts (e.g. 1-minute
  resolution for a full day) were not performance-tested.

## 11. Known incomplete items

- No automated E2E (browser) test suite is included; manual verification was
  performed via the running dev servers (see backend `tests/` for the automated
  coverage that does exist).
- Export/import of the full site configuration as a file is not implemented — only
  simulation-run CSV export.
