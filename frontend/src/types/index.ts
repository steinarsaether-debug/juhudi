export type UserRole = 'ADMIN' | 'BRANCH_MANAGER' | 'SUPERVISOR' | 'LOAN_OFFICER';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  branchId: string | null;
  mustChangePass: boolean;
}

export type KYCStatus = 'PENDING' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED' | 'REQUIRES_UPDATE';
export type AMLStatus = 'PENDING' | 'CLEAR' | 'FLAGGED' | 'BLOCKED';
export type LoanRecommendation = 'APPROVE' | 'CONDITIONAL' | 'DECLINE' | 'STRONG_DECLINE';
export type ApplicationStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'CONDITIONALLY_APPROVED' | 'REJECTED' | 'WITHDRAWN';
export type LoanStatus = 'PENDING_DISBURSEMENT' | 'ACTIVE' | 'COMPLETED' | 'DEFAULTED' | 'WRITTEN_OFF';

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  alternatePhone?: string;
  nationalId?: string;
  dateOfBirth?: string;
  county: string;
  subCounty: string;
  ward?: string;
  village: string;
  physicalAddress?: string;
  gender: string;
  maritalStatus: string;
  numberOfDependents: number;
  yaraCustomerId?: string;
  yaraRegion?: string;
  customerNumber?: string;
  branchId: string;
  nextOfKinName?: string;
  nextOfKinPhone?: string;
  nextOfKinRelation?: string;
  nextOfKinNationalId?: string;
  isPEP?: boolean;
  pepDetails?: string;
  kycStatus: KYCStatus;
  amlStatus: AMLStatus;
  riskRating: string;
  createdAt: string;
  branch?: { id: string; name: string };
  farmProfile?: FarmProfile;
  financialProfile?: FinancialProfile;
  kycDocuments?: KYCDocument[];
  creditScores?: CreditScore[];
  _count?: { loans: number; loanApplications: number };
  qualityFlagCount?: number;
  currentTier?:    CustomerTier;
  tierUpdatedAt?:  string;
}

export interface FarmProfile {
  id: string;
  farmSize: number;
  landOwnership: string;
  primaryCrop: string;
  secondaryCrops: string[];
  irrigationType: string;
  hasGreenhouse?: boolean;
  marketAccess: string;
  distanceToMarket?: number;
  hasStorageFacility?: boolean;
  hasElectricity?: boolean;
  hasPipedWater?: boolean;
  yaraMemberSince?: string;
  yaraProductsUsed: string[];
  annualInputCostKes?: number;
  livestockCount?: number;
}

export interface FinancialProfile {
  id: string;
  monthlyFarmIncome: number;
  monthlyOffFarmIncome: number;
  monthlyHouseholdExpenses: number;
  otherMonthlyDebt: number;
  hasMpesa: boolean;
  mpesaMonthlyAvgKes?: number;
  hasBankAccount: boolean;
  bankName?: string;
  hasGroupMembership: boolean;
  groupName?: string;
  groupType?: string;
  groupMonthlySavingsKes?: number;
  crbStatus: string;
  previousLoansCount: number;
  previousLoansRepaidOnTime?: boolean;
}

export interface KYCDocument {
  id: string;
  type: string;
  fileName: string;
  isVerified: boolean;
  uploadedAt: string;
}

export interface BenchmarkComparison {
  itemName: string;
  category: string;
  statedMonthlyKes: number;
  benchmarkLowKes: number;
  benchmarkMidKes: number;
  benchmarkHighKes: number;
  deviationPct: number;
  flagged: boolean;
  scope: string;
  sourceShortName: string;
  referenceYear: number;
}

export interface CreditScore {
  id: string;
  creditScoreId?: string;  // returned on fresh scoring run
  totalScore: number;
  cashflowScore: number;
  abilityScore: number;
  willingnessScore: number;
  recommendation: LoanRecommendation;
  maxLoanAmountKes: number;
  suggestedTermMonths: number;
  scoringNotes?: string;
  requiresSupervisorReview?: boolean;
  cashflowBreakdown?: ScoreBreakdown[];
  abilityBreakdown?: ScoreBreakdown[];
  willingnessBreakdown?: ScoreBreakdown[];
  benchmarkComparisons?: BenchmarkComparison[];
  benchmarkPenaltyApplied?: number;
  createdAt: string;
}

