// ─── CustomerEdit ─────────────────────────────────────────────────────────────
// Edit form for an existing customer. Allows updating personal info, location,
// next-of-kin, farm profile and financial profile in a single page.
import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { ChevronLeft, AlertCircle, Save } from 'lucide-react';
import { customerApi, api, getErrorMessage } from '../../services/api';
import { Customer } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { KENYA_COUNTIES } from './constants';

interface EditForm {
  // Personal
  firstName: string;
  lastName: string;
  alternatePhone?: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus: string;
  numberOfDependents: number;
  yaraCustomerId?: string;
  yaraRegion?: string;
  // Location
  county: string;
  subCounty: string;
  ward?: string;
  village: string;
  physicalAddress?: string;
  // Branch
  branchId: string;
  // Next of kin
  nextOfKinName: string;
  nextOfKinPhone: string;
  nextOfKinRelation: string;
  nextOfKinNationalId?: string;
  // PEP
  isPEP: boolean;
  pepDetails?: string;
  // Farm
  farmSizeAcres?: number;
  landOwnership?: string;
  primaryCrop?: string;
  secondaryCrops?: string;
  irrigationType?: string;
  hasGreenhouse: boolean;
  marketAccess?: string;
  distanceToMarketKm?: number;
  hasStorageFacility: boolean;
  hasElectricity: boolean;
  hasPipedWater: boolean;
  livestockCount: number;
  annualInputCostKes?: number;
  // Financial
  monthlyFarmIncome?: number;
  monthlyOffFarmIncome?: number;
  monthlyHouseholdExpenses?: number;
  otherMonthlyDebt?: number;
  hasMpesa: boolean;
  mpesaMonthlyAvgKes?: number;
  hasBankAccount: boolean;
  bankName?: string;
  crbStatus: string;
  previousLoansCount: number;
}

