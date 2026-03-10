import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { writeAuditLog } from '../middleware/audit';

// ── Validation Schemas ────────────────────────────────────────────────────────

const createGroupSchema = z.object({
  name: z.string().min(3).max(100),
  registrationNo: z.string().max(50).optional(),
  meetingFrequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY']),
  meetingDay: z.string().max(20).optional(),
  meetingLocation: z.string().max(200).optional(),
  formedAt: z.string().datetime(),
  registeredAt: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
});

const updateGroupSchema = createGroupSchema.partial().extend({
  status: z.enum(['FORMING', 'ACTIVE', 'SUSPENDED', 'DISSOLVED']).optional(),
});

const addMemberSchema = z.object({
  customerId: z.string().uuid(),
  role: z.enum(['CHAIR', 'SECRETARY', 'TREASURER', 'MEMBER']).optional().default('MEMBER'),
});

// ── List Groups ───────────────────────────────────────────────────────────────

export async function listGroups(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const page   = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit  = Math.min(50, parseInt(req.query.limit as string) || 20);
  const skip   = (page - 1) * limit;
  const search = req.query.search as string | undefined;
  const status = req.query.status as string | undefined;

  const where: Record<string, unknown> = {};

  // Role-based scoping
  if (req.user.role === 'LOAN_OFFICER') {
    where.loanOfficerId = req.user.sub;
  } else if (req.user.role === 'BRANCH_MANAGER' && req.user.branchId) {
    where.branchId = req.user.branchId;
  }
  // ADMIN / SUPERVISOR see all

  if (status)   where.status = status;
  if (search)   where.name = { contains: search, mode: 'insensitive' };
  where.isActive = true;

  const [groups, total] = await Promise.all([
    prisma.loanGroup.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        branch:       { select: { name: true } },
        loanOfficer:  { select: { firstName: true, lastName: true } },
        _count: {
          select: {
            members:          true,
            loanApplications: true,
          },
        },
      },
    }),
    prisma.loanGroup.count({ where }),
  ]);

  // Augment with active member count (isActive=true) and active loan count
  const enriched = await Promise.all(groups.map(async (g) => {
    const [activeMembers, activeLoans] = await Promise.all([
      prisma.loanGroupMember.count({ where: { groupId: g.id, isActive: true } }),
      prisma.loanApplication.count({
        where: { loanGroupId: g.id, status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'] } },
      }),
    ]);
    return { ...g, activeMembers, activeLoans };
  }));

  res.json({ data: enriched, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}

// ── Get Single Group ──────────────────────────────────────────────────────────

export async function getGroup(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const { id } = req.params;

  const group = await prisma.loanGroup.findUnique({
    where: { id },
    include: {
      branch:      { select: { id: true, name: true } },
      loanOfficer: { select: { id: true, firstName: true, lastName: true } },
      members: {
        where: { isActive: true },
        orderBy: { joinedAt: 'asc' },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              kycStatus: true,
              loanApplications: {
                where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'] } },
                select: { id: true, status: true, requestedAmountKes: true },
                take: 1,
              },
            },
          },
        },
      },
      loanApplications: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          customer: { select: { id: true, firstName: true, lastName: true } },
          officer:  { select: { firstName: true, lastName: true } },
          loanProduct: { select: { name: true } },
        },
      },
    },
  });

  if (!group) throw new AppError(404, 'Group not found');

  // LO can only see their own groups
  if (req.user.role === 'LOAN_OFFICER' && group.loanOfficerId !== req.user.sub) {
    throw new AppError(403, 'Access denied');
  }

  await writeAuditLog(req.user.sub, 'VIEW_LOAN_GROUP', 'loan_groups', id, req);
  res.json(group);
}

// ── Create Group ──────────────────────────────────────────────────────────────

export async function createGroup(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const body = createGroupSchema.parse(req.body);

  // Determine branchId: LO uses their own, others must supply
  let branchId = req.body.branchId as string | undefined;
  if (req.user.role === 'LOAN_OFFICER') {
    const dbUser = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { branchId: true },
    });
    if (!dbUser?.branchId) throw new AppError(400, 'Loan Officer is not assigned to a branch');
    branchId = dbUser.branchId;
  }
  if (!branchId) throw new AppError(400, 'branchId is required');

  // LO manages their own groups; BM/Admin can assign another LO
  const loanOfficerId = req.user.role === 'LOAN_OFFICER'
    ? req.user.sub
    : (req.body.loanOfficerId as string | undefined) ?? req.user.sub;

  const group = await prisma.loanGroup.create({
    data: {
      name:             body.name,
      registrationNo:   body.registrationNo,
      branchId,
      loanOfficerId,
      meetingFrequency: body.meetingFrequency,
      meetingDay:       body.meetingDay,
      meetingLocation:  body.meetingLocation,
      formedAt:         new Date(body.formedAt),
      registeredAt:     body.registeredAt ? new Date(body.registeredAt) : undefined,
      notes:            body.notes,
      status:           'FORMING',
    },
    include: {
      branch:      { select: { name: true } },
      loanOfficer: { select: { firstName: true, lastName: true } },
    },
  });

  await writeAuditLog(req.user.sub, 'CREATE_LOAN_GROUP', 'loan_groups', group.id, req);
  res.status(201).json(group);
}

