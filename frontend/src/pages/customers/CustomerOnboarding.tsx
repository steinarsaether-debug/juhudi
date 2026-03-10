import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ChevronRight, ChevronLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { customerApi, api, qualityApi, groupApi } from '../../services/api';
import { getErrorMessage } from '../../services/api';
import { KENYA_COUNTIES } from './constants';
import DuplicateWarning from '../../components/common/DuplicateWarning';
import { NameDuplicateMatch } from '../../types';

const STEPS = ['Personal Info', 'Location & KoK', 'Farm Profile', 'Financial Info', 'Consent & Submit'];

interface OnboardingForm {
  // Step 1 - Personal
  firstName: string; lastName: string; nationalId: string;
  phone: string; alternatePhone?: string; dateOfBirth: string;
  gender: string; maritalStatus: string; numberOfDependents: number;
  yaraCustomerId?: string; yaraRegion?: string;
  // Step 2 - Location + Next of Kin
  county: string; subCounty: string; ward?: string;
  village: string; physicalAddress?: string;
  gpsLatitude?: number; gpsLongitude?: number;
  nextOfKinName: string; nextOfKinPhone: string;
  nextOfKinRelation: string; nextOfKinNationalId?: string;
  isPEP: boolean; pepDetails?: string;
  branchId: string;
  // Step 3 - Farm
  farmSizeAcres: number; landOwnership: string;
  primaryCrop: string; secondaryCrops: string;
  irrigationType: string; hasGreenhouse: boolean;
  marketAccess: string; distanceToMarketKm?: number;
  yaraMemberSince?: string; yaraProductsUsed: string;
  annualInputCostKes?: number; hasStorageFacility: boolean;
  hasElectricity: boolean; hasPipedWater: boolean;
  livestockCount: number;
  // Step 4 - Financial
  monthlyFarmIncome: number; monthlyOffFarmIncome: number;
  monthlyHouseholdExpenses: number; otherMonthlyDebt: number;
  hasMpesa: boolean; mpesaMonthlyAvgKes?: number;
  hasBankAccount: boolean; bankName?: string;
  hasGroupMembership: boolean; groupName?: string;
  groupType?: string; groupMonthlySavingsKes?: number;
  crbStatus: string; previousLoansCount: number;
  previousLoansRepaidOnTime?: boolean;
  // Step 5 - Consent
  dataConsentGiven: boolean;
  // Optional group assignment (done post-creation)
  loanGroupId?: string;
}

