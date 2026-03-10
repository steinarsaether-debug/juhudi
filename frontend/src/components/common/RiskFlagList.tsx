import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, AlertCircle, ChevronDown, ChevronUp,
  CheckCircle, MessageSquare, Lightbulb,
} from 'lucide-react';
import { CustomerRiskFlag, RiskFlagCategory, RiskFlagSeverity } from '../../types';
import { kpiApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

// ── Display config ─────────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<RiskFlagCategory, string> = {
  FINANCIAL_CAPACITY:  'Financial Capacity',
  BUSINESS_PERFORMANCE: 'Business Performance',
  REPAYMENT_BEHAVIOR:  'Repayment Behaviour',
  OPERATIONAL_RISK:    'Operational Risk',
  COLLATERAL_RISK:     'Collateral Risk',
};

const SEVERITY_CONFIG: Record<RiskFlagSeverity, {
  icon:        React.ElementType;
  iconClass:   string;
  bg:          string;
  border:      string;
  badge:       string;
  badgeText:   string;
  label:       string;
}> = {
  RED: {
    icon:      AlertCircle,
    iconClass: 'text-red-600',
    bg:        'bg-red-50',
    border:    'border-red-200',
    badge:     'bg-red-100',
    badgeText: 'text-red-700',
    label:     'Critical',
  },
  YELLOW: {
    icon:      AlertTriangle,
    iconClass: 'text-amber-500',
    bg:        'bg-amber-50',
    border:    'border-amber-200',
    badge:     'bg-amber-100',
    badgeText: 'text-amber-700',
    label:     'Warning',
  },
};

// ── Single flag row ────────────────────────────────────────────────────────────

