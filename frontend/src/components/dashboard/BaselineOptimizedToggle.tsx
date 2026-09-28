export default function BaselineOptimizedToggle({
  view, onChange, disabled,
}: { view: "optimized" | "baseline"; onChange: (v: "optimized" | "baseline") => void; disabled?: boolean }) {
  return (
    <div className="flex rounded-lg border border-sage overflow-hidden text-xs font-semibold shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("optimized")}
        className={`px-3 py-1.5 transition-colors disabled:opacity-40 ${view === "optimized" ? "bg-emerald text-white" : "bg-surface text-text-secondary hover:text-text-primary"}`}
      >
        Optimized
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("baseline")}
        className={`px-3 py-1.5 transition-colors border-l border-sage disabled:opacity-40 ${view === "baseline" ? "bg-white text-text-primary ring-1 ring-inset ring-emerald/50" : "bg-surface text-text-secondary hover:text-text-primary"}`}
      >
        Baseline
      </button>
    </div>
  );
}