export interface ScoreBreakdown {
  component: string;
  score: number;
  maxScore: number;
  notes: string[];
}

// ─── Loan Groups ─────────────────────────────────────────────────────────────

export type LoanGroupStatus      = 'FORMING' | 'ACTIVE' | 'SUSPENDED' | 'DISSOLVED';
export type GroupMeetingFrequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
export type GroupMemberRole      = 'CHAIR' | 'SECRETARY' | 'TREASURER' | 'MEMBER';
export type CollateralType       =
  | 'TITLE_DEED' | 'MOTOR_VEHICLE' | 'CHATTEL' | 'LIVESTOCK' | 'CROP_LIEN'
  | 'SALARY_ASSIGNMENT' | 'GROUP_GUARANTEE' | 'PERSONAL_GUARANTEE'
  | 'SAVINGS_DEPOSIT' | 'OTHER';
export type LoanType             = 'INDIVIDUAL' | 'GROUP';
export type LoanProductCategory  = 'SHORT_TERM_INPUTS' | 'LONG_TERM_INVESTMENT';

export interface LoanGroupMember {
  id:         string;
  groupId:    string;
  customerId: string;
  customer?:  {
    id: string;
    firstName: string;
    lastName: string;
    kycStatus: KYCStatus;
    loanApplications?: Array<{ id: string; status: ApplicationStatus; requestedAmountKes: number }>;
  };
  role:       GroupMemberRole;
  joinedAt:   string;
  leftAt?:    string;
  isActive:   boolean;
}

export interface LoanGroup {
  id:                 string;
  name:               string;
  registrationNo?:    string;
  branchId:           string;
  branch?:            { id: string; name: string };
  loanOfficerId:      string;
  loanOfficer?:       { id: string; firstName: string; lastName: string };
  status:             LoanGroupStatus;
  meetingFrequency:   GroupMeetingFrequency;
  meetingDay?:        string;
  meetingLocation?:   string;
  formedAt:           string;
  registeredAt?:      string;
  notes?:             string;
  isActive:           boolean;
  createdAt:          string;
  updatedAt:          string;
  members?:           LoanGroupMember[];
  loanApplications?:  LoanApplication[];
  activeMembers?:     number;
  activeLoans?:       number;
  _count?: { members: number; loanApplications: number };
}

export interface LoanCollateral {
  id:                 string;
  loanApplicationId:  string;
  collateralType:     CollateralType;
  description:        string;
  estimatedValueKes:  number;
  documentFileName?:  string;
  isVerified:         boolean;
  createdAt:          string;
}

// ─── Loan Application ────────────────────────────────────────────────────────

export interface LoanApplication {
  id: string;
  applicationNumber: string;
  customerId: string;
  customer?: { id: string; firstName: string; lastName: string; county: string };
  officer?: { firstName: string; lastName: string };
  requestedAmountKes: number;
  approvedAmountKes?: number;
  purposeCategory?: string;
  purposeOfLoan: string;
  termMonths: number;
  repaymentMethod?: string;
  status: ApplicationStatus;
  creditScore?: { totalScore: number; recommendation: LoanRecommendation };
  loanProduct?: { name: string; category?: LoanProductCategory };
  loanType?: LoanType;
  loanGroupId?: string;
  loanGroup?: { id: string; name: string };
  groupLoanShareKes?: number;
  // Cash flow snapshot
  monthlyIncomeSnapshot?: number;
  monthlyExpensesSnapshot?: number;
  // Resilience
  hadShockPastYear?: boolean;
  shockType?: string;
  copingMechanism?: string;
  hasSavingsBuffer?: boolean;
  savingsBufferMonths?: number;
  hasAlternativeIncome?: boolean;
  // Collateral
  collateral?: LoanCollateral[];
  reviewNotes?: string;
  rejectionReason?: string;
  // ILP fields
  ilpSegment?: ILPSegment;
  ilpAssessment?: ILPAssessment;
  // Award / loyalty tier snapshot
  customerTierAtApplication?: CustomerTier;
  interestRateDiscountPct?:   number;
  processingFeeDiscountPct?:  number;
  // Review outcome
  interestRatePct?: number;
  reviewedAt?: string;
  reviewedByUserId?: string;
  // Related records (returned by getApplication)
  bccSession?: {
    id: string;
    status: string;
    outcome?: string;
    quorumRequired: number;
    outcomeNotes?: string;
  };
  loan?: {
    id: string;
    loanNumber: string;
    status: string;
    disbursedAt?: string;
  };
  createdAt: string;
}