function RiskFlagRow({
  flag, onResolved,
}: { flag: CustomerRiskFlag; loanId?: string; onResolved: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote]         = useState('');
  const { user } = useAuthStore();
  const cfg = SEVERITY_CONFIG[flag.severity];
  const SevIcon = cfg.icon;

  const canResolve = ['BRANCH_MANAGER', 'SUPERVISOR', 'ADMIN'].includes(user?.role ?? '');

  const resolveMutation = useMutation({
    mutationFn: () => kpiApi.resolveFlag(flag.id, note || 'Resolved by manager'),
    onSuccess: onResolved,
  });

  if (!flag.isActive) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-gray-400 text-xs border-b border-gray-50 last:border-0 bg-gray-50/60">
        <CheckCircle className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
        <span className="line-through">{flag.title}</span>
        {flag.resolvedBy && (
          <span className="ml-1">— resolved by {flag.resolvedBy.firstName} {flag.resolvedBy.lastName}</span>
        )}
        {flag.resolvedNote && (
          <span className="ml-1 italic">"{flag.resolvedNote}"</span>
        )}
      </div>
    );
  }

  return (
    <div className={`border-b last:border-0 ${cfg.border}`}>
      <button
        type="button"
        className={`w-full flex items-start gap-3 px-3 py-3 text-left hover:bg-black/[0.02] transition-colors ${cfg.bg}`}
        onClick={() => setExpanded(e => !e)}
      >
        <SevIcon className={`h-4 w-4 flex-shrink-0 mt-0.5 ${cfg.iconClass}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">{flag.title}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${cfg.badge} ${cfg.badgeText}`}>
              {cfg.label}
            </span>
            <span className="text-xs text-gray-400">{CATEGORY_LABEL[flag.category]}</span>
          </div>
          <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{flag.description}</p>
          {flag.value !== undefined && flag.threshold !== undefined && (
            <p className="text-xs text-gray-400 mt-0.5">
              Value: {flag.value} · Threshold: {flag.threshold}
            </p>
          )}
        </div>
        {expanded
          ? <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
          : <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />}
      </button>

      {expanded && flag.guidance && (
        <div className={`px-4 pb-3 pt-1 space-y-3 ${cfg.bg}`}>
          {/* Questions */}
          {flag.guidance.questions.length > 0 && (
            <div>
              <div className="flex items-center gap-1 text-xs font-semibold text-gray-700 mb-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                Suggested questions
              </div>
              <ol className="space-y-1">
                {flag.guidance.questions.map((q, i) => (
                  <li key={i} className="text-xs text-gray-600 flex gap-2">
                    <span className="font-medium text-gray-400 flex-shrink-0">{i + 1}.</span>
                    <span>{q}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Recommended actions */}
          {flag.guidance.actions.length > 0 && (
            <div>
              <div className="flex items-center gap-1 text-xs font-semibold text-gray-700 mb-1.5">
                <Lightbulb className="h-3.5 w-3.5" />
                Recommended actions
              </div>
              <ul className="space-y-1">
                {flag.guidance.actions.map((a, i) => (
                  <li key={i} className="text-xs text-gray-600 flex gap-2">
                    <span className="text-gray-400 flex-shrink-0">→</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Manager resolve */}
          {canResolve && (
            <div className="flex gap-2 mt-2 pt-2 border-t border-current/10">
              <input
                type="text"
                placeholder="Resolution note (required)"
                value={note}
                onChange={e => setNote(e.target.value)}
                className="input flex-1 text-xs py-1"
                maxLength={500}
              />
              <button
                type="button"
                disabled={resolveMutation.isPending || note.trim().length < 10}
                onClick={() => resolveMutation.mutate()}
                className="btn-secondary text-xs py-1 px-2 whitespace-nowrap disabled:opacity-40"
              >
                {resolveMutation.isPending ? '…' : 'Resolve'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main list ─────────────────────────────────────────────────────────────────

interface RiskFlagListProps {
  flags:        CustomerRiskFlag[];
  loanId:       string;
  onFlagChange?: () => void;
  showResolved?: boolean;
  compact?:     boolean;
}

export default function RiskFlagList({
  flags, loanId, onFlagChange, showResolved = false, compact = false,
}: RiskFlagListProps) {
  const [showAll, setShowAll] = useState(false);
  const qc = useQueryClient();

  const active   = flags.filter(f => f.isActive);
  const resolved = flags.filter(f => !f.isActive);

  const redCount    = active.filter(f => f.severity === 'RED').length;
  const yellowCount = active.filter(f => f.severity === 'YELLOW').length;

  const handleChange = () => {
    qc.invalidateQueries({ queryKey: ['riskFlags', loanId] });
    onFlagChange?.();
  };

  if (!active.length && !showResolved) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 py-2">
        <CheckCircle className="h-4 w-4" />
        No active KPI risk flags
      </div>
    );
  }

  // Sort: RED first, then YELLOW
  const sorted = [...active].sort((a, b) =>
    a.severity === 'RED' && b.severity !== 'RED' ? -1
    : b.severity === 'RED' && a.severity !== 'RED' ? 1
    : 0,
  );
  const shown  = compact && !showAll ? sorted.slice(0, 3) : sorted;
  const hidden = sorted.length - shown.length;

  return (
    <div>
      {/* Summary pill row */}
      {active.length > 0 && (
        <div className="flex items-center gap-2 mb-2">
          {redCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
              <AlertCircle className="h-3 w-3" /> {redCount} critical
            </span>
          )}
          {yellowCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
              <AlertTriangle className="h-3 w-3" /> {yellowCount} warning
            </span>
          )}
        </div>
      )}

      <div className="rounded-lg border overflow-hidden">
        {shown.map(f => (
          <RiskFlagRow key={f.id} flag={f} loanId={loanId} onResolved={handleChange} />
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
          <p className="px-3 py-1.5 text-xs font-medium text-gray-400 bg-gray-50 border-b border-gray-100">
            Resolved flags
          </p>
          {resolved.map(f => (
            <RiskFlagRow key={f.id} flag={f} loanId={loanId} onResolved={handleChange} />
          ))}
        </div>
      )}
    </div>
  );
}