// ── Update Group ──────────────────────────────────────────────────────────────

export async function updateGroup(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const { id } = req.params;
  const body = updateGroupSchema.parse(req.body);

  const existing = await prisma.loanGroup.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Group not found');
  if (req.user.role === 'LOAN_OFFICER' && existing.loanOfficerId !== req.user.sub) {
    throw new AppError(403, 'Access denied');
  }

  const updated = await prisma.loanGroup.update({
    where: { id },
    data: {
      ...(body.name            !== undefined && { name:             body.name }),
      ...(body.registrationNo  !== undefined && { registrationNo:   body.registrationNo }),
      ...(body.meetingFrequency !== undefined && { meetingFrequency: body.meetingFrequency }),
      ...(body.meetingDay      !== undefined && { meetingDay:       body.meetingDay }),
      ...(body.meetingLocation !== undefined && { meetingLocation:  body.meetingLocation }),
      ...(body.formedAt        !== undefined && { formedAt:         new Date(body.formedAt) }),
      ...(body.registeredAt    !== undefined && { registeredAt:     new Date(body.registeredAt) }),
      ...(body.notes           !== undefined && { notes:            body.notes }),
      ...(body.status          !== undefined && { status:           body.status }),
    },
  });

  await writeAuditLog(req.user.sub, 'UPDATE_LOAN_GROUP', 'loan_groups', id, req);
  res.json(updated);
}

// ── Toggle Group Active / Soft-delete ─────────────────────────────────────────

export async function toggleGroupStatus(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const { id } = req.params;

  const group = await prisma.loanGroup.findUnique({ where: { id } });
  if (!group) throw new AppError(404, 'Group not found');

  const updated = await prisma.loanGroup.update({
    where: { id },
    data: { isActive: !group.isActive },
  });

  await writeAuditLog(req.user.sub, 'TOGGLE_LOAN_GROUP', 'loan_groups', id, req);
  res.json(updated);
}

// ── Add Member ────────────────────────────────────────────────────────────────

export async function addMember(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const { id: groupId } = req.params;
  const body = addMemberSchema.parse(req.body);

  const group = await prisma.loanGroup.findUnique({ where: { id: groupId } });
  if (!group || !group.isActive) throw new AppError(404, 'Group not found');
  if (req.user.role === 'LOAN_OFFICER' && group.loanOfficerId !== req.user.sub) {
    throw new AppError(403, 'Access denied');
  }

  const customer = await prisma.customer.findUnique({
    where: { id: body.customerId },
    select: { id: true, firstName: true, lastName: true, kycStatus: true, isActive: true },
  });
  if (!customer || !customer.isActive) throw new AppError(404, 'Customer not found');
  if (customer.kycStatus === 'PENDING') {
    throw new AppError(400, 'Customer must have KYC submitted or verified before joining a group');
  }

  // Check for existing active membership
  const existing = await prisma.loanGroupMember.findFirst({
    where: { groupId, customerId: body.customerId, isActive: true },
  });
  if (existing) throw new AppError(409, 'Customer is already an active member of this group');

  // Re-activate soft-deleted membership if exists, otherwise create new
  const softDeleted = await prisma.loanGroupMember.findFirst({
    where: { groupId, customerId: body.customerId, isActive: false },
  });

  let member;
  if (softDeleted) {
    member = await prisma.loanGroupMember.update({
      where: { id: softDeleted.id },
      data: { isActive: true, leftAt: null, role: body.role, joinedAt: new Date() },
      include: { customer: { select: { firstName: true, lastName: true, kycStatus: true } } },
    });
  } else {
    member = await prisma.loanGroupMember.create({
      data: { groupId, customerId: body.customerId, role: body.role },
      include: { customer: { select: { firstName: true, lastName: true, kycStatus: true } } },
    });
  }

  await writeAuditLog(req.user.sub, 'ADD_GROUP_MEMBER', 'loan_group_members', member.id, req);
  res.status(201).json(member);
}

// ── Remove Member (soft delete) ───────────────────────────────────────────────

export async function removeMember(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const { id: groupId, memberId } = req.params;

  const group = await prisma.loanGroup.findUnique({ where: { id: groupId } });
  if (!group) throw new AppError(404, 'Group not found');
  if (req.user.role === 'LOAN_OFFICER' && group.loanOfficerId !== req.user.sub) {
    throw new AppError(403, 'Access denied');
  }

  const member = await prisma.loanGroupMember.findUnique({ where: { id: memberId } });
  if (!member || member.groupId !== groupId || !member.isActive) {
    throw new AppError(404, 'Active member not found');
  }

  // Check for open loan applications
  const openApp = await prisma.loanApplication.findFirst({
    where: {
      customerId: member.customerId,
      loanGroupId: groupId,
      status: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
    },
  });
  if (openApp) {
    throw new AppError(409, 'Member has an open loan application in this group. Resolve it first.');
  }

  await prisma.loanGroupMember.update({
    where: { id: memberId },
    data: { isActive: false, leftAt: new Date() },
  });

  await writeAuditLog(req.user.sub, 'REMOVE_GROUP_MEMBER', 'loan_group_members', memberId, req);
  res.json({ message: 'Member removed from group' });
}