export interface Loan {
  id: string;
  loanNumber: string;
  customerId: string;
  customer?: { id: string; firstName: string; lastName: string; county: string };
  principalKes: number;
  interestRatePct: number;
  termMonths: number;
  installmentKes: number;
  totalRepayableKes: number;
  outstandingBalKes?: number;
  disbursedAt?: string;
  maturityDate?: string;
  status: LoanStatus;
  daysInArrears: number;
  repayments?: Repayment[];
  // ILP fields
  ilpCycleNumber?: number;
  ilpFollowUps?: ILPFollowUp[];
  application?: {
    id: string;
    applicationNumber: string;
    status: string;
    purposeOfLoan: string;
    ilpSegment?: ILPSegment;
    ilpAssessment?: ILPAssessment;
    creditScore?: { totalScore: number; recommendation: string };
    customerTierAtApplication?: CustomerTier;
    interestRateDiscountPct?:   number;
    processingFeeDiscountPct?:  number;
  };
}

export interface Repayment {
  id: string;
  loanId: string;
  amountKes: number;
  paymentDate: string;
  method: string;
  reference?: string;
  notes?: string;
  loan?: {
    id: string;
    loanNumber: string;
    principalKes: number;
    outstandingBalKes?: number;
    status: LoanStatus;
    termMonths: number;
    interestRatePct: number;
  };
}

export interface DashboardStats {
  totalCustomers: number;
  pendingKyc: number;
  activeLoans: number;
  pendingApplications: number;
  overdueLoans: number;
  portfolioOutstandingKes: number;
  portfolioPrincipalKes: number;
}

// ── BCC ───────────────────────────────────────────────────────────────────────
export type BccStatus  = 'OPEN' | 'DECIDED' | 'OVERRIDDEN' | 'EXPIRED';
export type BccOutcome = 'APPROVED' | 'REFUSED' | 'REFERRED' | 'CONDITIONAL';
export type VoteType   = 'ENDORSE' | 'REFUSE' | 'ABSTAIN';

export interface BccVote {
  id: string;
  vote: VoteType;
  rationale?: string;
  votedAt: string;
  updatedAt?: string;
  user: { id: string; firstName: string; lastName: string; role: string };
}

export interface BccComment {
  id: string;
  body: string;
  createdAt: string;
  editedAt?: string;
  user: { id: string; firstName: string; lastName: string; role: string };
}

export interface BccSession {
  id: string;
  loanApplicationId: string;
  branchId: string;
  status: BccStatus;
  outcome?: BccOutcome;
  outcomeNotes?: string;
  quorumRequired: number;
  managerOverride: boolean;
  overrideReason?: string;
  openedAt: string;
  closedAt?: string;
  expiresAt: string;
  loanApplication?: LoanApplication & {
    creditScore?: { totalScore: number; recommendation: string };
    customer?: { id: string; firstName: string; lastName: string; county: string; subCounty?: string; village?: string; numberOfDependents?: number; farmProfile?: FarmProfile; financialProfile?: FinancialProfile };
    officer?: { id: string; firstName: string; lastName: string };
  };
  branch?: { id: string; name: string; code: string };
  votes?: BccVote[];
  comments?: BccComment[];
  _count?: { comments: number };
}

// ── Collections ───────────────────────────────────────────────────────────────
export type CollectionActionType =
  | 'AUTO_ALERT' | 'PHONE_CALL' | 'SMS_SENT' | 'FIELD_VISIT'
  | 'PROMISE_TO_PAY' | 'PARTIAL_PAYMENT' | 'DEMAND_LETTER'
  | 'LEGAL_NOTICE' | 'WRITE_OFF_RECOMMENDED' | 'RESTRUCTURED' | 'OTHER';

export interface CollectionAction {
  id: string;
  loanId: string;
  actionType: CollectionActionType;
  notes?: string;
  daysInArrears: number;
  outstandingKes: number;
  nextActionDate?: string;
  promisedAmount?: number;
  promisedDate?: string;
  performedAt: string;
  performedBy: { id: string; firstName: string; lastName: string; role: string };
}

