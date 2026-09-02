import { Recycle } from "lucide-react";

interface BrandMarkProps {
  compact?: boolean;
  inverse?: boolean;
}

export function BrandMark({ compact = false, inverse = false }: BrandMarkProps) {
  return (
    <div className={`brand-mark ${inverse ? "brand-mark--inverse" : ""}`}>
      <span className="brand-mark__symbol" aria-hidden="true">
        <Recycle size={compact ? 18 : 21} strokeWidth={2.4} />
      </span>
      {!compact && (
        <span className="brand-mark__wordmark">
          Waste<span>Wise</span>
        </span>
      )}
    </div>
  );
}
