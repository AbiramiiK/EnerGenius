import { useCallback, useState } from "react";
import { runOptimize, runSimulate, type OptimizeResponse } from "../api/client";

export function useRun() {
  const [result, setResult] = useState<OptimizeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (
    operatingDate: string, strategy: string, persist: boolean, overrides?: Record<string, unknown>
  ) => {
    setLoading(true);
    setError(null);
    try {
      const data = persist
        ? await runOptimize(operatingDate, strategy, overrides)
        : await runSimulate(operatingDate, strategy, overrides);
      setResult(data);
      return data;
    } catch (e: any) {
      setError(e?.response?.data?.detail?.toString() ?? "Could not run the simulation. Check backend connectivity.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { result, loading, error, run, setResult };
}
