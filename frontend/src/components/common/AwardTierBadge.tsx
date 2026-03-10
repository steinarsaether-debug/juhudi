import { CustomerTier } from '../../types';

interface TierConfig {
  label:    string;
  bg:       string;
  text:     string;
  border:   string;
  emoji:    string;
  gradient: string;
}

const TIER_CONFIG: Record<CustomerTier, TierConfig> = {
  STANDARD: {
    label:    'Standard',
    bg:       'bg-gray-100',
    text:     'text-gray-600',
    border:   'border-gray-200',
    emoji:    '○',
    gradient: '',
  },
  BRONZE: {
    label:    'Bronze',
    bg:       'bg-amber-50',
    text:     'text-amber-800',
    border:   'border-amber-200',
    emoji:    '🥉',
    gradient: 'from-amber-600 to-amber-800',
  },
  SILVER: {
    label:    'Silver',
    bg:       'bg-slate-100',
    text:     'text-slate-700',
    border:   'border-slate-300',
    emoji:    '🥈',
    gradient: 'from-slate-400 to-slate-600',
  },
  GOLD: {
    label:    'Gold',
    bg:       'bg-yellow-50',
    text:     'text-yellow-800',
    border:   'border-yellow-300',
    emoji:    '🥇',
    gradient: 'from-yellow-500 to-yellow-700',
  },
  PLATINUM: {
    label:    'Platinum',
    bg:       'bg-violet-50',
    text:     'text-violet-800',
    border:   'border-violet-300',
    emoji:    '💎',
    gradient: 'from-violet-500 to-violet-700',
  },
};

interface AwardTierBadgeProps {
  tier:      CustomerTier;
  size?:     'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export default function AwardTierBadge({
  tier,
  size      = 'md',
  showLabel = true,
}: AwardTierBadgeProps) {
  const cfg = TIER_CONFIG[tier] ?? TIER_CONFIG.STANDARD;

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5 gap-1',
    md: 'text-sm px-2.5 py-1 gap-1.5',
    lg: 'text-base px-3 py-1.5 gap-2',
  }[size];

  return (
    <span className={`
      inline-flex items-center rounded-full border font-semibold
      ${sizeClasses} ${cfg.bg} ${cfg.text} ${cfg.border}
    `}>
      <span className={size === 'sm' ? 'text-xs' : 'text-sm'}>{cfg.emoji}</span>
      {showLabel && <span>{cfg.label}</span>}
    </span>
  );
}

// ── Loyalty card widget ────────────────────────────────────────────────────────

interface LoyaltyCardProps {
  tier:            CustomerTier;
  completedCycles: number;
  maxArrearsDays:  number;
  hasWriteOff:     boolean;
  discounts:       { rateDiscount: number; feeDiscount: number };
  updatedAt?:      string | null;
}

const NEXT_TIER_REQS: Partial<Record<CustomerTier, { minCycles: number; maxArrears: number; nextTier: CustomerTier }>> = {
  STANDARD: { minCycles: 2, maxArrears: 30,  nextTier: 'BRONZE'   },
  BRONZE:   { minCycles: 3, maxArrears: 14,  nextTier: 'SILVER'   },
  SILVER:   { minCycles: 5, maxArrears: 7,   nextTier: 'GOLD'     },
  GOLD:     { minCycles: 7, maxArrears: 0,   nextTier: 'PLATINUM' },
};

export function LoyaltyCard({
  tier, completedCycles, maxArrearsDays, hasWriteOff, discounts, updatedAt,
}: LoyaltyCardProps) {
  const cfg    = TIER_CONFIG[tier] ?? TIER_CONFIG.STANDARD;
  const req    = NEXT_TIER_REQS[tier];
  const nextCfg = req ? TIER_CONFIG[req.nextTier] : null;

  return (
    <div className={`rounded-xl border p-4 ${cfg.bg} ${cfg.border}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{cfg.emoji}</span>
          <div>
            <p className={`text-base font-bold ${cfg.text}`}>{cfg.label} Member</p>
            {updatedAt && (
              <p className="text-xs text-gray-500">
                Since {new Date(updatedAt).toLocaleDateString('en-KE', { month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Completed cycles</p>
          <p className={`text-2xl font-bold ${cfg.text}`}>{completedCycles}</p>
        </div>
      </div>

      {/* Discounts */}
      {(discounts.rateDiscount > 0 || discounts.feeDiscount > 0) && (
        <div className="flex gap-3 mb-3">
          {discounts.rateDiscount > 0 && (
            <div className="flex-1 bg-white/70 rounded-lg p-2 text-center">
              <p className={`text-lg font-bold ${cfg.text}`}>−{discounts.rateDiscount}%</p>
              <p className="text-xs text-gray-500">Interest rate</p>
            </div>
          )}
          {discounts.feeDiscount > 0 && (
            <div className="flex-1 bg-white/70 rounded-lg p-2 text-center">
              <p className={`text-lg font-bold ${cfg.text}`}>−{discounts.feeDiscount}%</p>
              <p className="text-xs text-gray-500">Processing fee</p>
            </div>
          )}
        </div>
      )}

      {/* Write-off warning */}
      {hasWriteOff && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1 mb-3">
          Write-off on record — tier locked at Standard until cleared
        </p>
      )}

      {/* Next tier progress */}
      {req && nextCfg && !hasWriteOff && (
        <div className="mt-2 pt-2 border-t border-current/10">
          <p className="text-xs text-gray-500 mb-1">
            Path to {nextCfg.emoji} {nextCfg.label}: ≥{req.minCycles} cycles
            {req.maxArrears > 0 ? `, max ${req.maxArrears}d arrears` : ', zero arrears'}
          </p>
          <div className="h-1.5 bg-white/50 rounded-full overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${nextCfg.gradient} rounded-full`}
              style={{ width: `${Math.min(100, (completedCycles / req.minCycles) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {completedCycles}/{req.minCycles} cycles
            {maxArrearsDays > 0 && ` · current max arrears: ${maxArrearsDays}d`}
          </p>
        </div>
      )}

      {tier === 'PLATINUM' && (
        <p className={`text-xs font-medium ${cfg.text} mt-1`}>
          💎 Highest loyalty tier — maximum discounts applied
        </p>
      )}
    </div>
  );
}
