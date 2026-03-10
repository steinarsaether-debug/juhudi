// JourneyGate — renders a full-page blocking message when a prerequisite step
// has not been completed. Shows the CustomerJourneyBar so users understand
// where they are in the lifecycle and what needs to be done first.

import { Lock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import CustomerJourneyBar, { JourneyStep } from './CustomerJourneyBar';

export interface GateRequirement {
  label:       string;         // e.g. "Complete KYC verification"
  description: string;         // e.g. "The customer's identity must be verified before..."
  actionLabel: string;         // e.g. "Go to KYC"
  actionTo:    string;         // route path e.g. `/customers/${id}?tab=kyc`
  completed:   boolean;
}

interface JourneyGateProps {
  title:        string;         // e.g. "Loan Application"
  requirements: GateRequirement[];
  journeySteps: JourneyStep[];
  children:     React.ReactNode;
}

export default function JourneyGate({
  title, requirements, journeySteps, children,
}: JourneyGateProps) {
  const unmet = requirements.filter(r => !r.completed);

  // All requirements met — render children normally
  if (unmet.length === 0) return <>{children}</>;

  // Gate blocked — show the journey overview + what's missing
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Journey bar — shows where the user is */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Customer Lending Journey
        </p>
        <CustomerJourneyBar steps={journeySteps} />
      </div>

      {/* Blocking panel */}
      <div className="bg-amber-50 border border-amber-300 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-amber-200 bg-amber-100">
          <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center flex-shrink-0">
            <Lock className="h-5 w-5 text-amber-700" />
          </div>
          <div>
            <h2 className="text-base font-bold text-amber-900">
              {title} is not available yet
            </h2>
            <p className="text-sm text-amber-700 mt-0.5">
              {unmet.length === 1
                ? 'The following step must be completed first:'
                : `${unmet.length} steps must be completed first:`}
            </p>
          </div>
        </div>

        {/* Requirements list */}
        <div className="px-6 py-5 space-y-4">
          {unmet.map((req, i) => (
            <div key={i} className="flex items-start justify-between gap-4 bg-white border border-amber-200 rounded-xl px-5 py-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-amber-200 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-amber-700">{i + 1}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{req.label}</p>
                </div>
                <p className="text-xs text-gray-500 mt-1.5 ml-7">{req.description}</p>
              </div>
              <Link
                to={req.actionTo}
                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-700 text-white text-sm font-medium hover:bg-primary-800 transition-colors whitespace-nowrap"
              >
                {req.actionLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>

        {/* Already completed steps (greyed out) */}
        {requirements.some(r => r.completed) && (
          <div className="px-6 pb-5">
            <p className="text-xs text-amber-600 font-medium mb-2">Already completed:</p>
            <div className="space-y-2">
              {requirements.filter(r => r.completed).map((req, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-green-700">
                  <span className="text-green-500">✓</span>
                  {req.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
