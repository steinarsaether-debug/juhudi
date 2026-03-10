/**
 * Seed 20 Nairobi HQ test customers with full onboarding, interviews, and varied loan states.
 *
 * Distribution:
 *  - Customers 1–5:   KYC complete, interviews done, NO loan (ready to apply)
 *  - Customers 6–7:   Group A ("Nairobi Kilimo Group A") — pending GROUP loan application
 *  - Customers 8–9:   Group B ("Nairobi Kilimo Group B") — pending GROUP loan application
 *  - Customers 10–13: Pending ILP LANDLORD individual application
 *  - Customers 14–16: Group A members, completed 1st GROUP loan cycle (BRONZE tier)
 *  - Customers 17–19: Group B members, completed 1st GROUP loan cycle (BRONZE tier)
 *  - Customer 20:     Completed 1st individual loan cycle (BRONZE tier)
 *
 * Run: npx tsx prisma/seed-nairobi-test.ts
 */

import {
  PrismaClient,
  Gender,
  MaritalStatus,
  LandOwnership,
  IrrigationType,
  MarketAccess,
  CRBStatus,
  KYCStatus,
  AMLStatus,
  LoanRecommendation,
  ApplicationStatus,
  LoanStatus,
  DisbursementMethod,
  PaymentMethod,
  GroupMeetingFrequency,
  GroupMemberRole,
  CollateralType,
  LoanType,
  InterviewStatus,
  InterviewRecommendation,
  CustomerTier,
  ILPSegment,
} from '@prisma/client';

import {
  createCipheriv,
  createHash,
  randomBytes,
} from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// ── Load .env manually ────────────────────────────────────────────────────────

const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

// ── Encryption helpers (mirrored from src/services/encryption.ts) ─────────

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function encrypt(plaintext: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  return Buffer.from(combined).toString('base64');
}

function hashForLookup(value: string): string {
  const pepper = process.env.ENCRYPTION_IV_KEY!;
  return createHash('sha256')
    .update(pepper + value.trim().toLowerCase())
    .digest('hex');
}

// ── Prisma client ─────────────────────────────────────────────────────────────

const prisma = new PrismaClient();

// ── Constants ─────────────────────────────────────────────────────────────────

const BRANCH_ID    = '26383792-0ce2-4b47-b3d7-6cd3654f11ad';
const LO_ID        = 'c04dd0e3-8d2f-47b8-a5c5-0dcf5a57a47b';  // Mary Wanjiku
const BM_ID        = 'edf077d1-7071-499f-92db-088a428b766e';  // Grace Wambui
const PRODUCT_GROUP = 'b0977046-0918-489e-ba38-f2d36269b656'; // AGRI-MICRO 18%
const PRODUCT_ILP   = '857a42bc-227b-406f-af0c-6c9d81187fe3'; // ILP-LAND  17%

// ── Customer profiles ─────────────────────────────────────────────────────────

interface CustomerProfile {
  index: number;
  firstName: string;
  lastName: string;
  nationalId: string;
  phone: string;
  dob: string;
  gender: Gender;
  marital: MaritalStatus;
  dependents: number;
  subCounty: string;
  ward: string;
  village: string;
  nextOfKin: string;
  nextOfKinPhone: string;
  nextOfKinRelation: string;
  monthlyFarmIncome: number;
  monthlyOffFarmIncome: number;
  monthlyExpenses: number;
  otherDebt: number;
  // Property details for landlord profiles
  isLandlord?: boolean;
  units?: number;
  rentPerUnit?: number;
}

