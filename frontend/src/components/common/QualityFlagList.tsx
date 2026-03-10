import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldX, ShieldAlert, Info, ChevronDown, ChevronUp,
  CheckCircle, User, MapPin, Copy, TrendingDown, Zap, FileText, DollarSign,
} from 'lucide-react';
import { DataQualityFlag, FlagSeverity, QualityFlagType } from '../../types';
import { qualityApi } from '../../services/api';

// ── Flag display config ────────────────────────────────────────────────────────

const FLAG_CONFIG: Record<QualityFlagType, { label: string; icon: React.ElementType; tip: string }> = {
  SIMILAR_NAME_SAME_BRANCH:    { label: 'Similar name (same branch)',    icon: User,        tip: 'Another customer in this branch has a very similar name.' },
  SIMILAR_NAME_CROSS_BRANCH:   { label: 'Similar name (another branch)', icon: User,        tip: 'A customer in another branch has a similar name.' },
  NAME_DOB_MATCH:              { label: 'Name + DOB match',              icon: User,        tip: 'Name and date of birth closely match an existing customer — likely duplicate.' },
  GPS_PROXIMITY:               { label: 'GPS overlap',                   icon: MapPin,      tip: 'GPS coordinates are within 15 m of another registered customer.' },
  FINANCIAL_PROFILE_COPY:      { label: 'Identical financial profile',   icon: Copy,        tip: 'Income and expense figures are identical to another of this LO\'s customers.' },
  LOAN_PURPOSE_COPY_PASTE:     { label: 'Copy-pasted loan purpose',      icon: Copy,        tip: 'Loan purpose text is very similar to a recent application by the same LO.' },
  ROUND_NUMBER_INCOME:         { label: 'Round-number income',           icon: DollarSign,  tip: 'Most income/expense fields are exact multiples of 1,000 — verify with customer.' },
  NEGATIVE_DISPOSABLE_INCOME:  { label: 'Expenses exceed income',        icon: TrendingDown,tip: 'Stated expenses are higher than stated income.' },
  HIGH_DEBT_BURDEN:            { label: 'High debt burden',              icon: TrendingDown,tip: 'Existing debt service exceeds 50% of disposable income.' },
  RAPID_SUCCESSION:            { label: 'Rapid succession',              icon: Zap,         tip: 'Multiple applications submitted by this LO in a very short window.' },
  GENERIC_LOAN_PURPOSE:        { label: 'Generic loan purpose',          icon: FileText,    tip: 'Loan purpose is too short or uses template language.' },
};

const SEVERITY_STYLE: Record<FlagSeverity, { border: string; bg: string; icon: React.ElementType; iconClass: string; label: string }> = {
  CRITICAL: { border: 'border-red-200',    bg: 'bg-red-50',    icon: ShieldX,    iconClass: 'text-red-600',    label: 'Critical' },
  WARNING:  { border: 'border-yellow-200', bg: 'bg-yellow-50', icon: ShieldAlert, iconClass: 'text-yellow-600', label: 'Warning' },
  INFO:     { border: 'border-blue-200',   bg: 'bg-blue-50',   icon: Info,        iconClass: 'text-blue-500',   label: 'Info' },
};

// ── Single flag row ────────────────────────────────────────────────────────────

interface FlagRowProps {
  flag: DataQualityFlag;
  onResolved: () => void;
}

