import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { encrypt, decrypt, hashForLookup, maskSensitive } from '../services/encryption';
import { AppError } from '../middleware/errorHandler';
import { writeAuditLog } from '../middleware/audit';
import { KENYA_COUNTIES } from '../config';
import { runCustomerChecks } from '../services/qualityService';

// ── Validation Schemas ────────────────────────────────────────────────────────

const phoneRegex = /^(\+254|0)[17]\d{8}$/;
const nationalIdRegex = /^\d{7,8}$/;

const farmProfileSchema = z.object({
  farmSizeAcres: z.number().min(0.1).max(1000),
  landOwnership: z.enum(['OWNED', 'LEASED', 'COMMUNAL', 'FAMILY']),
  primaryCrop: z.string().min(1),
  secondaryCrops: z.array(z.string()).default([]),
  irrigationType: z.enum(['IRRIGATED', 'RAIN_FED', 'MIXED']),
  hasGreenhouse: z.boolean().default(false),
  livestockType: z.array(z.string()).default([]),
  livestockCount: z.number().int().min(0).default(0),
  marketAccess: z.enum(['CONTRACT', 'COOPERATIVE', 'LOCAL_MARKET', 'SUBSISTENCE']),
  distanceToMarketKm: z.number().min(0).optional(),
  hasStorageFacility: z.boolean().default(false),
  yaraMemberSince: z.string().datetime().optional().nullable(),
  yaraProductsUsed: z.array(z.string()).default([]),
  annualInputCostKes: z.number().min(0).optional(),
  averageYieldKg: z.number().min(0).optional(),
  hasElectricity: z.boolean().default(false),
  hasPipedWater: z.boolean().default(false),
});

const financialProfileSchema = z.object({
  monthlyFarmIncome: z.number().min(0),
  monthlyOffFarmIncome: z.number().min(0).default(0),
  monthlyHouseholdExpenses: z.number().min(0),
  otherMonthlyDebt: z.number().min(0).default(0),
  hasMpesa: z.boolean().default(true),
  mpesaMonthlyAvgKes: z.number().min(0).optional().nullable(),
  hasBankAccount: z.boolean().default(false),
  bankName: z.string().optional().nullable(),
  hasGroupMembership: z.boolean().default(false),
  groupName: z.string().optional().nullable(),
  groupType: z.string().optional().nullable(),
  groupMonthlySavingsKes: z.number().min(0).optional().nullable(),
  crbStatus: z.enum(['CLEAR', 'LISTED', 'UNKNOWN', 'PERFORMING']).default('UNKNOWN'),
  previousLoansCount: z.number().int().min(0).default(0),
  previousLoansRepaidOnTime: z.boolean().optional().nullable(),
});