// ── Portfolio stats ───────────────────────────────────────────────────────────
export interface LoBreakdown {
  officerId: string;
  officerName: string;
  customers: number;
  activeLoans: number;
  inArrears: number;
  portfolioKes: number;
  parRate: string;
}

export interface PortfolioStatsLo {
  view: 'LOAN_OFFICER';
  myCustomers: number;
  myActiveLoans: number;
  myPendingApps: number;
  myArrears: number;
  myPortfolioOutstandingKes: number;
  par30Kes: number;
  par30Rate: string;
  pendingBccVotes: number;
}

export interface PortfolioStatsBranch {
  view: 'BRANCH';
  totalCustomers: number;
  activeLoans: number;
  pendingApps: number;
  inArrears: number;
  openBccSessions: number;
  portfolioOutstandingKes: number;
  par30Kes: number;
  par30Rate: string;
  loBreakdown: LoBreakdown[];
}

// ── Data Quality ──────────────────────────────────────────────────────────────
export type QualityFlagType =
  | 'SIMILAR_NAME_SAME_BRANCH'
  | 'SIMILAR_NAME_CROSS_BRANCH'
  | 'NAME_DOB_MATCH'
  | 'GPS_PROXIMITY'
  | 'FINANCIAL_PROFILE_COPY'
  | 'LOAN_PURPOSE_COPY_PASTE'
  | 'ROUND_NUMBER_INCOME'
  | 'NEGATIVE_DISPOSABLE_INCOME'
  | 'HIGH_DEBT_BURDEN'
  | 'RAPID_SUCCESSION'
  | 'GENERIC_LOAN_PURPOSE';

export type FlagSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface DataQualityFlag {
  id: string;
  entityType: string;
  entityId: string;
  flagType: QualityFlagType;
  severity: FlagSeverity;
  message: string;
  details?: Record<string, unknown>;
  isResolved: boolean;
  resolvedById?: string;
  resolvedAt?: string;
  resolvedNote?: string;
  createdAt: string;
  resolvedBy?: { firstName: string; lastName: string };
}

export interface NameDuplicateMatch {
  id: string;
  firstName: string;
  lastName: string;
  county: string;
  village: string;
  branchId: string;
  similarity: number;
}

export interface QualityReport {
  totalFlags: number;
  bySeverity: { CRITICAL: number; WARNING: number; INFO: number };
  byType: Record<string, number>;
  byOfficer: Array<{ officerId: string; name: string; flags: number; critical: number }>;
  topFlaggedCustomers: Array<{ id: string; firstName: string; lastName: string; county: string; flagCount: number }>;
}

// ─── Customer Interview ───────────────────────────────────────────────────────

export type InterviewStatus         = 'DRAFT' | 'COMPLETED';
export type InterviewRecommendation = 'APPROVE' | 'APPROVE_WITH_CONDITIONS' | 'FURTHER_EVALUATION' | 'DECLINE';

export interface InterviewAnswer {
  score?: number;  // 1–5
  notes?: string;  // Free text / transcribed speech
}

export interface CustomerInterview {
  id:             string;
  customerId:     string;
  conductedById:  string;
  language:       string;
  status:         InterviewStatus;
  answers:        Record<string, InterviewAnswer>;
  totalScore?:    number;
  maxScore?:      number;
  scorePercent?:  number;
  recommendation?: InterviewRecommendation;
  loNotes?:       string;
  completedAt?:   string;
  createdAt:      string;
  updatedAt:      string;
  interviewType?: string; // STANDARD | ILP_FARMER | ILP_LANDLORD | ILP_SHOP_OWNER
  ilpSegment?:    ILPSegment;
  conductedBy?: { id: string; firstName: string; lastName: string; role: string };
  customer?:    { id: string; firstName: string; lastName: string; county: string; village: string };
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

// ─── Admin: Users ─────────────────────────────────────────────────────────────

export interface AdminUser {
  id:           string;
  email:        string;
  firstName:    string;
  lastName:     string;
  role:         UserRole;
  phone:        string;
  employeeId?:  string;
  branchId?:    string;
  branch?:      { id: string; name: string; code: string };
  isActive:     boolean;
  lastLogin?:   string;
  mustChangePass: boolean;
  createdAt:    string;
  _count?:      { loanApplications: number };
}

// ─── Admin: Branches ──────────────────────────────────────────────────────────

export interface AdminBranch {
  id:       string;
  name:     string;
  code:     string;
  county:   string;
  address:  string;
  isActive: boolean;
  _count?:  { users: number; customers: number };
}

// ─── Admin: Audit Log ─────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id:        string;
  userId:    string;
  user:      { id: string; firstName: string; lastName: string; role: string; branch?: { name: string } };
  action:    string;
  entity:    string;
  entityId:  string;
  changes?:  Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}

