import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SiteProvider, useSite } from "./context/SiteContext";
import Layout from "./components/Layout";
import SetupWizard from "./pages/SetupWizard";
import Overview from "./pages/Overview";
import DigitalTwinPage from "./pages/DigitalTwinPage";
import DailyOperations from "./pages/DailyOperations";
import ScenarioLab from "./pages/ScenarioLab";
import Optimization from "./pages/Optimization";
import ExplainableAI from "./pages/ExplainableAI";
import Forecasting from "./pages/Forecasting";
import AnalyticsHistory from "./pages/AnalyticsHistory";
import SystemHealth from "./pages/SystemHealth";
import SiteSettings from "./pages/SiteSettings";
import { Spinner } from "./components/ui/Primitives";

function Gate({ children }: { children: React.ReactNode }) {
  const { loading, configured, backendUp } = useSite();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <Spinner />
      </div>
    );
  }
  if (!backendUp) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas p-6">
        <div className="max-w-md text-center">
          <h2 className="text-lg font-semibold text-danger">Backend unreachable</h2>
          <p className="text-sm text-text-secondary mt-2">
            EnerGenius could not reach the API at http://127.0.0.1:8000. Make sure the FastAPI backend is running, then refresh.
          </p>
        </div>
      </div>
    );
  }
  if (!configured) return <SetupWizard />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Gate>
      <Routes>
        <Route path="/setup" element={<SetupWizard />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Overview />} />
          <Route path="/digital-twin" element={<DigitalTwinPage />} />
          <Route path="/daily-operations" element={<DailyOperations />} />
          <Route path="/scenario-lab" element={<ScenarioLab />} />
          <Route path="/optimization" element={<Optimization />} />
          <Route path="/explainable-ai" element={<ExplainableAI />} />
          <Route path="/forecasting" element={<Forecasting />} />
          <Route path="/analytics" element={<AnalyticsHistory />} />
          <Route path="/system-health" element={<SystemHealth />} />
          <Route path="/settings" element={<SiteSettings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Gate>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <SiteProvider>
        <AppRoutes />
      </SiteProvider>
    </BrowserRouter>
  );
}