const createCustomerSchema = z.object({
  // Yara
  yaraCustomerId: z.string().optional(),
  yaraRegion: z.string().optional(),

  // PII (will be encrypted)
  nationalId: z.string().regex(nationalIdRegex, 'National ID must be 7-8 digits'),
  phone: z.string().regex(phoneRegex, 'Invalid Kenyan phone number'),
  alternatePhone: z.string().regex(phoneRegex).optional().nullable(),

  // Personal
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  dateOfBirth: z.string().datetime(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']),
  maritalStatus: z.enum(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED']),
  numberOfDependents: z.number().int().min(0).max(20).default(0),

  // Location
  county: z.string().refine(c => KENYA_COUNTIES.includes(c), 'Invalid county'),
  subCounty: z.string().min(1),
  ward: z.string().optional(),
  village: z.string().min(1),
  physicalAddress: z.string().optional(),
  gpsLatitude: z.number().min(-5).max(5).optional(),
  gpsLongitude: z.number().min(33).max(42).optional(),

  // Next of kin
  nextOfKinName: z.string().min(1),
  nextOfKinPhone: z.string().regex(phoneRegex),
  nextOfKinRelation: z.string().min(1),
  nextOfKinNationalId: z.string().regex(nationalIdRegex).optional(),

  // PEP
  isPEP: z.boolean().default(false),
  pepDetails: z.string().optional(),

  // KDPA consent
  dataConsentGiven: z.boolean().refine(v => v === true, 'Data consent is required'),

  // Branch
  branchId: z.string().uuid(),

  // Embedded sub-records
  farmProfile: farmProfileSchema.optional(),
  financialProfile: financialProfileSchema.optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function generateCustomerNumber(branchId: string): Promise<string> {
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { code: true } });
  const code = branch?.code ?? 'GEN';
  const count = await prisma.customer.count({ where: { branchId } });
  return `CUST-${code}-${String(count + 1).padStart(5, '0')}`;
}

// ── Controllers ───────────────────────────────────────────────────────────────

export async function createCustomer(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const body = createCustomerSchema.parse(req.body);

  // Deduplication check
  const nationalIdHash = hashForLookup(body.nationalId);
  const phoneHash = hashForLookup(body.phone);

  const existing = await prisma.customer.findFirst({
    where: { OR: [{ nationalIdHash }, { phoneHash }] },
    select: { id: true, firstName: true, lastName: true },
  });
  if (existing) {
    throw new AppError(409, `Customer already exists: ${existing.firstName} ${existing.lastName}`);
  }

  const customer = await prisma.customer.create({
    data: {
      yaraCustomerId: body.yaraCustomerId,
      yaraRegion: body.yaraRegion,
      nationalIdEnc: encrypt(body.nationalId),
      nationalIdHash,
      phoneEnc: encrypt(body.phone),
      phoneHash,
      alternatePhone: body.alternatePhone,
      firstName: body.firstName,
      lastName: body.lastName,
      dateOfBirth: new Date(body.dateOfBirth),
      gender: body.gender,
      maritalStatus: body.maritalStatus,
      numberOfDependents: body.numberOfDependents,
      county: body.county,
      subCounty: body.subCounty,
      ward: body.ward,
      village: body.village,
      physicalAddress: body.physicalAddress,
      gpsLatitude: body.gpsLatitude,
      gpsLongitude: body.gpsLongitude,
      nextOfKinName: body.nextOfKinName,
      nextOfKinPhone: body.nextOfKinPhone,
      nextOfKinRelation: body.nextOfKinRelation,
      nextOfKinNationalId: body.nextOfKinNationalId,
      isPEP: body.isPEP,
      pepDetails: body.pepDetails,
      dataConsentGiven: body.dataConsentGiven,
      dataConsentAt: new Date(),
      dataConsentVersion: '1.0',
      branchId: body.branchId,
      customerNumber: await generateCustomerNumber(body.branchId),
      // Higher risk if PEP
      riskRating: body.isPEP ? 'HIGH' : 'LOW',
      amlStatus: body.isPEP ? 'FLAGGED' : 'PENDING',
      farmProfile: body.farmProfile ? {
        create: {
          farmSize: body.farmProfile.farmSizeAcres,
          landOwnership: body.farmProfile.landOwnership,
          primaryCrop: body.farmProfile.primaryCrop,
          secondaryCrops: body.farmProfile.secondaryCrops,
          irrigationType: body.farmProfile.irrigationType,
          hasGreenhouse: body.farmProfile.hasGreenhouse,
          livestockType: body.farmProfile.livestockType,
          livestockCount: body.farmProfile.livestockCount,
          marketAccess: body.farmProfile.marketAccess,
          distanceToMarket: body.farmProfile.distanceToMarketKm,
          hasStorageFacility: body.farmProfile.hasStorageFacility,
          yaraMemberSince: body.farmProfile.yaraMemberSince ? new Date(body.farmProfile.yaraMemberSince) : null,
          yaraProductsUsed: body.farmProfile.yaraProductsUsed,
          annualInputCostKes: body.farmProfile.annualInputCostKes,
          averageYieldKg: body.farmProfile.averageYieldKg,
          hasElectricity: body.farmProfile.hasElectricity,
          hasPipedWater: body.farmProfile.hasPipedWater,
        },
      } : undefined,
      financialProfile: body.financialProfile ? {
        create: {
          monthlyFarmIncome: body.financialProfile.monthlyFarmIncome,
          monthlyOffFarmIncome: body.financialProfile.monthlyOffFarmIncome,
          monthlyHouseholdExpenses: body.financialProfile.monthlyHouseholdExpenses,
          otherMonthlyDebt: body.financialProfile.otherMonthlyDebt,
          hasMpesa: body.financialProfile.hasMpesa,
          mpesaMonthlyAvgKes: body.financialProfile.mpesaMonthlyAvgKes,
          hasBankAccount: body.financialProfile.hasBankAccount,
          bankName: body.financialProfile.bankName,
          hasGroupMembership: body.financialProfile.hasGroupMembership,
          groupName: body.financialProfile.groupName,
          groupType: body.financialProfile.groupType,
          groupMonthlySavingsKes: body.financialProfile.groupMonthlySavingsKes,
          crbStatus: body.financialProfile.crbStatus,
          previousLoansCount: body.financialProfile.previousLoansCount,
          previousLoansRepaidOnTime: body.financialProfile.previousLoansRepaidOnTime,
        },
      } : undefined,
    },
    include: { farmProfile: true, financialProfile: true, branch: { select: { name: true } } },
  });

  await writeAuditLog(req.user.sub, 'CREATE_CUSTOMER', 'customers', customer.id, req);

  // Run quality checks asynchronously — do NOT block the response
  runCustomerChecks(customer.id).catch(err =>
    console.error('[Quality] customer check failed:', err),
  );

  res.status(201).json({
    ...customer,
    nationalIdEnc: undefined,
    nationalIdHash: undefined,
    phoneEnc: undefined,
    phoneHash: undefined,
  });
}

export async function getCustomers(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
  const skip = (page - 1) * limit;
  const search = req.query.search as string | undefined;
  const kycStatus = req.query.kycStatus as string | undefined;
  const county = req.query.county as string | undefined;

  const where = {
    isActive: true,
    // Loan officers only see their branch
    ...(req.user.role === 'LOAN_OFFICER' ? { branchId: req.user.branchId ?? undefined } : {}),
    ...(kycStatus ? { kycStatus: kycStatus as never } : {}),
    ...(county ? { county } : {}),
    ...(search ? {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' as const } },
        { lastName: { contains: search, mode: 'insensitive' as const } },
        { yaraCustomerId: { contains: search, mode: 'insensitive' as const } },
        { customerNumber: { contains: search, mode: 'insensitive' as const } },
        { village: { contains: search, mode: 'insensitive' as const } },
      ],
    } : {}),
  };

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, firstName: true, lastName: true, county: true,
        subCounty: true, village: true, yaraCustomerId: true,
        customerNumber: true,
        kycStatus: true, amlStatus: true, riskRating: true,
        gender: true, createdAt: true,
        branch: { select: { name: true } },
        _count: { select: { loans: true, loanApplications: true } },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  // Attach unresolved quality flag counts — single groupBy (no N+1)
  const customerIds = customers.map(c => c.id);
  const flagGroups  = customerIds.length
    ? await prisma.dataQualityFlag.groupBy({
        by: ['entityId'],
        where: { entityType: 'CUSTOMER', entityId: { in: customerIds }, isResolved: false },
        _count: { id: true },
      })
    : [];
  const flagCountMap: Record<string, number> = Object.fromEntries(
    flagGroups.map(g => [g.entityId, g._count.id]),
  );
  const customersWithFlags = customers.map(c => ({
    ...c,
    qualityFlagCount: flagCountMap[c.id] ?? 0,
  }));

  await writeAuditLog(req.user.sub, 'LIST_CUSTOMERS', 'customers', 'list', req);

  res.json({
    data: customersWithFlags,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

export async function getCustomer(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const { id } = req.params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      farmProfile: true,
      financialProfile: { select: {
        id: true, monthlyFarmIncome: true, monthlyOffFarmIncome: true,
        monthlyHouseholdExpenses: true, otherMonthlyDebt: true,
        hasMpesa: true, mpesaMonthlyAvgKes: true, hasBankAccount: true,
        bankName: true, hasGroupMembership: true, groupName: true,
        groupType: true, groupMonthlySavingsKes: true,
        crbStatus: true, crbCheckedAt: true, previousLoansCount: true,
        previousLoansRepaidOnTime: true,
        // Exclude encrypted CRB report
      }},
      kycDocuments: {
        select: { id: true, type: true, fileName: true, isVerified: true, uploadedAt: true },
      },
      creditScores: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true, totalScore: true, recommendation: true,
          maxLoanAmountKes: true, createdAt: true,
        },
      },
      branch: { select: { id: true, name: true, county: true } },
      _count: { select: { loans: true, loanApplications: true } },
    },
  });

  if (!customer) throw new AppError(404, 'Customer not found');

  await writeAuditLog(req.user.sub, 'VIEW_CUSTOMER', 'customers', id, req);

  // Decrypt for display (mask national ID)
  const response = {
    ...customer,
    nationalId: maskSensitive(decrypt(customer.nationalIdEnc)),
    phone: decrypt(customer.phoneEnc),
    nationalIdEnc: undefined,
    nationalIdHash: undefined,
    phoneEnc: undefined,
    phoneHash: undefined,
  };

  res.json(response);
}

