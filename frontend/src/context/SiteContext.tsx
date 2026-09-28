import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getSiteProfile, getHealth, type SiteProfile } from "../api/client";

interface SiteContextValue {
  site: SiteProfile | null;
  loading: boolean;
  backendUp: boolean;
  configured: boolean;
  selectedDate: string;
  setSelectedDate: (d: string) => void;
  refresh: () => Promise<void>;
}

const SiteContext = createContext<SiteContextValue | undefined>(undefined);

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function SiteProvider({ children }: { children: ReactNode }) {
  const [site, setSite] = useState<SiteProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [backendUp, setBackendUp] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayStr());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const health = await getHealth();
      setBackendUp(true);
      setConfigured(health.site_configured);
      if (health.site_configured) {
        const profile = await getSiteProfile();
        setSite(profile);
      } else {
        setSite(null);
      }
    } catch (e) {
      setBackendUp(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <SiteContext.Provider value={{ site, loading, backendUp, configured, selectedDate, setSelectedDate, refresh }}>
      {children}
    </SiteContext.Provider>
  );
}

export function useSite() {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error("useSite must be used within SiteProvider");
  return ctx;
}