export default function CustomerOnboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [duplicateMatches, setDuplicateMatches] = useState<NameDuplicateMatch[]>([]);
  const dupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get('/branches').then(r => r.data),
  });
  const branches = branchesData ?? [];

  const { data: groupsData } = useQuery({
    queryKey: ['groups', { limit: 100 }],
    queryFn: () => groupApi.list({ limit: 100, status: 'ACTIVE' }),
  });
  const groups: Array<{ id: string; name: string; branchId: string }> = groupsData?.data ?? [];

  const { register, handleSubmit, watch, formState: { errors } } = useForm<OnboardingForm>({
    defaultValues: {
      numberOfDependents: 0, hasGreenhouse: false, hasStorageFacility: false,
      hasElectricity: false, hasPipedWater: false, hasMpesa: true,
      hasBankAccount: false, hasGroupMembership: false, livestockCount: 0,
      previousLoansCount: 0, otherMonthlyDebt: 0, monthlyOffFarmIncome: 0,
      isPEP: false, dataConsentGiven: false, crbStatus: 'UNKNOWN',
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: OnboardingForm) => {
      // Helper: turn blank strings and NaN numbers into undefined so Zod
      // optional/regex validators don't reject them on the backend.
      const str = (v?: string) => (v && v.trim() !== '' ? v.trim() : undefined);
      const num = (v?: number) => (v !== undefined && !isNaN(v) && v > 0 ? v : undefined);

      const payload = {
        // Core personal fields
        firstName:           data.firstName,
        lastName:            data.lastName,
        nationalId:          data.nationalId,
        phone:               data.phone,
        alternatePhone:      str(data.alternatePhone),     // blank → undefined
        dateOfBirth:         new Date(data.dateOfBirth).toISOString(),
        gender:              data.gender,
        maritalStatus:       data.maritalStatus,
        numberOfDependents:  data.numberOfDependents,

        // Optional Yara
        yaraCustomerId:      str(data.yaraCustomerId),
        yaraRegion:          str(data.yaraRegion),

        // Location
        county:              data.county,
        subCounty:           data.subCounty,
        ward:                str(data.ward),
        village:             data.village,
        physicalAddress:     str(data.physicalAddress),
        gpsLatitude:         num(data.gpsLatitude),
        gpsLongitude:        num(data.gpsLongitude),

        // Next of kin
        nextOfKinName:       data.nextOfKinName,
        nextOfKinPhone:      data.nextOfKinPhone,
        nextOfKinRelation:   data.nextOfKinRelation,
        nextOfKinNationalId: str(data.nextOfKinNationalId),  // blank → undefined

        // PEP
        isPEP:               data.isPEP,
        pepDetails:          str(data.pepDetails),

        // KDPA
        dataConsentGiven:    data.dataConsentGiven,

        // Branch
        branchId:            data.branchId,

        // Farm profile (nested)
        farmProfile: {
          farmSizeAcres:      data.farmSizeAcres,
          landOwnership:      data.landOwnership,
          primaryCrop:        data.primaryCrop,
          secondaryCrops:     data.secondaryCrops
            ? data.secondaryCrops.split(',').map(s => s.trim()).filter(Boolean)
            : [],
          irrigationType:     data.irrigationType,
          hasGreenhouse:      data.hasGreenhouse,
          marketAccess:       data.marketAccess,
          distanceToMarketKm: num(data.distanceToMarketKm),
          yaraMemberSince:    data.yaraMemberSince
            ? new Date(data.yaraMemberSince).toISOString()
            : undefined,
          yaraProductsUsed:   data.yaraProductsUsed
            ? data.yaraProductsUsed.split(',').map(s => s.trim()).filter(Boolean)
            : [],
          annualInputCostKes: num(data.annualInputCostKes),
          hasStorageFacility: data.hasStorageFacility,
          hasElectricity:     data.hasElectricity,
          hasPipedWater:      data.hasPipedWater,
          livestockCount:     data.livestockCount,
          livestockType:      [],  // not captured in form yet; default to empty
        },

        // Financial profile (nested)
        financialProfile: {
          monthlyFarmIncome:          data.monthlyFarmIncome,
          monthlyOffFarmIncome:       data.monthlyOffFarmIncome,
          monthlyHouseholdExpenses:   data.monthlyHouseholdExpenses,
          otherMonthlyDebt:           data.otherMonthlyDebt,
          hasMpesa:                   data.hasMpesa,
          mpesaMonthlyAvgKes:         num(data.mpesaMonthlyAvgKes),
          hasBankAccount:             data.hasBankAccount,
          bankName:                   str(data.bankName),
          hasGroupMembership:         data.hasGroupMembership,
          groupName:                  str(data.groupName),
          groupType:                  str(data.groupType),
          groupMonthlySavingsKes:     num(data.groupMonthlySavingsKes),
          crbStatus:                  data.crbStatus,
          previousLoansCount:         data.previousLoansCount,
          previousLoansRepaidOnTime:  data.previousLoansRepaidOnTime ?? undefined,
        },
      };
      const customer = await customerApi.create(payload);

      // If a loan group was selected, add the new customer as a member
      if (data.loanGroupId) {
        try {
          await groupApi.addMember(data.loanGroupId, { customerId: customer.id });
        } catch {
          // Group assignment failure should not block navigation — customer was created
          console.warn('Group assignment failed after customer creation');
        }
      }

      return customer;
    },
    onSuccess: (customer) => navigate(`/customers/${customer.id}`),
    onError: (err) => setSubmitError(getErrorMessage(err)),
  });

  // ── Debounced duplicate-name check ──────────────────────────────────────────
  const firstName   = watch('firstName');
  const lastName    = watch('lastName');
  const dateOfBirth = watch('dateOfBirth');
  const branchId    = watch('branchId');

  useEffect(() => {
    if (!firstName || firstName.length < 2 || !lastName || lastName.length < 2) {
      setDuplicateMatches([]);
      return;
    }
    if (dupTimerRef.current) clearTimeout(dupTimerRef.current);
    dupTimerRef.current = setTimeout(async () => {
      try {
        const result = await qualityApi.checkName({
          firstName,
          lastName,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth).toISOString() : undefined,
        });
        setDuplicateMatches(result.matches ?? []);
      } catch {
        // pre-check is best-effort — silently ignore errors
      }
    }, 800);
    return () => { if (dupTimerRef.current) clearTimeout(dupTimerRef.current); };
  }, [firstName, lastName, dateOfBirth]);

  const isLastStep = step === STEPS.length - 1;

  const onSubmit = (data: OnboardingForm) => {
    if (!isLastStep) { setStep(s => s + 1); return; }
    mutation.mutate(data);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="page-header">
        <h1 className="page-title">Onboard New Customer</h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center mb-8">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
              i < step ? 'bg-primary-700 text-white' :
              i === step ? 'bg-primary-100 border-2 border-primary-700 text-primary-700' :
              'bg-gray-100 text-gray-400'
            }`}>
              {i < step ? <CheckCircle className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`ml-2 text-xs hidden sm:block ${i === step ? 'font-semibold text-primary-700' : 'text-gray-400'}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-3 ${i < step ? 'bg-primary-700' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* STEP 0 – Personal Info */}
        {step === 0 && (
          <div className="form-section">
            <h2 className="section-title">Personal Information</h2>

            {/* Real-time duplicate warning */}
            <DuplicateWarning matches={duplicateMatches} branchId={branchId} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">First Name *</label>
                <input className={`input ${errors.firstName ? 'input-error' : ''}`}
                  {...register('firstName', { required: 'Required' })} />
              </div>
              <div>
                <label className="label">Last Name *</label>
                <input className={`input ${errors.lastName ? 'input-error' : ''}`}
                  {...register('lastName', { required: 'Required' })} />
              </div>
              <div>
                <label className="label">National ID Number *</label>
                <input className={`input ${errors.nationalId ? 'input-error' : ''}`}
                  placeholder="e.g. 12345678"
                  {...register('nationalId', {
                    required: 'Required',
                    pattern: { value: /^\d{7,8}$/, message: '7-8 digits' },
                  })} />
                {errors.nationalId && <p className="mt-1 text-xs text-red-600">{errors.nationalId.message}</p>}
              </div>
              <div>
                <label className="label">Date of Birth *</label>
                <input type="date" className={`input ${errors.dateOfBirth ? 'input-error' : ''}`}
                  {...register('dateOfBirth', { required: 'Required' })} />
              </div>
              <div>
                <label className="label">Primary Phone (M-Pesa) *</label>
                <input className={`input ${errors.phone ? 'input-error' : ''}`}
                  placeholder="0712345678"
                  {...register('phone', {
                    required: 'Required',
                    pattern: { value: /^(\+254|0)[17]\d{8}$/, message: 'Invalid Kenyan number' },
                  })} />
                {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>}
              </div>
              <div>
                <label className="label">Alternate Phone</label>
                <input className="input" placeholder="Optional"
                  {...register('alternatePhone')} />
              </div>
              <div>
                <label className="label">Gender *</label>
                <select className="input" {...register('gender', { required: 'Required' })}>
                  <option value="">Select...</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                  <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                </select>
              </div>
              <div>
                <label className="label">Marital Status *</label>
                <select className="input" {...register('maritalStatus', { required: 'Required' })}>
                  <option value="">Select...</option>
                  <option value="SINGLE">Single</option>
                  <option value="MARRIED">Married</option>
                  <option value="DIVORCED">Divorced</option>
                  <option value="WIDOWED">Widowed</option>
                </select>
              </div>
              <div>
                <label className="label">Number of Dependents</label>
                <input type="number" min="0" max="20" className="input"
                  {...register('numberOfDependents', { valueAsNumber: true })} />
              </div>
              <div>
                <label className="label">Yara Customer ID</label>
                <input className="input" placeholder="If existing Yara customer"
                  {...register('yaraCustomerId')} />
              </div>
              <div>
                <label className="label">Yara Region</label>
                <input className="input" placeholder="e.g. Meru Central"
                  {...register('yaraRegion')} />
              </div>
              <div>
                <label className="label">Branch *</label>
                <select className={`input ${errors.branchId ? 'input-error' : ''}`}
                  {...register('branchId', { required: 'Required' })}>
                  <option value="">Select branch...</option>
                  {branches.map((b: { id: string; name: string }) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* STEP 1 – Location & Next of Kin */}
        {step === 1 && (
          <div className="form-section">
            <h2 className="section-title">Location & Next of Kin</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="label">County *</label>
                <select className="input" {...register('county', { required: 'Required' })}>
                  <option value="">Select county...</option>
                  {KENYA_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Sub-County *</label>
                <input className="input" {...register('subCounty', { required: 'Required' })} />
              </div>
              <div>
                <label className="label">Ward</label>
                <input className="input" {...register('ward')} />
              </div>
              <div>
                <label className="label">Village *</label>
                <input className="input" {...register('village', { required: 'Required' })} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Physical Address</label>
                <input className="input" {...register('physicalAddress')} />
              </div>
              <div>
                <label className="label">GPS Latitude</label>
                <input type="number" step="0.000001" className="input" {...register('gpsLatitude', { valueAsNumber: true })} />
              </div>
              <div>
                <label className="label">GPS Longitude</label>
                <input type="number" step="0.000001" className="input" {...register('gpsLongitude', { valueAsNumber: true })} />
              </div>
            </div>

            <h3 className="font-semibold text-gray-700 mb-3 border-t pt-4">Next of Kin (Mandatory)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Full Name *</label>
                <input className={`input ${errors.nextOfKinName ? 'input-error' : ''}`}
                  {...register('nextOfKinName', { required: 'Required' })} />
              </div>
              <div>
                <label className="label">Phone *</label>
                <input className={`input ${errors.nextOfKinPhone ? 'input-error' : ''}`}
                  {...register('nextOfKinPhone', {
                    required: 'Required',
                    pattern: { value: /^(\+254|0)[17]\d{8}$/, message: 'Invalid number' },
                  })} />
              </div>
              <div>
                <label className="label">Relationship *</label>
                <input className="input" placeholder="e.g. Spouse, Child, Parent"
                  {...register('nextOfKinRelation', { required: 'Required' })} />
              </div>
              <div>
                <label className="label">National ID</label>
                <input className="input" {...register('nextOfKinNationalId')} />
              </div>
            </div>

            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" className="mt-0.5" {...register('isPEP')} />
                <span className="text-sm text-yellow-800">
                  <strong>PEP Declaration:</strong> Customer is a Politically Exposed Person (current or former senior public official, or close associate/family member of such person)
                </span>
              </label>
              {watch('isPEP') && (
                <div className="mt-3">
                  <label className="label">PEP Details (required if checked)</label>
                  <input className="input" placeholder="Position held, institution, relationship..."
                    {...register('pepDetails')} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2 – Farm Profile */}
        {step === 2 && (
          <div className="form-section">
            <h2 className="section-title">Farm Profile</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Farm Size (acres) *</label>
                <input type="number" step="0.1" min="0.1" className="input"
                  {...register('farmSizeAcres', { required: 'Required', valueAsNumber: true })} />
              </div>
              <div>
                <label className="label">Land Ownership *</label>
                <select className="input" {...register('landOwnership', { required: 'Required' })}>
                  <option value="">Select...</option>
                  <option value="OWNED">Owned (Title Deed)</option>
                  <option value="LEASED">Leased</option>
                  <option value="COMMUNAL">Communal Land</option>
                  <option value="FAMILY">Family Land</option>
                </select>
              </div>
              <div>
                <label className="label">Primary Crop *</label>
                <input className="input" placeholder="e.g. Maize, Tea, Coffee"
                  {...register('primaryCrop', { required: 'Required' })} />
              </div>
              <div>
                <label className="label">Secondary Crops</label>
                <input className="input" placeholder="Comma-separated: Beans, Vegetables"
                  {...register('secondaryCrops')} />
              </div>
              <div>
                <label className="label">Irrigation Type *</label>
                <select className="input" {...register('irrigationType', { required: 'Required' })}>
                  <option value="">Select...</option>
                  <option value="IRRIGATED">Irrigated</option>
                  <option value="RAIN_FED">Rain-fed Only</option>
                  <option value="MIXED">Mixed</option>
                </select>
              </div>
              <div>
                <label className="label">Market Access *</label>
                <select className="input" {...register('marketAccess', { required: 'Required' })}>
                  <option value="">Select...</option>
                  <option value="CONTRACT">Contract Farming / Formal Offtaker</option>
                  <option value="COOPERATIVE">Through Cooperative</option>
                  <option value="LOCAL_MARKET">Local Market / Broker</option>
                  <option value="SUBSISTENCE">Subsistence Farming</option>
                </select>
              </div>
              <div>
                <label className="label">Distance to Market (km)</label>
                <input type="number" min="0" step="0.5" className="input"
                  {...register('distanceToMarketKm', { valueAsNumber: true })} />
              </div>
              <div>
                <label className="label">Livestock Count</label>
                <input type="number" min="0" className="input"
                  {...register('livestockCount', { valueAsNumber: true })} />
              </div>
              <div>
                <label className="label">Yara Customer Since</label>
                <input type="date" className="input" {...register('yaraMemberSince')} />
              </div>
              <div>
                <label className="label">Yara Products Used</label>
                <input className="input" placeholder="Comma-separated: CAN, NPK, Urea"
                  {...register('yaraProductsUsed')} />
              </div>
              <div>
                <label className="label">Annual Input Cost (KES)</label>
                <input type="number" min="0" className="input"
                  {...register('annualInputCostKes', { valueAsNumber: true })} />
              </div>
              <div className="flex flex-col gap-2 pt-2">
                {[
                  { field: 'hasGreenhouse', label: 'Has Greenhouse' },
                  { field: 'hasStorageFacility', label: 'Has Storage Facility' },
                  { field: 'hasElectricity', label: 'Has Electricity' },
                  { field: 'hasPipedWater', label: 'Has Piped Water' },
                ].map(({ field, label }) => (
                  <label key={field} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" {...register(field as keyof OnboardingForm)} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3 – Financial Info */}
        {step === 3 && (
          <div className="form-section">
            <h2 className="section-title">Financial Information</h2>
            <p className="text-sm text-gray-500 mb-4">All amounts in Kenyan Shillings (KES). Approximate monthly averages.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Monthly Farm Income (KES) *</label>
                <input type="number" min="0" className="input"
                  {...register('monthlyFarmIncome', { required: 'Required', valueAsNumber: true })} />
              </div>
              <div>
                <label className="label">Monthly Off-Farm Income (KES)</label>
                <input type="number" min="0" className="input"
                  {...register('monthlyOffFarmIncome', { valueAsNumber: true })} />
              </div>
              <div>
                <label className="label">Monthly Household Expenses (KES) *</label>
                <input type="number" min="0" className="input"
                  {...register('monthlyHouseholdExpenses', { required: 'Required', valueAsNumber: true })} />
              </div>
              <div>
                <label className="label">Other Monthly Debt Repayments (KES)</label>
                <input type="number" min="0" className="input"
                  {...register('otherMonthlyDebt', { valueAsNumber: true })} />
              </div>
              <div>
                <label className="label">M-Pesa Monthly Transaction Average (KES)</label>
                <input type="number" min="0" className="input"
                  {...register('mpesaMonthlyAvgKes', { valueAsNumber: true })} />
              </div>
              <div>
                <label className="label">CRB Status</label>
                <select className="input" {...register('crbStatus')}>
                  <option value="UNKNOWN">Not yet checked</option>
                  <option value="CLEAR">Clear (no negative listing)</option>
                  <option value="PERFORMING">Active loans, performing</option>
                  <option value="LISTED">Has negative CRB listing</option>
                </select>
              </div>
              <div>
                <label className="label">Number of Previous Loans</label>
                <input type="number" min="0" className="input"
                  {...register('previousLoansCount', { valueAsNumber: true })} />
              </div>
              {watch('previousLoansCount') > 0 && (
                <div>
                  <label className="label">Previous Loans Repaid On Time?</label>
                  <select className="input" {...register('previousLoansRepaidOnTime', { setValueAs: v => v === '' ? undefined : v === 'true' })}>
                    <option value="">Don't know</option>
                    <option value="true">Yes</option>
                    <option value="false">No / Late payments</option>
                  </select>
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" {...register('hasBankAccount')} />
                Has a bank account
              </label>
              {watch('hasBankAccount') && (
                <div>
                  <label className="label">Bank Name</label>
                  <input className="input" {...register('bankName')} />
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" {...register('hasGroupMembership')} />
                Member of a Chama / SACCO / Cooperative
              </label>
              {watch('hasGroupMembership') && (
                <>
                  <div>
                    <label className="label">Group Name</label>
                    <input className="input" {...register('groupName')} />
                  </div>
                  <div>
                    <label className="label">Group Type</label>
                    <input className="input" placeholder="Chama / SACCO / Cooperative"
                      {...register('groupType')} />
                  </div>
                  <div>
                    <label className="label">Monthly Savings (KES)</label>
                    <input type="number" min="0" className="input"
                      {...register('groupMonthlySavingsKes', { valueAsNumber: true })} />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* STEP 4 – Consent */}
        {step === 4 && (
          <div className="form-section">
            <h2 className="section-title">Data Consent & Submission</h2>

            {/* Optional loan group assignment */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-sm font-semibold text-blue-900 mb-1">Loan Group Assignment (Optional)</h3>
              <p className="text-xs text-blue-700 mb-3">
                Assign this customer to an existing loan group during onboarding. You can also do this later from the Groups page.
              </p>
              <select className="input bg-white" {...register('loanGroupId')}>
                <option value="">No group — assign individually</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 space-y-2 mb-6 border border-gray-200">
              <p className="font-semibold">Kenya Data Protection Act 2019 – Consent Notice</p>
              <p>Juhudi Kilimo Ltd will collect and process your personal data for the purpose of assessing and administering agricultural microfinance loans. Your data will be:</p>
              <ul className="list-disc ml-4 space-y-1">
                <li>Stored securely and encrypted</li>
                <li>Shared only with Credit Reference Bureaus (CRBs) and regulatory authorities as required by law</li>
                <li>Retained for a period of 7 years after loan closure, as required by the Banking Act</li>
                <li>Accessible to you upon written request</li>
              </ul>
              <p className="font-medium">You have the right to access, correct, or request deletion of your data (subject to legal retention requirements).</p>
            </div>

            <label className="flex items-start gap-3 cursor-pointer p-4 border rounded-lg hover:bg-gray-50">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-primary-700"
                {...register('dataConsentGiven', { required: 'Customer consent is required before submission' })} />
              <span className="text-sm text-gray-700">
                <strong>I confirm that the customer has been informed of, and consents to, the collection and processing of their personal data as described above.</strong> The customer's verbal consent was obtained and witnessed by me.
              </span>
            </label>
            {errors.dataConsentGiven && (
              <p className="mt-2 text-sm text-red-600">{errors.dataConsentGiven.message}</p>
            )}

            {submitError && (
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                {submitError}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            className="btn-secondary disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          <button type="submit" disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Submitting...
              </>
            ) : isLastStep ? (
              <>Submit Customer</>
            ) : (
              <>Next <ChevronRight className="h-4 w-4" /></>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