// ─── M-Pesa Statement Analysis ───────────────────────────────────────────────

export type MpesaAnalysisStatus = 'PENDING' | 'PROCESSING' | 'COMPLETE' | 'FAILED';

export interface MpesaDetectedLoan {
  lender:                 string;
  estimatedMonthlyPayment: number;
  occurrences:            number;
  lastDate:               string;
  concern:                string;
}

export interface MpesaSuspiciousPattern {
  type:             'SECOND_HOUSEHOLD' | 'GAMBLING' | 'ALCOHOL' | 'CASH_INTENSIVE' | 'INCOME_INSTABILITY' | 'OTHER';
  description:      string;
  severity:         'LOW' | 'MEDIUM' | 'HIGH';
  evidence:         string;
  estimatedMonthly?: number;
}

export interface MpesaGamblingTx {
  platform:    string;
  totalAmount: number;
  frequency:   string;
  months:      number;
}

export interface MpesaStatement {
  id:               string;
  customerId:       string;
  customer?:        { id: string; firstName: string; lastName: string; branch?: { id: string; name: string } };
  fileName:         string;
  mimeType:         string;
  sizeBytes:        number;
  periodStart?:     string;
  periodEnd?:       string;
  transactionCount: number;
  analysisStatus:   MpesaAnalysisStatus;
  analysisError?:   string;
  analysedAt?:      string;
  overallRiskLevel?:   'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  recommendedAction?:  'PROCEED' | 'ADDITIONAL_INFO' | 'CAUTION' | 'DECLINE';
  riskSummary?:        string;
  detectedLoans?:      MpesaDetectedLoan[];
  suspiciousPatterns?: MpesaSuspiciousPattern[];
  gamblingTransactions?: MpesaGamblingTx[];
  positiveIndicators?: string[];
  avgMonthlyInflow?:   number;
  avgMonthlyOutflow?:  number;
  avgMonthlyNet?:      number;
  fulizaUsageCount?:   number;
  createdAt:           string;
  uploadedBy?:         { firstName: string; lastName: string };
}

export interface SystemConfig {
  id:           string;
  key:          string;
  value:        string;
  description?: string;
  updatedAt:    string;
  updatedBy?:   { firstName: string; lastName: string };
}

// ─── Admin: Location Pings ────────────────────────────────────────────────────

export interface LocationPing {
  latitude:  number;
  longitude: number;
  accuracy?: number;
  activity?: string;
  createdAt: string;
}

export interface LoLocation {
  userId:   string;
  name:     string;
  branch:   string;
  branchId?: string;
  lastPing: LocationPing | null;
}

// ─── ILP (Individual Loan Product) ───────────────────────────────────────────

export type ILPSegment = 'FARMER' | 'LANDLORD' | 'SHOP_OWNER';
export type ILPEligibilityStatus = 'NOT_ELIGIBLE' | 'ELIGIBLE' | 'MASTERED';
export type ILPRecommendation = 'APPROVE' | 'CONDITIONAL' | 'DECLINE';
export type ILPVisitType = 'PHONE_CALL' | 'FIELD_VISIT' | 'DOCUMENT_REVIEW' | 'KPI_CHECK';

export interface BranchILPEligibility {
  id:                string;
  branchId:          string;
  segment:           ILPSegment;
  status:            ILPEligibilityStatus;
  par30AtUnlock?:    number;
  retentionAtUnlock?: number;
  growthAtUnlock?:   number;
  unlockedAt?:       string;
  unlockedById?:     string;
  masteredAt?:       string;
  masteredById?:     string;
  notes?:            string;
  createdAt:         string;
  updatedAt:         string;
}

export interface BranchILPMetrics {
  par30:     number;
  retention: number;
  growth:    number;
}

