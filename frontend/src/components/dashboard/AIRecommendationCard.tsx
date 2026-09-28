import { Lightbulb, TrendingUp, ShieldAlert } from "lucide-react";
import { Card } from "../ui/Primitives";
import type { RecommendationCard } from "../../api/client";

/** Visually distinct AI recommendation panel, grounded entirely in the
 * solver's actual output (no independent claims beyond that evidence). */
export default function AIRecommendationCard({ recommendation }: { recommendation: RecommendationCard | null }) {
  return (
    <Card className="bg-gradient-to-br from-emerald/10 to-surface border-emerald/25 flex flex-col gap-2 h-full">
      <div className="flex items-center gap-2">
        <div className="bg-emerald/15 rounded-lg p-1.5"><Lightbulb size={14} className="text-emerald" /></div>
        <span className="text-[10px] uppercase tracking-wider text-emerald font-semibold">AI Recommendation</span>
      </div>
      {recommendation ? (
        <>
          <div className="text-sm font-semibold text-text-primary leading-snug">{recommendation.title}</div>
          <p className="text-xs text-text-secondary leading-snug">{recommendation.recommendation}</p>
          <div className="text-[11px] text-text-secondary flex items-start gap-1.5 mt-auto pt-1 border-t border-sage/50">
            <TrendingUp size={12} className="mt-0.5 shrink-0 text-emerald" />
            <span>{recommendation.expected_effect}</span>
          </div>
          {recommendation.uncertainty && (
            <div className="text-[11px] text-text-secondary flex items-start gap-1.5">
              <ShieldAlert size={12} className="mt-0.5 shrink-0 text-warning" />
              <span>{recommendation.uncertainty}</span>
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-text-secondary">Run an optimization to generate a grounded recommendation.</p>
      )}
    </Card>
  );
}