const CUSTOMERS: CustomerProfile[] = [
  // ── 1–5: No loans ──────────────────────────────────────────────────────────
  {
    index: 1, firstName: 'Amina', lastName: 'Hassan',
    nationalId: '31201001', phone: '+254701100001',
    dob: '1985-03-14', gender: 'FEMALE', marital: 'MARRIED', dependents: 3,
    subCounty: 'Westlands', ward: 'Parklands/Highridge', village: 'Parklands',
    nextOfKin: 'Omar Hassan', nextOfKinPhone: '+254701100002', nextOfKinRelation: 'Spouse',
    monthlyFarmIncome: 0, monthlyOffFarmIncome: 42000, monthlyExpenses: 28000, otherDebt: 0,
    isLandlord: true, units: 4, rentPerUnit: 12000,
  },
  {
    index: 2, firstName: 'Daniel', lastName: 'Mwangi',
    nationalId: '31201002', phone: '+254701100003',
    dob: '1979-07-22', gender: 'MALE', marital: 'MARRIED', dependents: 4,
    subCounty: 'Kasarani', ward: 'Kasarani', village: 'Kasarani',
    nextOfKin: 'Jane Mwangi', nextOfKinPhone: '+254701100004', nextOfKinRelation: 'Spouse',
    monthlyFarmIncome: 18000, monthlyOffFarmIncome: 8000, monthlyExpenses: 20000, otherDebt: 0,
  },
  {
    index: 3, firstName: 'Esther', lastName: 'Njeri',
    nationalId: '31201003', phone: '+254701100005',
    dob: '1991-11-05', gender: 'FEMALE', marital: 'SINGLE', dependents: 1,
    subCounty: 'Langata', ward: 'Mugumoini', village: 'Karen',
    nextOfKin: 'Mary Njeri', nextOfKinPhone: '+254701100006', nextOfKinRelation: 'Mother',
    monthlyFarmIncome: 22000, monthlyOffFarmIncome: 5000, monthlyExpenses: 18000, otherDebt: 0,
  },
  {
    index: 4, firstName: 'Francis', lastName: 'Ochieng',
    nationalId: '31201004', phone: '+254701100007',
    dob: '1983-01-30', gender: 'MALE', marital: 'MARRIED', dependents: 5,
    subCounty: 'Embakasi East', ward: 'Embakasi', village: 'Embakasi',
    nextOfKin: 'Rose Ochieng', nextOfKinPhone: '+254701100008', nextOfKinRelation: 'Spouse',
    monthlyFarmIncome: 15000, monthlyOffFarmIncome: 12000, monthlyExpenses: 22000, otherDebt: 3000,
  },
  {
    index: 5, firstName: 'Grace', lastName: 'Waithera',
    nationalId: '31201005', phone: '+254701100009',
    dob: '1988-09-18', gender: 'FEMALE', marital: 'DIVORCED', dependents: 2,
    subCounty: 'Starehe', ward: 'Hospital', village: 'Pangani',
    nextOfKin: 'John Waithera', nextOfKinPhone: '+254701100010', nextOfKinRelation: 'Brother',
    monthlyFarmIncome: 25000, monthlyOffFarmIncome: 0, monthlyExpenses: 16000, otherDebt: 0,
  },

  // ── 6–7: Group A — pending GROUP app ──────────────────────────────────────
  {
    index: 6, firstName: 'Henry', lastName: 'Kariuki',
    nationalId: '31201006', phone: '+254701100011',
    dob: '1980-05-12', gender: 'MALE', marital: 'MARRIED', dependents: 4,
    subCounty: 'Roysambu', ward: 'Roysambu', village: 'Roysambu',
    nextOfKin: 'Lucy Kariuki', nextOfKinPhone: '+254701100012', nextOfKinRelation: 'Spouse',
    monthlyFarmIncome: 20000, monthlyOffFarmIncome: 8000, monthlyExpenses: 19000, otherDebt: 0,
  },
  {
    index: 7, firstName: 'Irene', lastName: 'Kamau',
    nationalId: '31201007', phone: '+254701100013',
    dob: '1987-02-27', gender: 'FEMALE', marital: 'MARRIED', dependents: 3,
    subCounty: 'Roysambu', ward: 'Roysambu', village: 'Roysambu',
    nextOfKin: 'James Kamau', nextOfKinPhone: '+254701100014', nextOfKinRelation: 'Spouse',
    monthlyFarmIncome: 18000, monthlyOffFarmIncome: 5000, monthlyExpenses: 17000, otherDebt: 0,
  },

  // ── 8–9: Group B — pending GROUP app ──────────────────────────────────────
  {
    index: 8, firstName: 'Joseph', lastName: 'Mutua',
    nationalId: '31201008', phone: '+254701100015',
    dob: '1975-08-03', gender: 'MALE', marital: 'MARRIED', dependents: 6,
    subCounty: 'Embakasi West', ward: 'Pipeline', village: 'Pipeline',
    nextOfKin: 'Sarah Mutua', nextOfKinPhone: '+254701100016', nextOfKinRelation: 'Spouse',
    monthlyFarmIncome: 28000, monthlyOffFarmIncome: 10000, monthlyExpenses: 25000, otherDebt: 0,
  },
  {
    index: 9, firstName: 'Kelvin', lastName: 'Otieno',
    nationalId: '31201009', phone: '+254701100017',
    dob: '1990-12-15', gender: 'MALE', marital: 'SINGLE', dependents: 1,
    subCounty: 'Embakasi West', ward: 'Pipeline', village: 'Imara Daima',
    nextOfKin: 'Peter Otieno', nextOfKinPhone: '+254701100018', nextOfKinRelation: 'Father',
    monthlyFarmIncome: 16000, monthlyOffFarmIncome: 6000, monthlyExpenses: 14000, otherDebt: 0,
  },

  // ── 10–13: ILP LANDLORD pending ────────────────────────────────────────────
  {
    index: 10, firstName: 'Linda', lastName: 'Akinyi',
    nationalId: '31201010', phone: '+254701100019',
    dob: '1978-04-08', gender: 'FEMALE', marital: 'MARRIED', dependents: 3,
    subCounty: 'Westlands', ward: 'Kangemi', village: 'Kangemi',
    nextOfKin: 'Tom Akinyi', nextOfKinPhone: '+254701100020', nextOfKinRelation: 'Spouse',
    monthlyFarmIncome: 0, monthlyOffFarmIncome: 65000, monthlyExpenses: 35000, otherDebt: 0,
    isLandlord: true, units: 6, rentPerUnit: 10000,
  },
  {
    index: 11, firstName: 'Moses', lastName: 'Wekesa',
    nationalId: '31201011', phone: '+254701100021',
    dob: '1972-10-19', gender: 'MALE', marital: 'MARRIED', dependents: 5,
    subCounty: 'Kasarani', ward: 'Mwiki', village: 'Mwiki',
    nextOfKin: 'Hannah Wekesa', nextOfKinPhone: '+254701100022', nextOfKinRelation: 'Spouse',
    monthlyFarmIncome: 0, monthlyOffFarmIncome: 80000, monthlyExpenses: 42000, otherDebt: 8000,
    isLandlord: true, units: 8, rentPerUnit: 10000,
  },
  {
    index: 12, firstName: 'Naomi', lastName: 'Chebet',
    nationalId: '31201012', phone: '+254701100023',
    dob: '1982-06-25', gender: 'FEMALE', marital: 'MARRIED', dependents: 2,
    subCounty: 'Langata', ward: 'Nairobi West', village: 'South B',
    nextOfKin: 'David Chebet', nextOfKinPhone: '+254701100024', nextOfKinRelation: 'Spouse',
    monthlyFarmIncome: 0, monthlyOffFarmIncome: 55000, monthlyExpenses: 30000, otherDebt: 5000,
    isLandlord: true, units: 5, rentPerUnit: 11000,
  },
  {
    index: 13, firstName: 'Oscar', lastName: 'Njoroge',
    nationalId: '31201013', phone: '+254701100025',
    dob: '1968-03-11', gender: 'MALE', marital: 'MARRIED', dependents: 4,
    subCounty: 'Starehe', ward: 'Ngara', village: 'Pangani Estate',
    nextOfKin: 'Ann Njoroge', nextOfKinPhone: '+254701100026', nextOfKinRelation: 'Spouse',
    monthlyFarmIncome: 0, monthlyOffFarmIncome: 72000, monthlyExpenses: 40000, otherDebt: 10000,
    isLandlord: true, units: 7, rentPerUnit: 10000,
  },

  // ── 14–16: Group A — completed 1st cycle ──────────────────────────────────
  {
    index: 14, firstName: 'Patricia', lastName: 'Muthoni',
    nationalId: '31201014', phone: '+254701100027',
    dob: '1984-09-03', gender: 'FEMALE', marital: 'MARRIED', dependents: 3,
    subCounty: 'Roysambu', ward: 'Roysambu', village: 'Roysambu Estate',
    nextOfKin: 'Paul Muthoni', nextOfKinPhone: '+254701100028', nextOfKinRelation: 'Spouse',
    monthlyFarmIncome: 22000, monthlyOffFarmIncome: 7000, monthlyExpenses: 20000, otherDebt: 0,
  },
  {
    index: 15, firstName: 'Robert', lastName: 'Kimani',
    nationalId: '31201015', phone: '+254701100029',
    dob: '1977-12-20', gender: 'MALE', marital: 'MARRIED', dependents: 4,
    subCounty: 'Roysambu', ward: 'Githurai', village: 'Githurai 44',
    nextOfKin: 'Susan Kimani', nextOfKinPhone: '+254701100030', nextOfKinRelation: 'Spouse',
    monthlyFarmIncome: 30000, monthlyOffFarmIncome: 5000, monthlyExpenses: 22000, otherDebt: 0,
  },
  {
    index: 16, firstName: 'Sylvia', lastName: 'Nduta',
    nationalId: '31201016', phone: '+254701100031',
    dob: '1989-05-07', gender: 'FEMALE', marital: 'SINGLE', dependents: 1,
    subCounty: 'Roysambu', ward: 'Kahawa West', village: 'Kahawa West',
    nextOfKin: 'Alice Nduta', nextOfKinPhone: '+254701100032', nextOfKinRelation: 'Sister',
    monthlyFarmIncome: 18000, monthlyOffFarmIncome: 9000, monthlyExpenses: 18000, otherDebt: 0,
  },

  // ── 17–19: Group B — completed 1st cycle ──────────────────────────────────
  {
    index: 17, firstName: 'Thomas', lastName: 'Kiptoo',
    nationalId: '31201017', phone: '+254701100033',
    dob: '1981-07-16', gender: 'MALE', marital: 'MARRIED', dependents: 5,
    subCounty: 'Embakasi West', ward: 'Umoja II', village: 'Umoja',
    nextOfKin: 'Caroline Kiptoo', nextOfKinPhone: '+254701100034', nextOfKinRelation: 'Spouse',
    monthlyFarmIncome: 25000, monthlyOffFarmIncome: 8000, monthlyExpenses: 24000, otherDebt: 0,
  },
  {
    index: 18, firstName: 'Ursula', lastName: 'Wangari',
    nationalId: '31201018', phone: '+254701100035',
    dob: '1985-11-28', gender: 'FEMALE', marital: 'MARRIED', dependents: 2,
    subCounty: 'Embakasi East', ward: 'Upper Savanna', village: 'Fedha Estate',
    nextOfKin: 'Victor Wangari', nextOfKinPhone: '+254701100036', nextOfKinRelation: 'Spouse',
    monthlyFarmIncome: 20000, monthlyOffFarmIncome: 6000, monthlyExpenses: 19000, otherDebt: 0,
  },
  {
    index: 19, firstName: 'Vincent', lastName: 'Auma',
    nationalId: '31201019', phone: '+254701100037',
    dob: '1976-04-02', gender: 'MALE', marital: 'MARRIED', dependents: 6,
    subCounty: 'Embakasi North', ward: 'Embakasi North', village: 'Taj Mall area',
    nextOfKin: 'Beatrice Auma', nextOfKinPhone: '+254701100038', nextOfKinRelation: 'Spouse',
    monthlyFarmIncome: 32000, monthlyOffFarmIncome: 12000, monthlyExpenses: 28000, otherDebt: 0,
  },

  // ── 20: Individual completed 1st cycle ────────────────────────────────────
  {
    index: 20, firstName: 'Winnie', lastName: 'Koech',
    nationalId: '31201020', phone: '+254701100039',
    dob: '1993-08-14', gender: 'FEMALE', marital: 'SINGLE', dependents: 0,
    subCounty: 'Dagoretti North', ward: 'Riruta Satellite', village: 'Riruta',
    nextOfKin: 'Alice Koech', nextOfKinPhone: '+254701100040', nextOfKinRelation: 'Mother',
    monthlyFarmIncome: 28000, monthlyOffFarmIncome: 5000, monthlyExpenses: 20000, otherDebt: 0,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function installment(principal: number, annualRate: number, months: number): number {
  const r = annualRate / 100 / 12;
  if (r === 0) return principal / months;
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

function customerNumber(idx: number): string {
  return `NBO-TEST-${String(idx).padStart(3, '0')}`;
}

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function subtractMonths(date: Date, n: number): Date {
  return addMonths(date, -n);
}

// Standard interview answers (realistic for Nairobi area)
function standardInterviewAnswers() {
  return {
    q1: { score: 4, notes: 'Long-term resident, stable household' },
    q2: { score: 4, notes: 'Good community standing confirmed' },
    q3: { score: 3, notes: 'Positive cash flow from primary activity' },
    q4: { score: 4, notes: 'No delinquencies observed' },
    q5: { score: 3, notes: 'Some savings, manageable debt' },
    q6: { score: 4, notes: 'Clear repayment intent demonstrated' },
    q7: { score: 4, notes: 'Stable primary income source' },
    q8: { score: 3, notes: 'Moderate household expenses' },
  };
}

// ILP Landlord interview answers
function ilpLandlordInterviewAnswers(units: number, rentPerUnit: number) {
  return {
    // Section A — Background
    A1: { score: 5, notes: '7 years owning rental property' },
    A2: { score: 4, notes: `${Math.ceil(units / 2)} properties owned` },
    A3: { score: 4, notes: 'Yes, previous loan repaid on time' },
    A4: { score: 5, notes: 'Fully on time' },
    A5: { score: 4, notes: 'Two references provided, both verifiable' },
    A6: { score: 5, notes: 'CRB clear — no issues' },
    // Section B — Property & Business
    B7: { score: 4, notes: 'Nairobi urban area, good connectivity' },
    B8: { score: 4, notes: 'Residential rental' },
    B9: { score: 4, notes: `${units} rentable units` },
    B10: { score: 4, notes: `${Math.floor(units * 0.9)} units occupied — ${Math.round(0.9 * 100)}% occupancy` },
    B11: { score: 4, notes: `Average KES ${rentPerUnit}/month per unit` },
    B12: { score: 4, notes: 'Longest tenant: 4 years' },
    B13: { score: 5, notes: 'Title deed in applicant name, number: TD-NBO-TEST' },
    // Section C — Operational Risk
    C14: { score: 4, notes: 'Building is 8 years old' },
    C15: { score: 4, notes: 'Good maintenance condition' },
    C16: { score: 4, notes: 'Building insured with Jubilee' },
    C17: { score: 4, notes: 'Good urban area, high demand' },
    C18: { score: 5, notes: 'No disputes or vacancies expected' },
    // Section D — Cash Flow
    D19: { score: 4, notes: `Total rental KES ${units * rentPerUnit}/month` },
    D20: { score: 4, notes: 'Maintenance KES 8,000/month' },
    D21: { score: 4, notes: 'Household expenses manageable' },
    D22: { score: 5, notes: 'No existing loan repayments' },
    D23: { score: 4, notes: 'Rental income is primary source' },
    // Section E — Loan Purpose & Collateral
    E24: { score: 4, notes: 'Renovation and upgrading units to command higher rents' },
    E25: { score: 5, notes: 'Title deed offered as primary collateral, TD-NBO-TEST' },
  };
}

// Credit score data
function buildCreditScore(p: CustomerProfile) {
  const totalIncome = p.monthlyFarmIncome + p.monthlyOffFarmIncome;
  const dsr = totalIncome > 0 ? (p.otherDebt / totalIncome) * 100 : 0;
  const cashflowScore = Math.min(35, Math.round(35 * (1 - dsr / 100)));
  const abilityScore = Math.min(35, Math.round(25 + Math.random() * 8));
  const willingnessScore = Math.min(30, Math.round(22 + Math.random() * 7));
  const totalScore = cashflowScore + abilityScore + willingnessScore;
  const maxLoan = Math.round((totalIncome - p.monthlyExpenses - p.otherDebt) * 6 / 1000) * 1000;
  return {
    cashflowScore, abilityScore, willingnessScore, totalScore,
    recommendation: totalScore >= 70 ? 'APPROVE' as LoanRecommendation
      : totalScore >= 50 ? 'CONDITIONAL' as LoanRecommendation
      : 'DECLINE' as LoanRecommendation,
    maxLoanAmountKes: Math.max(10000, maxLoan),
    suggestedTermMonths: 6,
    cashflowBreakdown: { dsr, netIncome: totalIncome - p.monthlyExpenses },
    abilityBreakdown: { experience: 5, education: 3 },
    willingnessBreakdown: { crbStatus: 'CLEAR', groupHistory: true },
    inputSnapshot: { monthlyIncome: totalIncome, monthlyExpenses: p.monthlyExpenses },
  };
}

// ILP Assessment for LANDLORD
function buildILPAssessment(p: CustomerProfile) {
  const units = p.units ?? 4;
  const rentPerUnit = p.rentPerUnit ?? 10000;
  const totalRent = units * rentPerUnit;
  const maintenance = 8000;
  const existingDebt = p.otherDebt;

  const ownerScore = 82;
  const businessScore = 78; // Good occupancy (90%), 5 units, title deed
  const opsScore = 75;
  const installmentKes = installment(250000, 17, 12);
  const dsr = ((existingDebt + installmentKes) / (totalRent + p.monthlyOffFarmIncome)) * 100;
  const cashFlowScore = dsr < 30 ? 100 : dsr < 35 ? 80 : dsr < 40 ? 60 : dsr < 45 ? 40 : 0;
  const collateralScore = 85; // title deed verified
  const compositeScore = Math.round(
    ownerScore * 0.20 + businessScore * 0.25 + opsScore * 0.20 + cashFlowScore * 0.25 + collateralScore * 0.10
  );

  return {
    segment: 'LANDLORD' as ILPSegment,
    ownerScore, ownerData: { experienceYears: 7, crbStatus: 'CLEAR', loanHistoryType: 'ON_TIME', referenceCount: 2 },
    businessScore, businessData: { occupancyPct: 90, unitCount: units, hasTitleDeed: true },
    operationalRiskScore: opsScore, operationalRiskData: { buildingAgeYears: 8, hasInsurance: true, maintenanceCondition: 'GOOD', locationRisk: 'GOOD' },
    cashFlowScore, cashFlowData: { totalMonthlyIncome: totalRent, existingMonthlyDebt: existingDebt, newInstallmentKes: Math.round(installmentKes), months: [] },
    collateralScore, collateralData: { items: [{ type: 'TITLE_DEED', valueKes: 600000, isVerified: true }], loanAmountKes: 250000 },
    compositeScore, ilpRecommendation: compositeScore >= 75 ? 'APPROVE' : compositeScore >= 60 ? 'CONDITIONAL' : 'DECLINE',
    assessorNotes: `ILP Landlord assessment for ${p.firstName} ${p.lastName}. Property well-maintained, good occupancy rate, title deed verified.`,
  };
}

// ── Main seeding logic ────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌱  Nairobi HQ test data seeding started…\n');

  // ── Step 1: Create 2 loan groups ──────────────────────────────────────────

  console.log('Creating loan groups…');
  const now = new Date();
  const groupADate = subtractMonths(now, 6);
  const groupBDate = subtractMonths(now, 5);

  const groupA = await prisma.loanGroup.upsert({
    where: { id: 'seed-group-nbo-a' },
    update: {},
    create: {
      id: 'seed-group-nbo-a',
      name: 'Nairobi Kilimo Group A',
      registrationNo: 'SHG-NBO-2024-001',
      branchId: BRANCH_ID,
      loanOfficerId: LO_ID,
      status: 'ACTIVE',
      meetingFrequency: 'BIWEEKLY',
      meetingDay: 'WEDNESDAY',
      meetingLocation: 'Roysambu Community Hall',
      formedAt: subtractMonths(groupADate, 1),
      registeredAt: groupADate,
      notes: 'Test group A — urban peri-urban farmers, Roysambu area',
    },
  });
  console.log(`  Group A created: ${groupA.id}`);

  const groupB = await prisma.loanGroup.upsert({
    where: { id: 'seed-group-nbo-b' },
    update: {},
    create: {
      id: 'seed-group-nbo-b',
      name: 'Nairobi Kilimo Group B',
      registrationNo: 'SHG-NBO-2024-002',
      branchId: BRANCH_ID,
      loanOfficerId: LO_ID,
      status: 'ACTIVE',
      meetingFrequency: 'BIWEEKLY',
      meetingDay: 'FRIDAY',
      meetingLocation: 'Pipeline Market Centre',
      formedAt: subtractMonths(groupBDate, 1),
      registeredAt: groupBDate,
      notes: 'Test group B — Embakasi area farmers',
    },
  });
  console.log(`  Group B created: ${groupB.id}`);

  // ── Step 2: Create customers ──────────────────────────────────────────────

  for (const p of CUSTOMERS) {
    console.log(`\nCreating customer ${p.index}: ${p.firstName} ${p.lastName}…`);

    const idHash    = hashForLookup(p.nationalId);
    const phoneHash = hashForLookup(p.phone);

    // Check for existing (idempotent)
    const existing = await prisma.customer.findUnique({ where: { nationalIdHash: idHash } });
    if (existing) {
      console.log(`  → already exists (${existing.id}), skipping`);
      continue;
    }

    const customer = await prisma.customer.create({
      data: {
        nationalIdEnc:     encrypt(p.nationalId),
        nationalIdHash:    idHash,
        phoneEnc:          encrypt(p.phone),
        phoneHash:         phoneHash,
        firstName:         p.firstName,
        lastName:          p.lastName,
        dateOfBirth:       new Date(p.dob),
        gender:            p.gender,
        maritalStatus:     p.marital,
        numberOfDependents: p.dependents,
        county:            'Nairobi',
        subCounty:         p.subCounty,
        ward:              p.ward,
        village:           p.village,
        nextOfKinName:     p.nextOfKin,
        nextOfKinPhone:    p.nextOfKinPhone,
        nextOfKinRelation: p.nextOfKinRelation,
        dataConsentGiven:  true,
        dataConsentAt:     subtractMonths(now, 3),
        dataConsentVersion: 'v1.0',
        isPEP:             false,
        kycStatus:         'VERIFIED',
        amlStatus:         'CLEAR',
        riskRating:        'LOW',
        branchId:          BRANCH_ID,
        customerNumber:    customerNumber(p.index),
        currentTier:       p.index >= 14 ? 'BRONZE' : 'STANDARD',
        tierUpdatedAt:     p.index >= 14 ? subtractMonths(now, 1) : null,
      },
    });
    console.log(`  Created: ${customer.id}`);

    // ── Farm Profile ──────────────────────────────────────────────────────
    const isLandlord = !!p.isLandlord;

    await prisma.farmProfile.create({
      data: {
        customerId:         customer.id,
        farmSize:           isLandlord ? 0.1 : 2.5,
        landOwnership:      isLandlord ? 'OWNED' : 'OWNED',
        primaryCrop:        isLandlord ? 'N/A - Rental Property' : 'Maize',
        secondaryCrops:     isLandlord ? [] : ['Beans', 'Vegetables'],
        irrigationType:     isLandlord ? 'RAIN_FED' : 'MIXED',
        hasGreenhouse:      false,
        livestockType:      [],
        marketAccess:       isLandlord ? 'LOCAL_MARKET' : 'COOPERATIVE',
        distanceToMarket:   isLandlord ? 0.5 : 3.0,
        hasStorageFacility: !isLandlord,
        hasElectricity:     true,
        hasPipedWater:      true,
      },
    });

    // ── Financial Profile ─────────────────────────────────────────────────
    await prisma.financialProfile.create({
      data: {
        customerId:                customer.id,
        monthlyFarmIncome:         p.monthlyFarmIncome,
        monthlyOffFarmIncome:      p.monthlyOffFarmIncome,
        monthlyHouseholdExpenses:  p.monthlyExpenses,
        otherMonthlyDebt:          p.otherDebt,
        hasMpesa:                  true,
        mpesaMonthlyAvgKes:        (p.monthlyFarmIncome + p.monthlyOffFarmIncome) * 0.7,
        hasBankAccount:            true,
        bankName:                  'Equity Bank',
        hasGroupMembership:        p.index >= 6 && p.index <= 9 || p.index >= 14 && p.index <= 19,
        groupName:                 (p.index >= 6 && p.index <= 9 || p.index >= 14 && p.index <= 16) ? 'Nairobi Kilimo Group A'
                                 : (p.index >= 17 && p.index <= 19) ? 'Nairobi Kilimo Group B' : null,
        crbStatus:                 'CLEAR',
        crbCheckedAt:              subtractMonths(now, 2),
        previousLoansCount:        p.index >= 14 ? 1 : 0,
        previousLoansRepaidOnTime: p.index >= 14 ? true : null,
      },
    });

    // ── Standard Interview ────────────────────────────────────────────────
    const stdInterviewDate = subtractMonths(now, 2);
    await prisma.customerInterview.create({
      data: {
        customerId:    customer.id,
        conductedById: LO_ID,
        language:      'en',
        status:        'COMPLETED',
        interviewType: 'STANDARD',
        answers:       standardInterviewAnswers(),
        totalScore:    29,
        maxScore:      40,
        scorePercent:  72.5,
        recommendation: 'APPROVE_WITH_CONDITIONS',
        loNotes:       `Standard pre-screening interview with ${p.firstName}. Good community standing and stable income.`,
        completedAt:   stdInterviewDate,
      },
    });

    // ── ILP LANDLORD Interview (for customers 10–13) ──────────────────────
    if (p.index >= 10 && p.index <= 13) {
      await prisma.customerInterview.create({
        data: {
          customerId:    customer.id,
          conductedById: LO_ID,
          language:      'en',
          status:        'COMPLETED',
          interviewType: 'ILP_LANDLORD',
          ilpSegment:    'LANDLORD',
          answers:       ilpLandlordInterviewAnswers(p.units ?? 4, p.rentPerUnit ?? 10000),
          totalScore:    95,
          maxScore:      125,
          scorePercent:  76,
          recommendation: 'APPROVE_WITH_CONDITIONS',
          loNotes:       `ILP Landlord interview with ${p.firstName}. Property verified on-site. Good occupancy. Title deed sighted.`,
          completedAt:   subtractMonths(now, 1),
        },
      });
    }

    // ── Credit Score ──────────────────────────────────────────────────────
    const cs = buildCreditScore(p);
    const creditScore = await prisma.creditScore.create({
      data: {
        customerId:          customer.id,
        cashflowScore:       cs.cashflowScore,
        cashflowBreakdown:   cs.cashflowBreakdown,
        abilityScore:        cs.abilityScore,
        abilityBreakdown:    cs.abilityBreakdown,
        willingnessScore:    cs.willingnessScore,
        willingnessBreakdown: cs.willingnessBreakdown,
        totalScore:          cs.totalScore,
        recommendation:      cs.recommendation,
        maxLoanAmountKes:    cs.maxLoanAmountKes,
        suggestedTermMonths: cs.suggestedTermMonths,
        inputSnapshot:       cs.inputSnapshot,
        scoredByUserId:      LO_ID,
      },
    });

    // ── Group membership ──────────────────────────────────────────────────
    let groupId: string | null = null;
    if ([6, 7, 14, 15, 16].includes(p.index)) {
      groupId = groupA.id;
      const role: GroupMemberRole = p.index === 6 ? 'CHAIR' : p.index === 7 ? 'SECRETARY' : 'MEMBER';
      await prisma.loanGroupMember.upsert({
        where: { groupId_customerId: { groupId: groupA.id, customerId: customer.id } },
        update: {},
        create: { groupId: groupA.id, customerId: customer.id, role, joinedAt: subtractMonths(now, 5) },
      });
    } else if ([8, 9, 17, 18, 19].includes(p.index)) {
      groupId = groupB.id;
      const role: GroupMemberRole = p.index === 8 ? 'CHAIR' : p.index === 9 ? 'TREASURER' : 'MEMBER';
      await prisma.loanGroupMember.upsert({
        where: { groupId_customerId: { groupId: groupB.id, customerId: customer.id } },
        update: {},
        create: { groupId: groupB.id, customerId: customer.id, role, joinedAt: subtractMonths(now, 4) },
      });
    }

    // ── Completed cycle loans (customers 14–20) ────────────────────────────

    if (p.index >= 14 && p.index <= 20) {
      const loanAmount  = p.index <= 19 ? 20000 : 30000; // group loans 20K, individual 30K
      const interestRate = 18;
      const termMonths   = 6;
      const disbDate     = subtractMonths(now, 8);
      const matDate      = addMonths(disbDate, termMonths);
      const instKes      = installment(loanAmount, interestRate, termMonths);
      const totalRepayable = instKes * termMonths;

      const completedApp = await prisma.loanApplication.create({
        data: {
          customerId:            customer.id,
          officerId:             LO_ID,
          creditScoreId:         creditScore.id,
          loanType:              ([14,15,16].includes(p.index) ? 'GROUP' : [17,18,19].includes(p.index) ? 'GROUP' : 'INDIVIDUAL') as LoanType,
          loanGroupId:           groupId,
          groupLoanShareKes:     groupId ? loanAmount : null,
          requestedAmountKes:    loanAmount,
          purposeCategory:       'SEEDS',
          purposeOfLoan:         'Purchase of certified maize seeds and fertilizer for the current planting season to improve yield and farm productivity.',
          loanProductId:         PRODUCT_GROUP,
          termMonths:            termMonths,
          repaymentMethod:       'MPESA',
          monthlyIncomeSnapshot: p.monthlyFarmIncome + p.monthlyOffFarmIncome,
          monthlyExpensesSnapshot: p.monthlyExpenses,
          hadShockPastYear:      false,
          hasSavingsBuffer:      true,
          savingsBufferMonths:   2,
          hasAlternativeIncome:  p.monthlyOffFarmIncome > 0,
          status:                'APPROVED',
          approvedAmountKes:     loanAmount,
          interestRatePct:       interestRate,
          reviewNotes:           'BCC approved unanimously. Good credit score and stable income.',
          reviewedByUserId:      BM_ID,
          reviewedAt:            subtractMonths(disbDate, 3),
          customerTierAtApplication: 'STANDARD',
          interestRateDiscountPct:   0,
          processingFeeDiscountPct:  0,
          createdAt:             subtractMonths(disbDate, 4),
        },
      });

      // Collateral
      await prisma.loanCollateral.create({
        data: {
          loanApplicationId: completedApp.id,
          collateralType:    'GROUP_GUARANTEE',
          description:       'Joint group liability — all members guarantee each other',
          estimatedValueKes: loanAmount * 5,
          isVerified:        true,
        },
      });

      // Loan record (COMPLETED)
      const loan = await prisma.loan.create({
        data: {
          applicationId:         completedApp.id,
          customerId:            customer.id,
          principalKes:          loanAmount,
          interestRatePct:       interestRate,
          termMonths:            termMonths,
          installmentKes:        Math.round(instKes),
          totalRepayableKes:     Math.round(totalRepayable),
          disbursementMethod:    'MPESA',
          disbursementReference: `TEST-DISBURSE-${p.index}-COMP`,
          disbursedAt:           disbDate,
          maturityDate:          matDate,
          status:                'COMPLETED',
          daysInArrears:         0,
          outstandingBalKes:     0,
        },
      });

      // Repayments (6 monthly installments)
      for (let m = 1; m <= termMonths; m++) {
        await prisma.repayment.create({
          data: {
            loanId:      loan.id,
            amountKes:   Math.round(instKes),
            paymentDate: addMonths(disbDate, m),
            method:      'MPESA',
            reference:   `MPESA-TEST-${p.index}-${m}`,
            recordedById: LO_ID,
            notes:       `Installment ${m} of ${termMonths}`,
          },
        });
      }

      console.log(`  → Completed loan: ${loan.id} (${termMonths} repayments recorded)`);
    }

    // ── Pending GROUP applications (customers 6–9) ────────────────────────

    if (p.index >= 6 && p.index <= 9) {
      const loanAmount  = 25000;
      const termMonths  = 6;
      const appDate     = subtractMonths(now, 1);

      const groupApp = await prisma.loanApplication.create({
        data: {
          customerId:               customer.id,
          officerId:                LO_ID,
          creditScoreId:            creditScore.id,
          loanType:                 'GROUP',
          loanGroupId:              [6,7,14,15,16].includes(p.index) ? groupA.id : groupB.id,
          groupLoanShareKes:        loanAmount,
          requestedAmountKes:       loanAmount,
          purposeCategory:          'FERTILIZER_AGROCHEMICALS',
          purposeOfLoan:            'Purchase of Yara fertilizer and crop protection products for the upcoming planting season. This will increase yield by an estimated 40% compared to last season.',
          loanProductId:            PRODUCT_GROUP,
          termMonths:               termMonths,
          repaymentMethod:          'MPESA',
          monthlyIncomeSnapshot:    p.monthlyFarmIncome + p.monthlyOffFarmIncome,
          monthlyExpensesSnapshot:  p.monthlyExpenses,
          hadShockPastYear:         false,
          hasSavingsBuffer:         true,
          savingsBufferMonths:      1,
          hasAlternativeIncome:     p.monthlyOffFarmIncome > 0,
          status:                   'SUBMITTED',
          reviewNotes:              null,
          customerTierAtApplication: 'STANDARD',
          interestRateDiscountPct:  0,
          processingFeeDiscountPct: 0,
          createdAt:                appDate,
        },
      });

      // Collateral
      await prisma.loanCollateral.create({
        data: {
          loanApplicationId: groupApp.id,
          collateralType:    'GROUP_GUARANTEE',
          description:       'Joint group liability — Nairobi Kilimo group members guarantee each other',
          estimatedValueKes: loanAmount * 4,
          isVerified:        false,
        },
      });

      console.log(`  → Pending GROUP application: ${groupApp.id}`);
    }

    // ── Pending ILP LANDLORD applications (customers 10–13) ───────────────

    if (p.index >= 10 && p.index <= 13) {
      const loanAmount  = 250000;
      const termMonths  = 12;
      const appDate     = subtractMonths(now, 2);
      const ilpAss      = buildILPAssessment(p);

      const ilpApp = await prisma.loanApplication.create({
        data: {
          customerId:               customer.id,
          officerId:                LO_ID,
          creditScoreId:            creditScore.id,
          loanType:                 'INDIVIDUAL',
          requestedAmountKes:       loanAmount,
          purposeCategory:          'PROPERTY_IMPROVEMENT',
          purposeOfLoan:            'Renovation and upgrading of rental units to install water meters, repaint units, upgrade bathrooms, and install security lights. This will allow rent increase from KES 10,000 to KES 13,000 per unit within 6 months, significantly improving rental yield and property value.',
          loanProductId:            PRODUCT_ILP,
          termMonths:               termMonths,
          repaymentMethod:          'MPESA',
          ilpSegment:               'LANDLORD',
          monthlyIncomeSnapshot:    (p.units ?? 4) * (p.rentPerUnit ?? 10000),
          monthlyExpensesSnapshot:  p.monthlyExpenses,
          hadShockPastYear:         false,
          hasSavingsBuffer:         true,
          savingsBufferMonths:      3,
          hasAlternativeIncome:     false,
          status:                   'SUBMITTED',
          customerTierAtApplication: 'STANDARD',
          interestRateDiscountPct:  0,
          processingFeeDiscountPct: 0,
          createdAt:                appDate,
        },
      });

      // ILP Assessment
      await prisma.iLPAssessment.create({
        data: {
          loanApplicationId:    ilpApp.id,
          segment:              ilpAss.segment,
          ownerScore:           ilpAss.ownerScore,
          ownerData:            ilpAss.ownerData,
          businessScore:        ilpAss.businessScore,
          businessData:         ilpAss.businessData,
          operationalRiskScore: ilpAss.operationalRiskScore,
          operationalRiskData:  ilpAss.operationalRiskData,
          cashFlowScore:        ilpAss.cashFlowScore,
          cashFlowData:         ilpAss.cashFlowData,
          collateralScore:      ilpAss.collateralScore,
          collateralData:       ilpAss.collateralData,
          compositeScore:       ilpAss.compositeScore,
          ilpRecommendation:    ilpAss.ilpRecommendation,
          assessorNotes:        ilpAss.assessorNotes,
        },
      });

      // Collateral
      await prisma.loanCollateral.create({
        data: {
          loanApplicationId: ilpApp.id,
          collateralType:    'TITLE_DEED',
          description:       'Title deed for rental property — verified and in applicant name',
          estimatedValueKes: 600000,
          isVerified:        true,
        },
      });

      console.log(`  → Pending ILP LANDLORD application: ${ilpApp.id} (composite: ${ilpAss.compositeScore})`);
    }

    console.log(`  ✓ Customer ${p.index} complete`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  const totals = await prisma.customer.count({ where: { branchId: BRANCH_ID } });
  const pending = await prisma.loanApplication.count({ where: { status: 'SUBMITTED', customer: { branchId: BRANCH_ID } } });
  const completed = await prisma.loan.count({ where: { status: 'COMPLETED', customer: { branchId: BRANCH_ID } } });

  console.log(`\n✅  Seeding complete!`);
  console.log(`   Total Nairobi HQ customers: ${totals}`);
  console.log(`   Pending applications: ${pending}`);
  console.log(`   Completed loans: ${completed}`);
  console.log(`\n   Login as Mary Wanjiku (officer.wanjiku@juhudikilimo.co.ke) to see the worklist.`);
}

main()
  .catch(err => { console.error('❌ Seed failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