function FlagRow({ flag, onResolved }: FlagRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote]         = useState('');
  const cfg     = FLAG_CONFIG[flag.flagType] ?? { label: flag.flagType, icon: Info, tip: '' };
  const sevCfg  = SEVERITY_STYLE[flag.severity];
  const SevIcon = sevCfg.icon;
  const FlagIcon = cfg.icon;

  const mutation = useMutation({
    mutationFn: () => qualityApi.resolveFlag(flag.id, note || undefined),
    onSuccess: onResolved,
  });

  if (flag.isResolved) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-gray-400 text-xs border-b border-gray-50 last:border-0 bg-gray-50/60">
        <CheckCircle className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
        <span className="line-through">{cfg.label}</span>
        {flag.resolvedBy && (
          <span className="ml-1">— dismissed by {flag.resolvedBy.firstName} {flag.resolvedBy.lastName}</span>
        )}
        {flag.resolvedNote && flag.resolvedNote !== 'auto-cleared' && (
          <span className="ml-1 italic">"{flag.resolvedNote}"</span>
        )}
      </div>
    );
  }

  return (
    <div className={`border-b last:border-0 ${sevCfg.border}`}>
      <button
        type="button"
        className={`w-full flex items-start gap-3 px-3 py-3 text-left hover:bg-black/[0.02] transition-colors ${sevCfg.bg}`}
        onClick={() => setExpanded(e => !e)}
      >
        <SevIcon className={`h-4 w-4 flex-shrink-0 mt-0.5 ${sevCfg.iconClass}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <FlagIcon className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
            <span className="text-sm font-medium text-gray-900">{cfg.label}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
              flag.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' :
              flag.severity === 'WARNING'  ? 'bg-yellow-100 text-yellow-700' :
              'bg-blue-100 text-blue-600'
            }`}>{sevCfg.label}</span>
          </div>
          <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{flag.message}</p>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />}
      </button>

      {expanded && (
        <div className={`px-4 pb-3 pt-1 ${sevCfg.bg}`}>
          <p className="text-xs text-gray-500 mb-3">{cfg.tip}</p>
          <p className="text-xs text-gray-700 mb-3 leading-relaxed">{flag.message}</p>

          {/* Matched entity link */}
          {!!flag.details?.matchedId && (
            <a
              href={`/customers/${flag.details.matchedId as string}`}
              className="text-xs text-primary-600 hover:underline block mb-2"
            >
              → View matched customer
            </a>
          )}
          {!!flag.details?.matchedApplicationId && (
            <a
              href={`/loans/${flag.details.matchedApplicationId as string}`}
              className="text-xs text-primary-600 hover:underline block mb-2"
            >
              → View matched application
            </a>
          )}

          {/* Dismiss / resolve */}
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              placeholder="Dismiss note (optional)"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="input flex-1 text-xs py-1"
              maxLength={500}
            />
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
              className="btn-secondary text-xs py-1 px-2 whitespace-nowrap"
            >
              {mutation.isPending ? '…' : 'Dismiss'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main list ─────────────────────────────────────────────────────────────────

interface QualityFlagListProps {
  flags: DataQualityFlag[];
  onFlagResolved?: () => void;
  showResolved?: boolean;
  compact?: boolean;
}

export default function QualityFlagList({ flags, onFlagResolved, showResolved = false, compact = false }: QualityFlagListProps) {
  const [showAll, setShowAll] = useState(false);
  const qc = useQueryClient();

  const active   = flags.filter(f => !f.isResolved);
  const resolved = flags.filter(f => f.isResolved);

  const handleResolved = () => {
    qc.invalidateQueries({ queryKey: ['quality'] });
    onFlagResolved?.();
  };

  if (!active.length && !showResolved) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 py-2">
        <CheckCircle className="h-4 w-4" />
        No active quality flags
      </div>
    );
  }

  const sorted = [...active].sort((a, b) => {
    const order = ['CRITICAL', 'WARNING', 'INFO'];
    return order.indexOf(a.severity) - order.indexOf(b.severity);
  });

  const shown  = compact && !showAll ? sorted.slice(0, 2) : sorted;
  const hidden = sorted.length - shown.length;

  return (
    <div>
      <div className={`rounded-lg border overflow-hidden ${compact ? '' : 'shadow-sm'}`}>
        {shown.map(f => (
          <FlagRow key={f.id} flag={f} onResolved={handleResolved} />
        ))}
        {hidden > 0 && (
          <button
            type="button"
            className="w-full text-xs text-center text-gray-500 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
            onClick={() => setShowAll(true)}
          >
            + {hidden} more flag{hidden > 1 ? 's' : ''}
          </button>
        )}
      </div>

      {showResolved && resolved.length > 0 && (
        <div className="mt-2 rounded-lg border border-gray-100 overflow-hidden">
          {resolved.map(f => (
            <FlagRow key={f.id} flag={f} onResolved={handleResolved} />
          ))}
        </div>
      )}
    </div>
  );
}