export interface BranchILPEligibilityResponse {
  branchId:           string;
  branchName:         string;
  metrics:            BranchILPMetrics;
  thresholds:         { maxPar30: number; minRetention: number; minGrowth: number };
  meetsThreshold:     boolean;
  activeSegmentCount: number;
  eligibilities:      BranchILPEligibility[];
}

export interface ILPAssessment {
  id:                  string;
  loanApplicationId:   string;
  segment:             ILPSegment;
  ownerScore:          number;
  ownerData:           Record<string, unknown>;
  businessScore:       number;
  businessData:        Record<string, unknown>;
  operationalRiskScore: number;
  operationalRiskData: Record<string, unknown>;
  cashFlowScore:       number;
  cashFlowData:        Record<string, unknown>;
  collateralScore:     number;
  collateralData:      Record<string, unknown>;
  compositeScore:      number;
  ilpRecommendation:   ILPRecommendation;
  assessorNotes?:      string;
  createdAt:           string;
  updatedAt:           string;
}

export interface ILPFollowUp {
  id:             string;
  loanId:         string;
  segment:        ILPSegment;
  loanCycle:      number;
  scheduledDate:  string;
  visitType:      ILPVisitType;
  milestone:      string;
  isCompleted:    boolean;
  completedAt?:   string;
  completedById?: string;
  completedBy?:   { firstName: string; lastName: string } | null;
  visitNotes?:    string;
  riskFlags:      string[];
  riskFlagId?:    string;
  riskFlag?:      CustomerRiskFlag | null;
  loan?: {
    loanNumber:      string;
    ilpCycleNumber?: number;
    customer: { id: string; firstName: string; lastName: string };
  };
  createdAt:      string;
}

// Extended LoanApplication with ILP fields
// (merged into existing LoanApplication interface via declaration)
export interface ILPSaveAssessmentPayload {
  segment:            ILPSegment;
  ownerData:          Record<string, unknown>;
  businessData:       Record<string, unknown>;
  operationalRiskData: Record<string, unknown>;
  cashFlowData: {
    totalMonthlyIncome:  number;
    existingMonthlyDebt: number;
    newInstallmentKes:   number;
    months?: { month: string; income: number; expense: number }[];
  };
  collateralData: {
    items: { type: string; valueKes: number; isVerified: boolean }[];
    loanAmountKes: number;
  };
  assessorNotes?: string;
}

export interface ILPSaveAssessmentResponse {
  assessment: ILPAssessment;
  scores: {
    ownerScore:          number;
    businessScore:       number;
    operationalRiskScore: number;
    cashFlowScore:       number;
    collateralScore:     number;
    compositeScore:      number;
    ilpRecommendation:   ILPRecommendation;
    dsr:                 number;
  };
}

// ─── Customer Award / Loyalty Tiers ─────────────────────────────────────────

export type CustomerTier = 'STANDARD' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

export interface CustomerTierSummary {
  tier:            CustomerTier;
  updatedAt:       string | null;
  completedCycles: number;
  hasWriteOff:     boolean;
  maxArrearsDays:  number;
  discounts: {
    rateDiscount: number;  // percentage points, e.g. 0.5 = -0.5% p.a.
    feeDiscount:  number;  // percentage, e.g. 10 = -10%
  };
}

// ─── KPI Risk Flags ──────────────────────────────────────────────────────────

export type RiskFlagCategory =
  | 'FINANCIAL_CAPACITY'
  | 'BUSINESS_PERFORMANCE'
  | 'REPAYMENT_BEHAVIOR'
  | 'OPERATIONAL_RISK'
  | 'COLLATERAL_RISK';

export type RiskFlagSeverity = 'YELLOW' | 'RED';

export interface FlagGuidance {
  questions: string[];
  actions:   string[];
}

export interface CustomerRiskFlag {
  id:           string;
  customerId:   string;
  loanId:       string;
  category:     RiskFlagCategory;
  severity:     RiskFlagSeverity;
  indicator:    string;
  title:        string;
  description:  string;
  value?:       number;
  threshold?:   number;
  isActive:     boolean;
  resolvedAt?:  string;
  resolvedNote?: string;
  resolvedById?: string;
  resolvedBy?:  { firstName: string; lastName: string } | null;
  guidance?:    FlagGuidance;
  createdAt:    string;
  updatedAt:    string;
}
