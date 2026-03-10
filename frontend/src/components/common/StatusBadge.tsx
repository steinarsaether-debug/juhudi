import clsx from 'clsx';
import { KYCStatus, AMLStatus, ApplicationStatus, LoanStatus, LoanRecommendation } from '../../types';

type Status = KYCStatus | AMLStatus | ApplicationStatus | LoanStatus | LoanRecommendation | string;

const statusMap: Record<string, string> = {
  // KYC
  PENDING: 'badge-gray',
  SUBMITTED: 'badge-blue',
  VERIFIED: 'badge-green',
  REJECTED: 'badge-red',
  REQUIRES_UPDATE: 'badge-yellow',
  // AML
  CLEAR: 'badge-green',
  FLAGGED: 'badge-yellow',
  BLOCKED: 'badge-red',
  // Application
  DRAFT: 'badge-gray',
  UNDER_REVIEW: 'badge-blue',
  APPROVED: 'badge-green',
  CONDITIONALLY_APPROVED: 'badge-yellow',
  WITHDRAWN: 'badge-gray',
  // Loan
  PENDING_DISBURSEMENT: 'badge-yellow',
  ACTIVE: 'badge-green',
  COMPLETED: 'badge-blue',
  DEFAULTED: 'badge-red',
  WRITTEN_OFF: 'badge-red',
  // Score
  APPROVE: 'badge-green',
  CONDITIONAL: 'badge-yellow',
  DECLINE: 'badge-red',
  STRONG_DECLINE: 'badge-red',
};

const labelMap: Record<string, string> = {
  REQUIRES_UPDATE: 'Requires Update',
  PENDING_DISBURSEMENT: 'Pending Disbursement',
  CONDITIONALLY_APPROVED: 'Conditional Approval',
  WRITTEN_OFF: 'Written Off',
  STRONG_DECLINE: 'Strong Decline',
};

export default function StatusBadge({ status }: { status: Status }) {
  const className = statusMap[status] ?? 'badge-gray';
  const label = labelMap[status] ?? status?.replace(/_/g, ' ');
  return <span className={clsx(className)}>{label}</span>;
}
