import { ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';
import { DataQualityFlag, FlagSeverity } from '../../types';

const SEVERITY_ORDER: FlagSeverity[] = ['CRITICAL', 'WARNING', 'INFO'];

function worstSeverity(flags: DataQualityFlag[]): FlagSeverity | null {
  const active = flags.filter(f => !f.isResolved);
  if (!active.length) return null;
  for (const s of SEVERITY_ORDER) {
    if (active.some(f => f.severity === s)) return s;
  }
  return null;
}

const BADGE_STYLES: Record<FlagSeverity, string> = {
  CRITICAL: 'bg-red-100 text-red-700 border-red-200',
  WARNING:  'bg-yellow-100 text-yellow-700 border-yellow-200',
  INFO:     'bg-blue-50 text-blue-600 border-blue-200',
};

const BADGE_ICON: Record<FlagSeverity, typeof ShieldAlert> = {
  CRITICAL: ShieldX,
  WARNING:  ShieldAlert,
  INFO:     ShieldAlert,
};

interface QualityBadgeProps {
  flags: DataQualityFlag[];
  onClick?: () => void;
  size?: 'sm' | 'md';
}

export default function QualityBadge({ flags, onClick, size = 'sm' }: QualityBadgeProps) {
  const active = flags.filter(f => !f.isResolved);
  if (active.length === 0) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs bg-green-50 text-green-700 border-green-200 ${onClick ? 'cursor-pointer' : ''}`}
        onClick={onClick}>
        <ShieldCheck className="h-3 w-3" />
        {size === 'md' && 'Clean'}
      </span>
    );
  }

  const severity = worstSeverity(active)!;
  const Icon = BADGE_ICON[severity];
  const criticalCount = active.filter(f => f.severity === 'CRITICAL').length;
  const warnCount     = active.filter(f => f.severity === 'WARNING').length;

  const label = criticalCount > 0
    ? `${criticalCount} critical`
    : `${warnCount} warning${warnCount > 1 ? 's' : ''}`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium transition-opacity hover:opacity-80 ${BADGE_STYLES[severity]}`}
      title={`${active.length} quality flag(s) — click to review`}
    >
      <Icon className="h-3 w-3" />
      {label}
      {active.length > (criticalCount + warnCount) && (
        <span className="text-xs opacity-60">+{active.length - criticalCount - warnCount}</span>
      )}
    </button>
  );
}
