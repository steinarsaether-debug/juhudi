// ─── Multi-Step Loan Application Wizard ──────────────────────────────────────
// 6 steps (0-5):
//   0 – Loan Type & Product
//   1 – Purpose & Amount
//   2 – Cash Flow Verification
//   3 – Resilience Assessment
//   4 – Collateral
//   5 – Review & Submit
import { useState, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CreditCard, ChevronLeft, ChevronRight, CheckCircle2, Users,
  User, Plus, Trash2, AlertTriangle,
} from 'lucide-react';
import { loanApi, customerApi, groupApi, interviewApi, getErrorMessage } from '../../services/api';
import { Customer, LoanGroup, CollateralType, CustomerInterview } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import AmortisationTable from '../../components/AmortisationTable';
import JourneyGate, { GateRequirement } from '../../components/common/JourneyGate';
import { buildJourneySteps } from '../../components/common/CustomerJourneyBar';
import clsx from 'clsx';

// ── Constants ─────────────────────────────────────────────────────────────────

const LOAN_PRODUCTS = [
  {
    id:       'SHORT_TERM',
    label:    'Short-Term Input Loan',
    category: 'SHORT_TERM_INPUTS',
    term:     6,
    minKes:   5_000,
    maxKes:   80_000,
    desc:     'Fertilizer, seeds, pesticides, agrochemicals (6 months)',
  },
  {
    id:       'LONG_TERM',
    label:    'Long-Term Investment Loan',
    category: 'LONG_TERM_INVESTMENT',
    term:     12,
    minKes:   20_000,
    maxKes:   250_000,
    desc:     'Livestock, replanting, irrigation, equipment (12 months)',
  },
] as const;

const PURPOSE_CATEGORIES = [
  { value: 'FERTILIZER_AGROCHEMICALS', label: 'Fertilizer & Agrochemicals' },
  { value: 'SEEDS_PLANTING',           label: 'Seeds & Planting Material' },
  { value: 'PESTICIDES_HERBICIDES',    label: 'Pesticides & Herbicides' },
  { value: 'LIVESTOCK_PURCHASE',       label: 'Livestock Purchase' },
  { value: 'FARM_EQUIPMENT',           label: 'Farm Equipment' },
  { value: 'REPLANTING',               label: 'Replanting / Crop Rehabilitation' },
  { value: 'LAND_PREPARATION',         label: 'Land Preparation' },
  { value: 'IRRIGATION',               label: 'Irrigation Infrastructure' },
  { value: 'OTHER',                    label: 'Other' },
];

const COLLATERAL_TYPES: { value: CollateralType; label: string }[] = [
  { value: 'TITLE_DEED',         label: 'Title Deed' },
  { value: 'MOTOR_VEHICLE',      label: 'Motor Vehicle' },
  { value: 'CHATTEL',            label: 'Chattel / Moveable Property' },
  { value: 'LIVESTOCK',          label: 'Livestock' },
  { value: 'CROP_LIEN',          label: 'Crop Lien' },
  { value: 'SALARY_ASSIGNMENT',  label: 'Salary Assignment' },
  { value: 'GROUP_GUARANTEE',    label: 'Group Guarantee' },
  { value: 'PERSONAL_GUARANTEE', label: 'Personal Guarantee' },
  { value: 'SAVINGS_DEPOSIT',    label: 'Savings Deposit' },
  { value: 'OTHER',              label: 'Other' },
];

const SHOCK_TYPES = [
  'Drought / crop failure', 'Illness / medical emergency', 'Livestock loss / disease',
  'Death in family', 'Job loss', 'Flood / natural disaster', 'Business loss', 'Other',
];

const STEPS = [
  'Loan Type & Product',
  'Purpose & Amount',
  'Cash Flow',
  'Resilience',
  'Collateral',
  'Review & Submit',
];

// ── State type ────────────────────────────────────────────────────────────────

interface FormState {
  // Step 0
  loanType:    'INDIVIDUAL' | 'GROUP';
  productId:   'SHORT_TERM' | 'LONG_TERM';
  loanGroupId: string;

  // Step 1
  purposeCategory:   string;
  purposeOfLoan:     string;
  requestedAmountKes: number;
  repaymentMethod:   'MPESA' | 'BANK_TRANSFER' | 'CASH';

