import { NavLink, Outlet, Link } from "react-router-dom";
import {
  LayoutDashboard, Network, ClipboardList, SlidersHorizontal, Cpu, Lightbulb,
  TrendingUp, History, HeartPulse, Settings, Leaf, Radio, User,
} from "lucide-react";
import clsx from "clsx";
import { useSite } from "../context/SiteContext";
import { Badge } from "./ui/Primitives";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/digital-twin", label: "Digital Twin", icon: Network },
  { to: "/daily-operations", label: "Daily Operations", icon: ClipboardList },
  { to: "/scenario-lab", label: "Scenario Lab", icon: SlidersHorizontal },
  { to: "/optimization", label: "Optimization", icon: Cpu },
  { to: "/explainable-ai", label: "Explainable AI", icon: Lightbulb },
  { to: "/forecasting", label: "Forecasting", icon: TrendingUp },
  { to: "/analytics", label: "Analytics & History", icon: History },
  { to: "/system-health", label: "System Health", icon: HeartPulse },
  { to: "/settings", label: "Site Settings", icon: Settings },
];

export default function Layout() {
  const { site, backendUp, selectedDate, setSelectedDate } = useSite();

  return (
    <div className="h-screen flex bg-canvas overflow-hidden">
      <aside className="w-64 shrink-0 bg-surface border-r border-sage flex flex-col hidden md:flex">
        <div className="px-5 py-5 flex items-center gap-2.5 border-b border-sage">
          <div className="bg-emerald rounded-lg p-1.5 glow-emerald">
            <Leaf size={20} className="text-white" />
          </div>
          <div>
            <div className="font-bold text-lg leading-tight text-text-primary tracking-tight">EnerGenius</div>
            <div className="text-[10px] text-emerald tracking-widest uppercase font-semibold">Think Smart. Power Green.</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-thin">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-mint text-text-primary"
                    : "text-text-secondary hover:bg-mint/60 hover:text-text-primary"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={18} className={isActive ? "text-emerald" : "text-text-secondary"} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-sage text-[11px] text-text-secondary flex items-center gap-1.5">
          <Radio size={12} />
          Local / demo environment — no authentication
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-surface/90 backdrop-blur border-b border-sage flex items-center justify-between px-6 shrink-0 shadow-[0_1px_3px_rgba(23,33,29,0.04)]">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-semibold text-text-primary truncate">
              {site?.site_name ?? "No site configured"}
            </span>
            {site?.is_demo && <Badge tone="info">Demo / synthetic data</Badge>}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-sm border border-sage rounded-lg px-2 py-1.5 bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-emerald/40"
            />
            <Badge tone={backendUp ? "success" : "danger"}>
              <span className={clsx("w-1.5 h-1.5 rounded-full", backendUp ? "bg-emerald" : "bg-danger")} />
              {backendUp ? "Backend connected" : "Backend unreachable"}
            </Badge>
            <Badge tone={site ? "success" : "warning"}>{site ? "Configured" : "Setup required"}</Badge>
            <Link
              to="/settings"
              title="Site configuration"
              className="p-2 rounded-lg border border-sage text-text-secondary hover:text-emerald hover:border-emerald/40 transition-colors"
            >
              <Settings size={16} />
            </Link>
            <div
              title="Local session — no authentication"
              className="w-8 h-8 rounded-full bg-mint border border-sage flex items-center justify-center text-emerald-dark"
            >
              <User size={15} />
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
