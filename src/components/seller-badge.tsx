import { ShieldCheck, ShieldAlert, Sparkles, User, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SellerInfo } from "@/lib/marketplaces/types";
import { cn } from "@/lib/utils";

type SellerBadgeProps = {
  seller: SellerInfo;
  className?: string;
  showStandard?: boolean;
};

export function SellerBadge({ seller, className, showStandard = false }: SellerBadgeProps) {
  const { reputation, label, detail, username } = seller;

  if (reputation === "unknown" || !label) {
    return null;
  }

  if (reputation === "top_rated") {
    return (
      <Badge
        variant="good"
        title={detail ?? "Top rated seller with high sales volume and positive ratings."}
        className={cn("inline-flex items-center gap-1 font-semibold", className)}
      >
        <Sparkles className="size-3 shrink-0" />
        <span>{label}</span>
      </Badge>
    );
  }

  if (reputation === "trusted") {
    return (
      <Badge
        variant="good"
        title={detail ?? "Established seller with consistent positive feedback."}
        className={cn("inline-flex items-center gap-1 font-medium", className)}
      >
        <ShieldCheck className="size-3 shrink-0" />
        <span>{label}</span>
      </Badge>
    );
  }

  if (reputation === "new") {
    return (
      <Badge
        variant="fair"
        title={detail ?? "Brand new seller with few or no recorded transactions. Exercise extra caution."}
        className={cn(
          "inline-flex items-center gap-1 font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20",
          className,
        )}
      >
        <AlertTriangle className="size-3 shrink-0 text-amber-600 dark:text-amber-400" />
        <span>{label}</span>
      </Badge>
    );
  }

  if (reputation === "low_rated") {
    return (
      <Badge
        variant="bad"
        title={detail ?? "Seller has below-average feedback rating. High risk."}
        className={cn("inline-flex items-center gap-1 font-semibold", className)}
      >
        <ShieldAlert className="size-3 shrink-0" />
        <span>{label}</span>
      </Badge>
    );
  }

  // Standard seller
  if (showStandard) {
    return (
      <Badge
        variant="default"
        title={detail ?? (username ? `Seller: ${username}` : undefined)}
        className={cn("inline-flex items-center gap-1 text-muted font-normal", className)}
      >
        <User className="size-3 shrink-0 opacity-70" />
        <span>{username ? `${username} (${label})` : label}</span>
      </Badge>
    );
  }

  // For standard sellers when showStandard is false, we can still show a subtle text tag if username exists
  if (username) {
    return (
      <span
        title={detail ?? `Seller: ${username}`}
        className={cn("inline-flex items-center gap-1 text-xs text-subtle truncate max-w-[160px]", className)}
      >
        <User className="size-3 shrink-0 opacity-60" />
        <span className="truncate">{username}</span>
      </span>
    );
  }

  return null;
}