  // Step 2
  monthlyIncomeSnapshot:   number | '';
  monthlyExpensesSnapshot: number | '';

  // Step 3
  hadShockPastYear:     boolean | null;
  shockType:            string;
  copingMechanism:      string;
  hasSavingsBuffer:     boolean | null;
  savingsBufferMonths:  number | '';
  hasAlternativeIncome: boolean | null;

  // Step 4
  collateral: Array<{
    collateralType:    CollateralType;
    description:       string;
    estimatedValueKes: number | '';
  }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `KES ${n.toLocaleString()}`;
}

function monthlyInstalment(principal: number, annualRatePct: number, termMonths: number): number {
  const monthly = annualRatePct / 100 / 12;
  if (monthly === 0) return principal / termMonths;
  return (principal * monthly * Math.pow(1 + monthly, termMonths)) /
         (Math.pow(1 + monthly, termMonths) - 1);
}

// ── Step 0 ────────────────────────────────────────────────────────────────────

function Step0({
  form, setForm, customer, groups,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  customer: Customer;
  groups: LoanGroup[];
}) {
  const selectedProduct = LOAN_PRODUCTS.find(p => p.id === form.productId)!;
  const scoreRec = customer.creditScores?.[0];
  const maxByScore = scoreRec?.maxLoanAmountKes ?? selectedProduct.maxKes;

  return (
    <div className="space-y-6">
      {/* Loan type toggle */}
      <div>
        <label className="label">Loan Type</label>
        <div className="grid grid-cols-2 gap-3">
          {([
            { value: 'INDIVIDUAL', label: 'Individual Loan', icon: User, desc: 'Loan for this customer only' },
            { value: 'GROUP',      label: 'Group Loan',      icon: Users, desc: 'Solidarity/joint liability group' },
          ] as const).map(({ value, label, icon: Icon, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => setForm(f => ({ ...f, loanType: value, loanGroupId: '' }))}
              className={clsx(
                'flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all',
                form.loanType === value
                  ? 'border-primary-600 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300',
              )}
            >
              <div className={clsx(
                'flex h-9 w-9 items-center justify-center rounded-full flex-shrink-0',
                form.loanType === value ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-500',
              )}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">{label}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Group selector */}
      {form.loanType === 'GROUP' && (
        <div>
          <label className="label">Select Group *</label>
          {groups.length === 0 ? (
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-700 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              No active groups found. Create a group first, then add this customer as a member.
            </div>
          ) : (
            <select
              className="input"
              value={form.loanGroupId}
              onChange={e => setForm(f => ({ ...f, loanGroupId: e.target.value }))}
            >
              <option value="">— Select group —</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.activeMembers ?? 0} members)
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Product selection */}
      <div>
        <label className="label">Loan Product *</label>
        <div className="grid grid-cols-1 gap-3">
          {LOAN_PRODUCTS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setForm(f => ({
                ...f,
                productId: p.id,
                requestedAmountKes: Math.min(f.requestedAmountKes || p.minKes, Math.min(p.maxKes, maxByScore)),
              }))}
              className={clsx(
                'flex items-start gap-4 rounded-xl border-2 p-4 text-left transition-all',
                form.productId === p.id
                  ? 'border-primary-600 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300',
              )}
            >
              <div className={clsx(
                'w-3 h-3 rounded-full mt-1 border-2 flex-shrink-0',
                form.productId === p.id ? 'border-primary-600 bg-primary-600' : 'border-gray-300',
              )} />
              <div>
                <p className="font-semibold text-gray-900">{p.label}</p>
                <p className="text-sm text-gray-500 mt-0.5">{p.desc}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {fmt(p.minKes)} – {fmt(p.maxKes)} · {p.term} months
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Credit score recommendation */}
      {scoreRec && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          <strong>Credit score:</strong> {scoreRec.totalScore}/100 ·{' '}
          Recommended max: <strong>{fmt(scoreRec.maxLoanAmountKes)}</strong> ·{' '}
          Term: {scoreRec.suggestedTermMonths} months
        </div>
      )}

      {/* Term display */}
      <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-600">
        <span className="font-medium">Loan term:</span> {selectedProduct.term} months
      </div>
    </div>
  );
}

// ── Step 1 ────────────────────────────────────────────────────────────────────

function Step1({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  const product = LOAN_PRODUCTS.find(p => p.id === form.productId)!;
  const instalment = useMemo(() => {
    const amount = Number(form.requestedAmountKes) || 0;
    return amount > 0 ? monthlyInstalment(amount, 18, product.term) : 0;
  }, [form.requestedAmountKes, product]);

  return (
    <div className="space-y-5">
      <div>
        <label className="label">Purpose Category *</label>
        <select
          className="input"
          value={form.purposeCategory}
          onChange={e => setForm(f => ({ ...f, purposeCategory: e.target.value }))}
        >
          <option value="">— Select category —</option>
          {PURPOSE_CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Purpose Description * <span className="text-gray-400 font-normal">(min 20 chars)</span></label>
        <textarea
          className="input h-24 resize-none"
          placeholder="Describe in detail how the loan will be used…"
          value={form.purposeOfLoan}
          onChange={e => setForm(f => ({ ...f, purposeOfLoan: e.target.value }))}
        />
        <p className="text-xs text-gray-400 mt-1">{form.purposeOfLoan.length} / 500 characters</p>
      </div>

      <div>
        <label className="label">
          Requested Amount (KES) *
          <span className="text-gray-400 font-normal ml-2">
            {fmt(product.minKes)} – {fmt(product.maxKes)}
          </span>
        </label>
        <input
          type="number"
          className="input"
          min={product.minKes}
          max={product.maxKes}
          step={1000}
          value={form.requestedAmountKes || ''}
          onChange={e => setForm(f => ({ ...f, requestedAmountKes: parseFloat(e.target.value) || 0 }))}
        />
        {instalment > 0 && (
          <p className="text-xs text-primary-700 font-medium mt-1">
            Est. monthly repayment: {fmt(Math.round(instalment))} (18% p.a., reducing balance)
          </p>
        )}
      </div>

      <div>
        <label className="label">Repayment Method *</label>
        <div className="grid grid-cols-3 gap-3">
          {(['MPESA', 'BANK_TRANSFER', 'CASH'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setForm(f => ({ ...f, repaymentMethod: m }))}
              className={clsx(
                'rounded-xl border-2 py-3 text-sm font-medium transition-all',
                form.repaymentMethod === m
                  ? 'border-primary-600 bg-primary-50 text-primary-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300',
              )}
            >
              {m === 'MPESA' ? 'M-Pesa' : m === 'BANK_TRANSFER' ? 'Bank' : 'Cash'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Cash Flow ─────────────────────────────────────────────────────────

function Step2({
  form, setForm, customer,
}: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>>; customer: Customer }) {
  const fp = customer.financialProfile;

  const income   = Number(form.monthlyIncomeSnapshot)   || 0;
  const expenses = Number(form.monthlyExpensesSnapshot) || 0;
  const product  = LOAN_PRODUCTS.find(p => p.id === form.productId)!;
  const instalment = useMemo(() => {
    const amount = Number(form.requestedAmountKes) || 0;
    return amount > 0 ? monthlyInstalment(amount, 18, product.term) : 0;
  }, [form.requestedAmountKes, product]);

  const netDisposable = income - expenses;
  const totalDebt = (fp?.otherMonthlyDebt ?? 0) + instalment;
  const dsr = income > 0 ? (totalDebt / income) * 100 : 0;
  const dsrWarning = dsr > 40;

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600">
        Verify the customer's current cash flow. Pre-filled from their financial profile — update if circumstances have changed.
      </p>

      {fp && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700 space-y-0.5">
          <p className="font-semibold mb-1">Baseline from financial profile:</p>
          <p>Farm income: KES {(fp.monthlyFarmIncome + fp.monthlyOffFarmIncome).toLocaleString()}/mo</p>
          <p>Household expenses: KES {fp.monthlyHouseholdExpenses.toLocaleString()}/mo</p>
          <p>Existing debt service: KES {fp.otherMonthlyDebt.toLocaleString()}/mo</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Total Monthly Income (KES) *</label>
          <input
            type="number"
            className="input"
            min={0}
            step={500}
            placeholder={fp ? String(fp.monthlyFarmIncome + fp.monthlyOffFarmIncome) : ''}
            value={form.monthlyIncomeSnapshot === '' ? '' : form.monthlyIncomeSnapshot}
            onChange={e => setForm(f => ({ ...f, monthlyIncomeSnapshot: e.target.value === '' ? '' : parseFloat(e.target.value) }))}
          />
          <p className="text-xs text-gray-400 mt-1">Farm + off-farm combined</p>
        </div>
        <div>
          <label className="label">Monthly Expenses (KES) *</label>
          <input
            type="number"
            className="input"
            min={0}
            step={500}
            placeholder={fp ? String(fp.monthlyHouseholdExpenses) : ''}
            value={form.monthlyExpensesSnapshot === '' ? '' : form.monthlyExpensesSnapshot}
            onChange={e => setForm(f => ({ ...f, monthlyExpensesSnapshot: e.target.value === '' ? '' : parseFloat(e.target.value) }))}
          />
          <p className="text-xs text-gray-400 mt-1">Household + business expenses</p>
        </div>
      </div>

      {/* Live DSR calculation */}
      {income > 0 && (
        <div className={clsx(
          'rounded-xl border px-5 py-4 space-y-2',
          dsrWarning ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50',
        )}>
          <p className={clsx('text-sm font-semibold', dsrWarning ? 'text-red-800' : 'text-green-800')}>
            Cash Flow Analysis
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <span className="text-gray-600">Net Disposable Income:</span>
            <span className={clsx('font-medium', netDisposable < 0 ? 'text-red-700' : 'text-gray-900')}>
              {fmt(Math.round(netDisposable))} / mo
            </span>
            {instalment > 0 && (
              <>
                <span className="text-gray-600">This Loan Instalment:</span>
                <span className="font-medium text-gray-900">{fmt(Math.round(instalment))} / mo</span>
                <span className="text-gray-600">Total Debt Service Ratio:</span>
                <span className={clsx('font-semibold', dsrWarning ? 'text-red-700' : 'text-green-700')}>
                  {dsr.toFixed(1)}%
                </span>
              </>
            )}
          </div>
          {dsrWarning && (
            <p className="text-xs text-red-700 flex items-center gap-1 mt-1">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              DSR exceeds 40% — requires supervisor review
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Step 3: Resilience ────────────────────────────────────────────────────────

function Step3({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Assess household resilience to understand repayment capacity under stress conditions.
      </p>

      {/* Shock */}
      <div>
        <label className="label font-medium">
          Has the household experienced a significant financial shock in the past 12 months?
        </label>
        <div className="flex gap-3 mt-1">
          {[
            { v: true,  l: 'Yes' },
            { v: false, l: 'No' },
          ].map(({ v, l }) => (
            <button
              key={l}
              type="button"
              onClick={() => setForm(f => ({ ...f, hadShockPastYear: v, shockType: v ? f.shockType : '', copingMechanism: v ? f.copingMechanism : '' }))}
              className={clsx(
                'flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all',
                form.hadShockPastYear === v
                  ? 'border-primary-600 bg-primary-50 text-primary-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300',
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {form.hadShockPastYear === true && (
        <div className="pl-4 border-l-2 border-primary-200 space-y-4">
          <div>
            <label className="label">Type of Shock</label>
            <select
              className="input"
              value={form.shockType}
              onChange={e => setForm(f => ({ ...f, shockType: e.target.value }))}
            >
              <option value="">— Select —</option>
              {SHOCK_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">How did the household cope?</label>
            <input
              className="input"
              placeholder="e.g. Used savings, borrowed from family, sold livestock…"
              value={form.copingMechanism}
              onChange={e => setForm(f => ({ ...f, copingMechanism: e.target.value }))}
            />
          </div>
        </div>
      )}

      {/* Savings buffer */}
      <div>
        <label className="label font-medium">
          Does the household have savings to cover at least 1 month of expenses?
        </label>
        <div className="flex gap-3 mt-1">
          {[
            { v: true,  l: 'Yes' },
            { v: false, l: 'No' },
          ].map(({ v, l }) => (
            <button
              key={l}
              type="button"
              onClick={() => setForm(f => ({ ...f, hasSavingsBuffer: v, savingsBufferMonths: v ? f.savingsBufferMonths : '' }))}
              className={clsx(
                'flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all',
                form.hasSavingsBuffer === v
                  ? 'border-primary-600 bg-primary-50 text-primary-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300',
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {form.hasSavingsBuffer === true && (
        <div className="pl-4 border-l-2 border-primary-200">
          <label className="label">Approx. months of savings coverage</label>
          <input
            type="number"
            className="input w-32"
            min={1}
            max={60}
            placeholder="e.g. 3"
            value={form.savingsBufferMonths === '' ? '' : form.savingsBufferMonths}
            onChange={e => setForm(f => ({ ...f, savingsBufferMonths: e.target.value === '' ? '' : parseInt(e.target.value) }))}
          />
        </div>
      )}

      {/* Alternative income */}
      <div>
        <label className="label font-medium">
          Does the household have alternative income sources if primary income fails?
        </label>
        <div className="flex gap-3 mt-1">
          {[
            { v: true,  l: 'Yes' },
            { v: false, l: 'No' },
          ].map(({ v, l }) => (
            <button
              key={l}
              type="button"
              onClick={() => setForm(f => ({ ...f, hasAlternativeIncome: v }))}
              className={clsx(
                'flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all',
                form.hasAlternativeIncome === v
                  ? 'border-primary-600 bg-primary-50 text-primary-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300',
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Step 4: Collateral ────────────────────────────────────────────────────────

function Step4({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  const addItem = () => {
    if (form.collateral.length >= 5) return;
    setForm(f => ({
      ...f,
      collateral: [
        ...f.collateral,
        { collateralType: 'OTHER', description: '', estimatedValueKes: '' },
      ],
    }));
  };

  const updateItem = (idx: number, patch: Partial<typeof form.collateral[0]>) => {
    setForm(f => ({
      ...f,
      collateral: f.collateral.map((c, i) => i === idx ? { ...c, ...patch } : c),
    }));
  };

  const removeItem = (idx: number) => {
    setForm(f => ({ ...f, collateral: f.collateral.filter((_, i) => i !== idx) }));
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600">
        Record any collateral offered to secure the loan. Group loans automatically include the group guarantee. Up to 5 items.
      </p>

      {form.collateral.map((item, idx) => (
        <div key={idx} className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Collateral Item {idx + 1}</p>
            {/* Don't allow removing auto-added GROUP_GUARANTEE */}
            {!(item.collateralType === 'GROUP_GUARANTEE' && form.loanType === 'GROUP') && (
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="text-red-400 hover:text-red-600 p-1"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select
                className="input"
                value={item.collateralType}
                disabled={item.collateralType === 'GROUP_GUARANTEE' && form.loanType === 'GROUP'}
                onChange={e => updateItem(idx, { collateralType: e.target.value as CollateralType })}
              >
                {COLLATERAL_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Estimated Value (KES)</label>
              <input
                type="number"
                className="input"
                min={0}
                step={1000}
                placeholder="0"
                value={item.estimatedValueKes === '' ? '' : item.estimatedValueKes}
                disabled={item.collateralType === 'GROUP_GUARANTEE' && form.loanType === 'GROUP'}
                onChange={e => updateItem(idx, { estimatedValueKes: e.target.value === '' ? '' : parseFloat(e.target.value) })}
              />
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <input
              className="input"
              placeholder="Describe the collateral…"
              value={item.description}
              disabled={item.collateralType === 'GROUP_GUARANTEE' && form.loanType === 'GROUP'}
              onChange={e => updateItem(idx, { description: e.target.value })}
            />
          </div>
        </div>
      ))}

      {form.collateral.length < 5 && (
        <button
          type="button"
          onClick={addItem}
          className="w-full border-2 border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 flex items-center justify-center gap-2 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Collateral Item
        </button>
      )}

      {form.collateral.length === 0 && (
        <p className="text-xs text-gray-400 text-center">
          No collateral added. You may proceed without collateral.
        </p>
      )}
    </div>
  );
}

// ── Step 5: Review ────────────────────────────────────────────────────────────

function Step5({
  form, customer, groups, error,
}: {
  form: FormState;
  customer: Customer;
  groups: LoanGroup[];
  error: string | null;
}) {
  const product = LOAN_PRODUCTS.find(p => p.id === form.productId)!;
  const instalment = useMemo(() => monthlyInstalment(form.requestedAmountKes, 18, product.term), [form.requestedAmountKes, product]);
  const group = groups.find(g => g.id === form.loanGroupId);
  const purposeLabel = PURPOSE_CATEGORIES.find(c => c.value === form.purposeCategory)?.label;
  const totalRepayable = Math.round(instalment * product.term);
  const totalInterest  = totalRepayable - form.requestedAmountKes;

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="rounded-xl bg-primary-50 border border-primary-200 px-5 py-4">
        <p className="text-sm font-semibold text-primary-800 mb-3">Application Summary</p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <dt className="text-gray-500">Customer</dt>
          <dd className="font-medium">{customer.firstName} {customer.lastName}</dd>
          <dt className="text-gray-500">Loan Type</dt>
          <dd>{form.loanType === 'GROUP' ? `Group — ${group?.name ?? '?'}` : 'Individual'}</dd>
          <dt className="text-gray-500">Product</dt>
          <dd>{product.label}</dd>
          <dt className="text-gray-500">Amount</dt>
          <dd className="font-semibold text-primary-700">{fmt(form.requestedAmountKes)}</dd>
          <dt className="text-gray-500">Term</dt>
          <dd>{product.term} months</dd>
          <dt className="text-gray-500">Interest Rate</dt>
          <dd>18% p.a. (reducing balance)</dd>
          <dt className="text-gray-500">Est. Monthly Payment</dt>
          <dd className="font-medium">{fmt(Math.round(instalment))}</dd>
          <dt className="text-gray-500">Total Interest Cost</dt>
          <dd className="text-orange-700 font-medium">{fmt(Math.round(totalInterest))}</dd>
          <dt className="text-gray-500">Total Repayable</dt>
          <dd className="font-semibold text-gray-900">{fmt(totalRepayable)}</dd>
          <dt className="text-gray-500">Repayment Method</dt>
          <dd>{form.repaymentMethod === 'MPESA' ? 'M-Pesa' : form.repaymentMethod === 'BANK_TRANSFER' ? 'Bank Transfer' : 'Cash'}</dd>
          <dt className="text-gray-500">Purpose</dt>
          <dd>{purposeLabel ?? form.purposeCategory}</dd>
        </dl>
      </div>

      {/* Amortisation schedule */}
      <div className="card p-4">
        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-3">Repayment Schedule</p>
        <AmortisationTable
          principal={form.requestedAmountKes}
          annualRatePct={18}
          termMonths={product.term}
          compact={product.term > 4}
        />
      </div>

      {/* Purpose description */}
      <div className="card p-4">
        <p className="text-xs text-gray-500 mb-1">Purpose Description</p>
        <p className="text-sm text-gray-800">{form.purposeOfLoan}</p>
      </div>

      {/* Resilience summary */}
      <div className="card p-4 text-sm space-y-1">
        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">Resilience</p>
        <p>Financial shock: <span className="font-medium">{form.hadShockPastYear === true ? `Yes — ${form.shockType}` : form.hadShockPastYear === false ? 'No' : 'Not answered'}</span></p>
        <p>Savings buffer: <span className="font-medium">{form.hasSavingsBuffer === true ? `Yes, ${form.savingsBufferMonths} months` : form.hasSavingsBuffer === false ? 'No' : 'Not answered'}</span></p>
        <p>Alternative income: <span className="font-medium">{form.hasAlternativeIncome === true ? 'Yes' : form.hasAlternativeIncome === false ? 'No' : 'Not answered'}</span></p>
      </div>

      {/* Collateral */}
      {form.collateral.length > 0 && (
        <div className="card p-4 text-sm">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">Collateral</p>
          <ul className="space-y-1">
            {form.collateral.map((c, i) => (
              <li key={i} className="flex items-center justify-between">
                <span className="text-gray-700">
                  {COLLATERAL_TYPES.find(t => t.value === c.collateralType)?.label} — {c.description}
                </span>
                <span className="text-gray-500">{fmt(Number(c.estimatedValueKes) || 0)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Main Wizard Component ─────────────────────────────────────────────────────

export default function LoanApplicationForm() {
  const { id: customerId } = useParams<{ id: string }>();
  const { state }  = useLocation();
  const navigate   = useNavigate();
  const qc         = useQueryClient();

  const [step,  setStep]  = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    loanType:    'INDIVIDUAL',
    productId:   'SHORT_TERM',
    loanGroupId: '',

    purposeCategory:   '',
    purposeOfLoan:     '',
    requestedAmountKes: state?.maxAmount ?? 20_000,
    repaymentMethod:   'MPESA',

    monthlyIncomeSnapshot:   '',
    monthlyExpensesSnapshot: '',

    hadShockPastYear:     null,
    shockType:            '',
    copingMechanism:      '',
    hasSavingsBuffer:     null,
    savingsBufferMonths:  '',
    hasAlternativeIncome: null,

    collateral: [],
  });

  // Load customer
  const { data: customer, isLoading: loadingCustomer } = useQuery<Customer>({
    queryKey: ['customer', customerId],
    queryFn:  () => customerApi.get(customerId!),
    enabled:  !!customerId,
  });

  // Check for completed interview (gate)
  const { data: interviews, isLoading: loadingInterviews } = useQuery<CustomerInterview[]>({
    queryKey: ['interviews', customerId],
    queryFn:  () => interviewApi.list(customerId!),
    enabled:  !!customerId,
  });
  const hasCompletedInterview = interviews?.some(i => i.status === 'COMPLETED') ?? false;

  // Load LO's active groups (for group loan selection)
  const { data: groupsData } = useQuery({
    queryKey: ['groups', 'ACTIVE'],
    queryFn:  () => groupApi.list({ status: 'ACTIVE', limit: 100 }),
    staleTime: 60_000,
  });
  const groups: LoanGroup[] = groupsData?.data ?? [];

  // Pre-populate cash flow from financial profile when customer loads
  const [cashFlowPrepopulated, setCashFlowPrepopulated] = useState(false);
  if (customer?.financialProfile && !cashFlowPrepopulated) {
    const fp = customer.financialProfile;
    setForm(f => ({
      ...f,
      monthlyIncomeSnapshot:   fp.monthlyFarmIncome + fp.monthlyOffFarmIncome,
      monthlyExpensesSnapshot: fp.monthlyHouseholdExpenses,
    }));
    setCashFlowPrepopulated(true);
  }

  const submitMutation = useMutation({
    mutationFn: () => {
      const product = LOAN_PRODUCTS.find(p => p.id === form.productId)!;
      const collateralPayload = form.collateral.map(c => ({
        collateralType:    c.collateralType,
        description:       c.description,
        estimatedValueKes: Number(c.estimatedValueKes) || 0,
      }));

      return loanApi.apply({
        customerId,
        creditScoreId:           state?.creditScoreId,
        loanType:                form.loanType,
        loanGroupId:             form.loanType === 'GROUP' ? form.loanGroupId : undefined,
        purposeCategory:         form.purposeCategory,
        purposeOfLoan:           form.purposeOfLoan,
        requestedAmountKes:      form.requestedAmountKes,
        termMonths:              product.term,
        repaymentMethod:         form.repaymentMethod,
        monthlyIncomeSnapshot:   Number(form.monthlyIncomeSnapshot) || undefined,
        monthlyExpensesSnapshot: Number(form.monthlyExpensesSnapshot) || undefined,
        hadShockPastYear:        form.hadShockPastYear ?? undefined,
        shockType:               form.shockType || undefined,
        copingMechanism:         form.copingMechanism || undefined,
        hasSavingsBuffer:        form.hasSavingsBuffer ?? undefined,
        savingsBufferMonths:     Number(form.savingsBufferMonths) || undefined,
        hasAlternativeIncome:    form.hasAlternativeIncome ?? undefined,
        collateral:              collateralPayload,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['applications'] });
      navigate('/loans');
    },
    onError:   (err) => { setError(getErrorMessage(err)); },
  });

  // ── Step validation ────────────────────────────────────────────────────────
  const stepError = (): string | null => {
    if (step === 0) {
      if (form.loanType === 'GROUP' && !form.loanGroupId) return 'Please select a group';
    }
    if (step === 1) {
      if (!form.purposeCategory) return 'Please select a purpose category';
      if (form.purposeOfLoan.length < 20) return 'Purpose description must be at least 20 characters';
      const product = LOAN_PRODUCTS.find(p => p.id === form.productId)!;
      if (form.requestedAmountKes < product.minKes || form.requestedAmountKes > product.maxKes) {
        return `Amount must be between ${fmt(product.minKes)} and ${fmt(product.maxKes)}`;
      }
    }
    return null;
  };

  const handleNext = () => {
    const err = stepError();
    if (err) { setError(err); return; }
    setError(null);
    if (step === STEPS.length - 1) {
      submitMutation.mutate();
    } else {
      // Auto-add GROUP_GUARANTEE when entering step 4
      if (step === 3 && form.loanType === 'GROUP') {
        const hasGuarantee = form.collateral.some(c => c.collateralType === 'GROUP_GUARANTEE');
        if (!hasGuarantee) {
          setForm(f => ({
            ...f,
            collateral: [
              { collateralType: 'GROUP_GUARANTEE', description: 'Joint liability group guarantee', estimatedValueKes: 0 },
              ...f.collateral,
            ],
          }));
        }
      }
      setStep(s => s + 1);
    }
  };

  if (loadingCustomer || loadingInterviews || !customer) return <LoadingSpinner />;

  // ── Journey gate requirements ───────────────────────────────────────────────
  const kycVerified = customer.kycStatus === 'VERIFIED';
  const amlBlocked  = customer.amlStatus === 'BLOCKED';

  const gateRequirements: GateRequirement[] = [
    {
      label:       'KYC Verification',
      description: 'The customer\'s identity and documents must be verified before a loan can be applied for.',
      actionLabel: 'Go to Customer Profile',
      actionTo:    `/customers/${customerId}`,
      completed:   kycVerified,
    },
    {
      label:       'Completed Field Interview',
      description: 'A loan officer must conduct and complete a field interview with this customer before applying.',
      actionLabel: 'Start Interview',
      actionTo:    `/customers/${customerId}/interview`,
      completed:   hasCompletedInterview,
    },
    ...(amlBlocked ? [{
      label:       'AML Clearance Required',
      description: 'This customer is AML-blocked. All loan activities are suspended. Contact the Compliance team.',
      actionLabel: 'Contact Compliance',
      actionTo:    `/customers/${customerId}`,
      completed:   false,
    }] : []),
  ];

  const journeySteps = buildJourneySteps({
    kycVerified,
    interviewCompleted: hasCompletedInterview,
    applicationStatus: undefined,
    disbursed: false,
    hasRepayments: false,
  });

  return (
    <JourneyGate
      title="Loan Application"
      requirements={gateRequirements}
      journeySteps={journeySteps}
    >
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-secondary p-2">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="page-title">Loan Application</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {customer.firstName} {customer.lastName} · {customer.village}, {customer.county}
            </p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="card p-4 mb-6">
        <div className="flex items-center gap-1">
          {STEPS.map((_label, i) => (
            <div key={i} className="flex items-center flex-1 min-w-0">
              <div className={clsx(
                'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold flex-shrink-0 transition-colors',
                i < step  ? 'bg-green-500 text-white' :
                i === step ? 'bg-primary-600 text-white' :
                             'bg-gray-200 text-gray-500',
              )}>
                {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={clsx('flex-1 h-1 mx-1 rounded', i < step ? 'bg-green-400' : 'bg-gray-200')} />
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Step {step + 1} of {STEPS.length}: <span className="font-medium text-gray-700">{STEPS[step]}</span>
        </p>
      </div>

      {/* Step content */}
      <div className="card p-6 mb-6">
        {step === 0 && <Step0 form={form} setForm={setForm} customer={customer} groups={groups} />}
        {step === 1 && <Step1 form={form} setForm={setForm} />}
        {step === 2 && <Step2 form={form} setForm={setForm} customer={customer} />}
        {step === 3 && <Step3 form={form} setForm={setForm} />}
        {step === 4 && <Step4 form={form} setForm={setForm} />}
        {step === 5 && <Step5 form={form} customer={customer} groups={groups} error={error} />}

        {/* Inline error (steps 0-4) */}
        {error && step < 5 && (
          <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => { setError(null); setStep(s => s - 1); }}
          disabled={step === 0}
          className="btn-secondary disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={submitMutation.isPending}
          className="btn-primary"
        >
          {step === STEPS.length - 1 ? (
            submitMutation.isPending ? 'Submitting…' : (
              <><CreditCard className="h-4 w-4" /> Submit Application</>
            )
          ) : (
            <>Next <ChevronRight className="h-4 w-4" /></>
          )}
        </button>
      </div>
    </div>
    </JourneyGate>
  );
}