// ── Update Customer ───────────────────────────────────────────────────────────

const updateCustomerSchema = z.object({
  firstName:           z.string().min(1).max(100).optional(),
  lastName:            z.string().min(1).max(100).optional(),
  alternatePhone:      z.string().regex(phoneRegex).optional().nullable(),
  dateOfBirth:         z.string().datetime().optional(),
  gender:              z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
  maritalStatus:       z.enum(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED']).optional(),
  numberOfDependents:  z.number().int().min(0).max(20).optional(),
  county:              z.string().refine(c => KENYA_COUNTIES.includes(c), 'Invalid county').optional(),
  subCounty:           z.string().min(1).optional(),
  ward:                z.string().optional().nullable(),
  village:             z.string().min(1).optional(),
  physicalAddress:     z.string().optional().nullable(),
  nextOfKinName:       z.string().min(1).optional(),
  nextOfKinPhone:      z.string().regex(phoneRegex).optional(),
  nextOfKinRelation:   z.string().min(1).optional(),
  nextOfKinNationalId: z.string().regex(nationalIdRegex).optional().nullable(),
  isPEP:               z.boolean().optional(),
  pepDetails:          z.string().optional().nullable(),
  branchId:            z.string().uuid().optional(),
  yaraCustomerId:      z.string().optional().nullable(),
  yaraRegion:          z.string().optional().nullable(),
  farmProfile: z.object({
    farmSizeAcres:      z.number().min(0.1).max(1000).optional(),
    landOwnership:      z.enum(['OWNED', 'LEASED', 'COMMUNAL', 'FAMILY']).optional(),
    primaryCrop:        z.string().min(1).optional(),
    secondaryCrops:     z.array(z.string()).optional(),
    irrigationType:     z.enum(['IRRIGATED', 'RAIN_FED', 'MIXED']).optional(),
    hasGreenhouse:      z.boolean().optional(),
    marketAccess:       z.enum(['CONTRACT', 'COOPERATIVE', 'LOCAL_MARKET', 'SUBSISTENCE']).optional(),
    distanceToMarketKm: z.number().min(0).optional().nullable(),
    hasStorageFacility: z.boolean().optional(),
    hasElectricity:     z.boolean().optional(),
    hasPipedWater:      z.boolean().optional(),
    livestockCount:     z.number().int().min(0).optional(),
    annualInputCostKes: z.number().min(0).optional().nullable(),
    yaraMemberSince:    z.string().datetime().optional().nullable(),
    yaraProductsUsed:   z.array(z.string()).optional(),
  }).optional(),
  financialProfile: z.object({
    monthlyFarmIncome:         z.number().min(0).optional(),
    monthlyOffFarmIncome:      z.number().min(0).optional(),
    monthlyHouseholdExpenses:  z.number().min(0).optional(),
    otherMonthlyDebt:          z.number().min(0).optional(),
    hasMpesa:                  z.boolean().optional(),
    mpesaMonthlyAvgKes:        z.number().min(0).optional().nullable(),
    hasBankAccount:            z.boolean().optional(),
    bankName:                  z.string().optional().nullable(),
    hasGroupMembership:        z.boolean().optional(),
    groupName:                 z.string().optional().nullable(),
    groupType:                 z.string().optional().nullable(),
    groupMonthlySavingsKes:    z.number().min(0).optional().nullable(),
    crbStatus:                 z.enum(['CLEAR', 'LISTED', 'UNKNOWN', 'PERFORMING']).optional(),
    previousLoansCount:        z.number().int().min(0).optional(),
    previousLoansRepaidOnTime: z.boolean().optional().nullable(),
  }).optional(),
});

export async function updateCustomer(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const { id } = req.params;

  // LOs can only edit customers in their branch
  const existing = await prisma.customer.findUnique({
    where: { id },
    select: { id: true, branchId: true },
  });
  if (!existing) throw new AppError(404, 'Customer not found');
  if (req.user.role === 'LOAN_OFFICER' && existing.branchId !== req.user.branchId) {
    throw new AppError(403, 'Not authorized to edit this customer');
  }

  const body = updateCustomerSchema.parse(req.body);
  const { farmProfile, financialProfile, dateOfBirth, isPEP, ...coreFields } = body;

  const customer = await prisma.customer.update({
    where: { id },
    data: {
      ...coreFields,
      ...(dateOfBirth ? { dateOfBirth: new Date(dateOfBirth) } : {}),
      ...(isPEP !== undefined ? {
        isPEP,
        riskRating: isPEP ? 'HIGH' : 'LOW',
        amlStatus:  isPEP ? 'FLAGGED' : undefined,
      } : {}),
      ...(farmProfile ? {
        farmProfile: {
          upsert: {
            create: {
              farmSize:           farmProfile.farmSizeAcres ?? 0,
              landOwnership:      farmProfile.landOwnership ?? 'OWNED',
              primaryCrop:        farmProfile.primaryCrop ?? '',
              secondaryCrops:     farmProfile.secondaryCrops ?? [],
              irrigationType:     farmProfile.irrigationType ?? 'RAIN_FED',
              hasGreenhouse:      farmProfile.hasGreenhouse ?? false,
              marketAccess:       farmProfile.marketAccess ?? 'LOCAL_MARKET',
              distanceToMarket:   farmProfile.distanceToMarketKm,
              hasStorageFacility: farmProfile.hasStorageFacility ?? false,
              hasElectricity:     farmProfile.hasElectricity ?? false,
              hasPipedWater:      farmProfile.hasPipedWater ?? false,
              livestockCount:     farmProfile.livestockCount ?? 0,
              livestockType:      [],
              annualInputCostKes: farmProfile.annualInputCostKes,
              yaraMemberSince:    farmProfile.yaraMemberSince ? new Date(farmProfile.yaraMemberSince) : null,
              yaraProductsUsed:   farmProfile.yaraProductsUsed ?? [],
            },
            update: {
              ...(farmProfile.farmSizeAcres     !== undefined ? { farmSize: farmProfile.farmSizeAcres } : {}),
              ...(farmProfile.landOwnership      !== undefined ? { landOwnership: farmProfile.landOwnership } : {}),
              ...(farmProfile.primaryCrop        !== undefined ? { primaryCrop: farmProfile.primaryCrop } : {}),
              ...(farmProfile.secondaryCrops     !== undefined ? { secondaryCrops: farmProfile.secondaryCrops } : {}),
              ...(farmProfile.irrigationType     !== undefined ? { irrigationType: farmProfile.irrigationType } : {}),
              ...(farmProfile.hasGreenhouse      !== undefined ? { hasGreenhouse: farmProfile.hasGreenhouse } : {}),
              ...(farmProfile.marketAccess       !== undefined ? { marketAccess: farmProfile.marketAccess } : {}),
              ...(farmProfile.distanceToMarketKm !== undefined ? { distanceToMarket: farmProfile.distanceToMarketKm } : {}),
              ...(farmProfile.hasStorageFacility !== undefined ? { hasStorageFacility: farmProfile.hasStorageFacility } : {}),
              ...(farmProfile.hasElectricity     !== undefined ? { hasElectricity: farmProfile.hasElectricity } : {}),
              ...(farmProfile.hasPipedWater      !== undefined ? { hasPipedWater: farmProfile.hasPipedWater } : {}),
              ...(farmProfile.livestockCount     !== undefined ? { livestockCount: farmProfile.livestockCount } : {}),
              ...(farmProfile.annualInputCostKes !== undefined ? { annualInputCostKes: farmProfile.annualInputCostKes } : {}),
              ...(farmProfile.yaraMemberSince    !== undefined ? { yaraMemberSince: farmProfile.yaraMemberSince ? new Date(farmProfile.yaraMemberSince) : null } : {}),
              ...(farmProfile.yaraProductsUsed   !== undefined ? { yaraProductsUsed: farmProfile.yaraProductsUsed } : {}),
            },
          },
        },
      } : {}),
      ...(financialProfile ? {
        financialProfile: {
          upsert: {
            create: {
              monthlyFarmIncome:         financialProfile.monthlyFarmIncome ?? 0,
              monthlyOffFarmIncome:      financialProfile.monthlyOffFarmIncome ?? 0,
              monthlyHouseholdExpenses:  financialProfile.monthlyHouseholdExpenses ?? 0,
              otherMonthlyDebt:          financialProfile.otherMonthlyDebt ?? 0,
              hasMpesa:                  financialProfile.hasMpesa ?? true,
              mpesaMonthlyAvgKes:        financialProfile.mpesaMonthlyAvgKes,
              hasBankAccount:            financialProfile.hasBankAccount ?? false,
              bankName:                  financialProfile.bankName,
              hasGroupMembership:        financialProfile.hasGroupMembership ?? false,
              groupName:                 financialProfile.groupName,
              groupType:                 financialProfile.groupType,
              groupMonthlySavingsKes:    financialProfile.groupMonthlySavingsKes,
              crbStatus:                 financialProfile.crbStatus ?? 'UNKNOWN',
              previousLoansCount:        financialProfile.previousLoansCount ?? 0,
              previousLoansRepaidOnTime: financialProfile.previousLoansRepaidOnTime,
            },
            update: {
              ...(financialProfile.monthlyFarmIncome        !== undefined ? { monthlyFarmIncome:         financialProfile.monthlyFarmIncome }        : {}),
              ...(financialProfile.monthlyOffFarmIncome     !== undefined ? { monthlyOffFarmIncome:      financialProfile.monthlyOffFarmIncome }     : {}),
              ...(financialProfile.monthlyHouseholdExpenses !== undefined ? { monthlyHouseholdExpenses:  financialProfile.monthlyHouseholdExpenses } : {}),
              ...(financialProfile.otherMonthlyDebt         !== undefined ? { otherMonthlyDebt:          financialProfile.otherMonthlyDebt }         : {}),
              ...(financialProfile.hasMpesa                 !== undefined ? { hasMpesa:                  financialProfile.hasMpesa }                 : {}),
              ...(financialProfile.mpesaMonthlyAvgKes       !== undefined ? { mpesaMonthlyAvgKes:        financialProfile.mpesaMonthlyAvgKes }       : {}),
              ...(financialProfile.hasBankAccount           !== undefined ? { hasBankAccount:            financialProfile.hasBankAccount }           : {}),
              ...(financialProfile.bankName                 !== undefined ? { bankName:                  financialProfile.bankName }                 : {}),
              ...(financialProfile.hasGroupMembership       !== undefined ? { hasGroupMembership:        financialProfile.hasGroupMembership }       : {}),
              ...(financialProfile.groupName                !== undefined ? { groupName:                 financialProfile.groupName }                : {}),
              ...(financialProfile.groupType                !== undefined ? { groupType:                 financialProfile.groupType }                : {}),
              ...(financialProfile.groupMonthlySavingsKes   !== undefined ? { groupMonthlySavingsKes:    financialProfile.groupMonthlySavingsKes }   : {}),
              ...(financialProfile.crbStatus                !== undefined ? { crbStatus:                 financialProfile.crbStatus }                : {}),
              ...(financialProfile.previousLoansCount       !== undefined ? { previousLoansCount:        financialProfile.previousLoansCount }       : {}),
              ...(financialProfile.previousLoansRepaidOnTime !== undefined ? { previousLoansRepaidOnTime: financialProfile.previousLoansRepaidOnTime } : {}),
            },
          },
        },
      } : {}),
    },
    include: {
      farmProfile: true,
      financialProfile: { select: {
        id: true, monthlyFarmIncome: true, monthlyOffFarmIncome: true,
        monthlyHouseholdExpenses: true, otherMonthlyDebt: true,
        hasMpesa: true, mpesaMonthlyAvgKes: true, hasBankAccount: true,
        bankName: true, hasGroupMembership: true, groupName: true, groupType: true,
        groupMonthlySavingsKes: true, crbStatus: true, previousLoansCount: true,
        previousLoansRepaidOnTime: true,
      }},
      branch: { select: { name: true } },
    },
  });

  await writeAuditLog(req.user.sub, 'UPDATE_CUSTOMER', 'customers', id, req);

  res.json({
    ...customer,
    nationalIdEnc: undefined,
    nationalIdHash: undefined,
    phoneEnc: undefined,
    phoneHash: undefined,
  });
}

export async function updateKYCStatus(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const { id } = req.params;

  const schema = z.object({
    kycStatus: z.enum(['VERIFIED', 'REJECTED', 'REQUIRES_UPDATE']),
    amlStatus: z.enum(['CLEAR', 'FLAGGED', 'BLOCKED']).optional(),
    riskRating: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    amlNotes: z.string().optional(),
  });

  const body = schema.parse(req.body);

  const customer = await prisma.customer.update({
    where: { id },
    data: body,
    select: { id: true, kycStatus: true, amlStatus: true, riskRating: true },
  });

  await writeAuditLog(req.user.sub, 'UPDATE_KYC_STATUS', 'customers', id, req, {
    newKycStatus: body.kycStatus,
    newAmlStatus: body.amlStatus,
  });

  res.json(customer);
}

export async function getCustomerRepayments(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const { id } = req.params;

  // Verify customer exists and LO has branch access
  const customer = await prisma.customer.findUnique({
    where: { id },
    select: { id: true, branchId: true },
  });
  if (!customer) throw new AppError(404, 'Customer not found');

  if (req.user.role === 'LOAN_OFFICER' && customer.branchId !== req.user.branchId) {
    throw new AppError(403, 'Not authorized');
  }

  const repayments = await prisma.repayment.findMany({
    where: { loan: { customerId: id } },
    include: {
      loan: {
        select: {
          id: true,
          loanNumber: true,
          principalKes: true,
          outstandingBalKes: true,
          status: true,
          termMonths: true,
          interestRatePct: true,
        },
      },
    },
    orderBy: { paymentDate: 'desc' },
  });

  res.json({ data: repayments });
}

// ── Customer Tier ─────────────────────────────────────────────────────────────

export async function getCustomerTier(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const { id } = req.params;

  const customer = await prisma.customer.findUnique({ where: { id }, select: { id: true } });
  if (!customer) throw new AppError(404, 'Customer not found');

  const { getCustomerTierSummary } = await import('../services/awardService');
  const summary = await getCustomerTierSummary(id);

  await writeAuditLog(req.user.sub, 'VIEW_CUSTOMER_TIER', 'customers', id, req);
  res.json(summary);
}