export default function CustomerEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: customer, isLoading } = useQuery<Customer>({
    queryKey: ['customer', id],
    queryFn: () => customerApi.get(id!),
  });

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get('/branches').then(r => r.data),
  });
  const branches = branchesData ?? [];

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<EditForm>();

  // Pre-populate form when customer data loads
  useEffect(() => {
    if (!customer) return;
    const farm = customer.farmProfile;
    const fp = customer.financialProfile;

    reset({
      firstName:             customer.firstName,
      lastName:              customer.lastName,
      alternatePhone:        customer.alternatePhone ?? '',
      dateOfBirth:           customer.dateOfBirth
        ? new Date(customer.dateOfBirth).toISOString().slice(0, 10)
        : '',
      gender:                customer.gender ?? '',
      maritalStatus:         customer.maritalStatus ?? '',
      numberOfDependents:    customer.numberOfDependents ?? 0,
      yaraCustomerId:        customer.yaraCustomerId ?? '',
      yaraRegion:            customer.yaraRegion ?? '',
      county:                customer.county,
      subCounty:             customer.subCounty,
      ward:                  customer.ward ?? '',
      village:               customer.village,
      physicalAddress:       customer.physicalAddress ?? '',
      branchId:              customer.branchId,
      nextOfKinName:         customer.nextOfKinName ?? '',
      nextOfKinPhone:        customer.nextOfKinPhone ?? '',
      nextOfKinRelation:     customer.nextOfKinRelation ?? '',
      nextOfKinNationalId:   customer.nextOfKinNationalId ?? '',
      isPEP:                 customer.isPEP ?? false,
      pepDetails:            customer.pepDetails ?? '',
      // Farm
      farmSizeAcres:         farm?.farmSize ?? undefined,
      landOwnership:         farm?.landOwnership ?? '',
      primaryCrop:           farm?.primaryCrop ?? '',
      secondaryCrops:        farm?.secondaryCrops?.join(', ') ?? '',
      irrigationType:        farm?.irrigationType ?? '',
      hasGreenhouse:         farm?.hasGreenhouse ?? false,
      marketAccess:          farm?.marketAccess ?? '',
      distanceToMarketKm:    farm?.distanceToMarket ?? undefined,
      hasStorageFacility:    farm?.hasStorageFacility ?? false,
      hasElectricity:        farm?.hasElectricity ?? false,
      hasPipedWater:         farm?.hasPipedWater ?? false,
      livestockCount:        farm?.livestockCount ?? 0,
      annualInputCostKes:    farm?.annualInputCostKes ?? undefined,
      // Financial
      monthlyFarmIncome:     fp?.monthlyFarmIncome ?? undefined,
      monthlyOffFarmIncome:  fp?.monthlyOffFarmIncome ?? undefined,
      monthlyHouseholdExpenses: fp?.monthlyHouseholdExpenses ?? undefined,
      otherMonthlyDebt:      fp?.otherMonthlyDebt ?? undefined,
      hasMpesa:              fp?.hasMpesa ?? true,
      mpesaMonthlyAvgKes:    fp?.mpesaMonthlyAvgKes ?? undefined,
      hasBankAccount:        fp?.hasBankAccount ?? false,
      bankName:              fp?.bankName ?? '',
      crbStatus:             fp?.crbStatus ?? 'UNKNOWN',
      previousLoansCount:    fp?.previousLoansCount ?? 0,
    });
  }, [customer, reset]);

  const mutation = useMutation({
    mutationFn: (data: EditForm) => {
      const str = (v?: string) => (v && v.trim() !== '' ? v.trim() : undefined);
      const num = (v?: number) => (v !== undefined && !isNaN(Number(v)) ? Number(v) : undefined);

      return customerApi.update(id!, {
        firstName:           data.firstName,
        lastName:            data.lastName,
        alternatePhone:      str(data.alternatePhone) ?? null,
        dateOfBirth:         data.dateOfBirth ? new Date(data.dateOfBirth).toISOString() : undefined,
        gender:              data.gender || undefined,
        maritalStatus:       data.maritalStatus || undefined,
        numberOfDependents:  Number(data.numberOfDependents),
        yaraCustomerId:      str(data.yaraCustomerId) ?? null,
        yaraRegion:          str(data.yaraRegion) ?? null,
        county:              data.county,
        subCounty:           data.subCounty,
        ward:                str(data.ward) ?? null,
        village:             data.village,
        physicalAddress:     str(data.physicalAddress) ?? null,
        branchId:            data.branchId,
        nextOfKinName:       data.nextOfKinName,
        nextOfKinPhone:      data.nextOfKinPhone,
        nextOfKinRelation:   data.nextOfKinRelation,
        nextOfKinNationalId: str(data.nextOfKinNationalId) ?? null,
        isPEP:               data.isPEP,
        pepDetails:          str(data.pepDetails) ?? null,
        farmProfile: {
          farmSizeAcres:      num(data.farmSizeAcres),
          landOwnership:      data.landOwnership || undefined,
          primaryCrop:        str(data.primaryCrop),
          secondaryCrops:     data.secondaryCrops
            ? data.secondaryCrops.split(',').map(s => s.trim()).filter(Boolean)
            : undefined,
          irrigationType:     data.irrigationType || undefined,
          hasGreenhouse:      data.hasGreenhouse,
          marketAccess:       data.marketAccess || undefined,
          distanceToMarketKm: num(data.distanceToMarketKm),
          hasStorageFacility: data.hasStorageFacility,
          hasElectricity:     data.hasElectricity,
          hasPipedWater:      data.hasPipedWater,
          livestockCount:     Number(data.livestockCount),
          annualInputCostKes: num(data.annualInputCostKes),
        },
        financialProfile: {
          monthlyFarmIncome:         num(data.monthlyFarmIncome),
          monthlyOffFarmIncome:      num(data.monthlyOffFarmIncome) ?? 0,
          monthlyHouseholdExpenses:  num(data.monthlyHouseholdExpenses),
          otherMonthlyDebt:          num(data.otherMonthlyDebt) ?? 0,
          hasMpesa:                  data.hasMpesa,
          mpesaMonthlyAvgKes:        num(data.mpesaMonthlyAvgKes),
          hasBankAccount:            data.hasBankAccount,
          bankName:                  str(data.bankName) ?? null,
          crbStatus:                 data.crbStatus,
          previousLoansCount:        Number(data.previousLoansCount),
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer', id] });
      navigate(`/customers/${id}`);
    },
  });

  if (isLoading) return <LoadingSpinner />;
  if (!customer) return <div className="text-center py-12 text-gray-400">Customer not found</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link to={`/customers/${id}`} className="btn-secondary p-2">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="page-title">Edit Customer</h1>
            <p className="text-sm text-gray-500">{customer.firstName} {customer.lastName}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-6">

        {/* ── Personal Information ── */}
        <div className="form-section">
          <h2 className="section-title">Personal Information</h2>
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
              <label className="label">Date of Birth</label>
              <input type="date" className="input" {...register('dateOfBirth')} />
            </div>
            <div>
              <label className="label">Alternate Phone</label>
              <input className="input" placeholder="Optional"
                {...register('alternatePhone')} />
            </div>
            <div>
              <label className="label">Gender</label>
              <select className="input" {...register('gender')}>
                <option value="">Select...</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
                <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
              </select>
            </div>
            <div>
              <label className="label">Marital Status</label>
              <select className="input" {...register('maritalStatus')}>
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
              <label className="label">Branch</label>
              <select className="input" {...register('branchId')}>
                <option value="">Select branch...</option>
                {branches.map((b: { id: string; name: string }) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Yara Customer ID</label>
              <input className="input" {...register('yaraCustomerId')} />
            </div>
            <div>
              <label className="label">Yara Region</label>
              <input className="input" {...register('yaraRegion')} />
            </div>
          </div>
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" className="mt-0.5" {...register('isPEP')} />
              <span className="text-sm text-yellow-800">
                <strong>PEP Declaration:</strong> Customer is a Politically Exposed Person
              </span>
            </label>
            {watch('isPEP') && (
              <div className="mt-3">
                <label className="label">PEP Details</label>
                <input className="input" {...register('pepDetails')} />
              </div>
            )}
          </div>
        </div>

        {/* ── Location ── */}
        <div className="form-section">
          <h2 className="section-title">Location</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          </div>
        </div>

        {/* ── Next of Kin ── */}
        <div className="form-section">
          <h2 className="section-title">Next of Kin</h2>
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
              {errors.nextOfKinPhone && <p className="mt-1 text-xs text-red-600">{errors.nextOfKinPhone.message}</p>}
            </div>
            <div>
              <label className="label">Relationship *</label>
              <input className="input" {...register('nextOfKinRelation', { required: 'Required' })} />
            </div>
            <div>
              <label className="label">National ID</label>
              <input className="input" {...register('nextOfKinNationalId')} />
            </div>
          </div>
        </div>

        {/* ── Farm Profile ── */}
        <div className="form-section">
          <h2 className="section-title">Farm Profile</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Farm Size (acres)</label>
              <input type="number" step="0.1" min="0.1" className="input"
                {...register('farmSizeAcres', { valueAsNumber: true })} />
            </div>
            <div>
              <label className="label">Land Ownership</label>
              <select className="input" {...register('landOwnership')}>
                <option value="">Select...</option>
                <option value="OWNED">Owned (Title Deed)</option>
                <option value="LEASED">Leased</option>
                <option value="COMMUNAL">Communal Land</option>
                <option value="FAMILY">Family Land</option>
              </select>
            </div>
            <div>
              <label className="label">Primary Crop</label>
              <input className="input" placeholder="e.g. Maize, Tea, Coffee"
                {...register('primaryCrop')} />
            </div>
            <div>
              <label className="label">Secondary Crops</label>
              <input className="input" placeholder="Comma-separated"
                {...register('secondaryCrops')} />
            </div>
            <div>
              <label className="label">Irrigation Type</label>
              <select className="input" {...register('irrigationType')}>
                <option value="">Select...</option>
                <option value="IRRIGATED">Irrigated</option>
                <option value="RAIN_FED">Rain-fed Only</option>
                <option value="MIXED">Mixed</option>
              </select>
            </div>
            <div>
              <label className="label">Market Access</label>
              <select className="input" {...register('marketAccess')}>
                <option value="">Select...</option>
                <option value="CONTRACT">Contract Farming</option>
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
              <label className="label">Annual Input Cost (KES)</label>
              <input type="number" min="0" className="input"
                {...register('annualInputCostKes', { valueAsNumber: true })} />
            </div>
            <div className="flex flex-col gap-2 pt-2">
              {[
                { field: 'hasGreenhouse',      label: 'Has Greenhouse' },
                { field: 'hasStorageFacility', label: 'Has Storage Facility' },
                { field: 'hasElectricity',     label: 'Has Electricity' },
                { field: 'hasPipedWater',      label: 'Has Piped Water' },
              ].map(({ field, label }) => (
                <label key={field} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" {...register(field as keyof EditForm)} />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* ── Financial Profile ── */}
        <div className="form-section">
          <h2 className="section-title">Financial Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Monthly Farm Income (KES)</label>
              <input type="number" min="0" className="input"
                {...register('monthlyFarmIncome', { valueAsNumber: true })} />
            </div>
            <div>
              <label className="label">Monthly Off-Farm Income (KES)</label>
              <input type="number" min="0" className="input"
                {...register('monthlyOffFarmIncome', { valueAsNumber: true })} />
            </div>
            <div>
              <label className="label">Monthly Household Expenses (KES)</label>
              <input type="number" min="0" className="input"
                {...register('monthlyHouseholdExpenses', { valueAsNumber: true })} />
            </div>
            <div>
              <label className="label">Other Monthly Debt (KES)</label>
              <input type="number" min="0" className="input"
                {...register('otherMonthlyDebt', { valueAsNumber: true })} />
            </div>
            <div>
              <label className="label">M-Pesa Monthly Avg (KES)</label>
              <input type="number" min="0" className="input"
                {...register('mpesaMonthlyAvgKes', { valueAsNumber: true })} />
            </div>
            <div>
              <label className="label">CRB Status</label>
              <select className="input" {...register('crbStatus')}>
                <option value="UNKNOWN">Not yet checked</option>
                <option value="CLEAR">Clear</option>
                <option value="PERFORMING">Active loans, performing</option>
                <option value="LISTED">Has negative listing</option>
              </select>
            </div>
            <div>
              <label className="label">Previous Loans Count</label>
              <input type="number" min="0" className="input"
                {...register('previousLoansCount', { valueAsNumber: true })} />
            </div>
            <div className="flex items-center gap-4 pt-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" {...register('hasMpesa')} />
                Has M-Pesa
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" {...register('hasBankAccount')} />
                Has Bank Account
              </label>
            </div>
            {watch('hasBankAccount') && (
              <div>
                <label className="label">Bank Name</label>
                <input className="input" {...register('bankName')} />
              </div>
            )}
          </div>
        </div>

        {/* Error display */}
        {mutation.isError && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            {getErrorMessage(mutation.error)}
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-between pb-8">
          <Link to={`/customers/${id}`} className="btn-secondary">
            Cancel
          </Link>
          <button type="submit" disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
