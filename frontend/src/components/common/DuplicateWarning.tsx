import { AlertTriangle, ExternalLink } from 'lucide-react';
import { NameDuplicateMatch } from '../../types';

interface DuplicateWarningProps {
  matches: NameDuplicateMatch[];
  branchId?: string;
}

export default function DuplicateWarning({ matches, branchId }: DuplicateWarningProps) {
  if (!matches.length) return null;

  const critical = matches.filter(m => m.similarity >= 0.92);

  return (
    <div className={`rounded-lg border p-3 mb-4 ${
      critical.length ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className={`h-4 w-4 flex-shrink-0 ${critical.length ? 'text-red-600' : 'text-yellow-600'}`} />
        <span className={`text-sm font-semibold ${critical.length ? 'text-red-700' : 'text-yellow-700'}`}>
          {critical.length
            ? `${critical.length} highly similar customer${critical.length > 1 ? 's' : ''} already exist`
            : `${matches.length} customer${matches.length > 1 ? 's' : ''} with similar name found`}
        </span>
      </div>
      <p className="text-xs text-gray-600 mb-2">
        Verify this is not a duplicate before proceeding. Check the existing customer record(s) below.
      </p>
      <div className="space-y-1.5">
        {matches.map(m => {
          const sameBranch = m.branchId === branchId;
          const pct = Math.round(m.similarity * 100);
          return (
            <a
              key={m.id}
              href={`/customers/${m.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center justify-between px-3 py-2 rounded border text-sm hover:shadow-sm transition-shadow ${
                m.similarity >= 0.92
                  ? 'bg-red-100 border-red-200 text-red-800'
                  : 'bg-yellow-100 border-yellow-200 text-yellow-800'
              }`}
            >
              <span className="font-medium">
                {m.firstName} {m.lastName}
                <span className="font-normal text-xs ml-2 opacity-70">
                  {m.village}, {m.county}{sameBranch ? ' (same branch)' : ''}
                </span>
              </span>
              <span className="flex items-center gap-1 text-xs font-bold">
                {pct}% match <ExternalLink className="h-3 w-3" />
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
