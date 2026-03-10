import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { writeAuditLog } from '../middleware/audit';
import { asyncHandler } from '../utils/asyncHandler';
import { notifyUsers } from '../utils/notifyUsers';
import { broadcastToSession } from '../utils/sseStore';

// ─── Create meeting ───────────────────────────────────────────────────────────

const createMeetingSchema = z.object({
  title: z.string().max(200).optional(),
  scheduledAt: z.string().datetime().optional(),
});

export const createMeeting = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
  if (!user?.branchId) throw new AppError(400, 'Your account is not assigned to a branch');

  const body = createMeetingSchema.parse(req.body);

  const meeting = await prisma.bccMeeting.create({
    data: {
      branchId: user.branchId,
      createdById: user.id,
      title: body.title,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
    },
    include: {
      branch: { select: { name: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      _count: { select: { sessions: true } },
    },
  });

  // Notify all active branch users
  const branchUsers = await prisma.user.findMany({
    where: { branchId: user.branchId, isActive: true, id: { not: user.id } },
    select: { id: true },
  });
  await notifyUsers(
    branchUsers.map(u => u.id),
    'BCC_MEETING_SCHEDULED',
    `BCC Meeting scheduled${body.title ? `: ${body.title}` : ''}`,
    body.scheduledAt
      ? `Scheduled for ${new Date(body.scheduledAt).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}`
      : null,
    'BccMeeting',
    meeting.id,
  );

  await writeAuditLog(req.user.sub, 'CREATE_BCC_MEETING', 'bcc_meetings', meeting.id, req);
  res.status(201).json(meeting);
});

// ─── List meetings (branch-scoped) ────────────────────────────────────────────

export const listMeetings = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
  if (!user?.branchId) throw new AppError(400, 'Your account is not assigned to a branch');

  const branchId = req.user.role === 'ADMIN'
    ? (req.query.branchId as string | undefined ?? user.branchId)
    : user.branchId;

  const meetings = await prisma.bccMeeting.findMany({
    where: { branchId },
    orderBy: [{ status: 'asc' }, { scheduledAt: 'desc' }, { createdAt: 'desc' }],
    include: {
      createdBy: { select: { firstName: true, lastName: true } },
      sessions: {
        select: {
          id: true,
          agendaIndex: true,
          status: true,
          outcome: true,
          presentedAt: true,
          loanApplication: {
            select: {
              id: true,
              requestedAmountKes: true,
              customer: { select: { firstName: true, lastName: true } },
              officer: { select: { firstName: true, lastName: true } },
            },
          },
          _count: { select: { votes: true } },
        },
        orderBy: { agendaIndex: 'asc' },
      },
    },
  });

  res.json(meetings);
});

// ─── Get meeting detail ───────────────────────────────────────────────────────

export const getMeeting = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const meeting = await prisma.bccMeeting.findUnique({
    where: { id: req.params.id },
    include: {
      branch: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true, role: true } },
      sessions: {
        orderBy: { agendaIndex: 'asc' },
        include: {
          loanApplication: {
            select: {
              id: true,
              requestedAmountKes: true,
              loanType: true,
              status: true,
              customer: { select: { firstName: true, lastName: true, county: true } },
              officer: { select: { id: true, firstName: true, lastName: true } },
              creditScore: { select: { totalScore: true, recommendation: true } },
            },
          },
          votes: { select: { vote: true, userId: true } },
          _count: { select: { comments: true, flags: true } },
        },
      },
    },
  });

  if (!meeting) throw new AppError(404, 'Meeting not found');

  const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
  if (req.user.role !== 'ADMIN' && user?.branchId !== meeting.branchId) {
    throw new AppError(403, 'Access denied – different branch');
  }

  res.json(meeting);
});

// ─── Activate meeting ─────────────────────────────────────────────────────────

export const activateMeeting = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const meeting = await prisma.bccMeeting.findUnique({
    where: { id: req.params.id },
    include: { sessions: { select: { id: true } } },
  });
  if (!meeting) throw new AppError(404, 'Meeting not found');
  if (meeting.status !== 'SCHEDULED') throw new AppError(409, `Meeting is already ${meeting.status}`);

  const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
  if (req.user.role !== 'ADMIN' && user?.branchId !== meeting.branchId) {
    throw new AppError(403, 'Access denied – different branch');
  }

  const updated = await prisma.bccMeeting.update({
    where: { id: meeting.id },
    data: { status: 'ACTIVE' },
  });

  // Notify branch users the meeting has started
  const branchUsers = await prisma.user.findMany({
    where: { branchId: meeting.branchId, isActive: true, id: { not: req.user.sub } },
    select: { id: true },
  });
  await notifyUsers(
    branchUsers.map(u => u.id),
    'BCC_MEETING_STARTED',
    `BCC Meeting started${meeting.title ? `: ${meeting.title}` : ''}`,
    'Join the meeting to participate in credit discussions.',
    'BccMeeting',
    meeting.id,
  );

  // Broadcast to any open session streams in this meeting
  for (const s of meeting.sessions) {
    broadcastToSession(s.id, 'meeting_activated', { meetingId: meeting.id });
  }

  await writeAuditLog(req.user.sub, 'ACTIVATE_BCC_MEETING', 'bcc_meetings', meeting.id, req);
  res.json(updated);
});

// ─── Add session (application) to meeting ────────────────────────────────────

const addSessionSchema = z.object({
  loanApplicationId: z.string().uuid(),
  quorumRequired: z.number().int().min(2).max(10).default(2),
});

export const addSessionToMeeting = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const meeting = await prisma.bccMeeting.findUnique({ where: { id: req.params.id } });
  if (!meeting) throw new AppError(404, 'Meeting not found');
  if (meeting.status === 'COMPLETED') throw new AppError(409, 'Cannot add sessions to a completed meeting');

  const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
  if (req.user.role !== 'ADMIN' && user?.branchId !== meeting.branchId) {
    throw new AppError(403, 'Access denied – different branch');
  }

  const body = addSessionSchema.parse(req.body);

  const application = await prisma.loanApplication.findUnique({
    where: { id: body.loanApplicationId },
    include: { bccSession: true },
  });
  if (!application) throw new AppError(404, 'Loan application not found');
  if (application.bccSession) throw new AppError(409, 'This application already has a BCC session');
  if (!['SUBMITTED', 'UNDER_REVIEW'].includes(application.status)) {
    throw new AppError(400, 'Application must be SUBMITTED or UNDER_REVIEW');
  }

  // Determine next agenda index
  const maxIndex = await prisma.bccSession.aggregate({
    where: { meetingId: meeting.id },
    _max: { agendaIndex: true },
  });
  const agendaIndex = (maxIndex._max.agendaIndex ?? -1) + 1;

  const session = await prisma.$transaction(async (tx) => {
    const s = await tx.bccSession.create({
      data: {
        loanApplicationId: body.loanApplicationId,
        branchId: meeting.branchId,
        meetingId: meeting.id,
        agendaIndex,
        quorumRequired: body.quorumRequired,
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        createdByUserId: req.user!.sub,
      },
      include: {
        loanApplication: {
          include: { customer: { select: { firstName: true, lastName: true } } },
        },
      },
    });
    await tx.loanApplication.update({
      where: { id: body.loanApplicationId },
      data: { status: 'UNDER_REVIEW' },
    });
    return s;
  });

  await writeAuditLog(req.user.sub, 'ADD_SESSION_TO_MEETING', 'bcc_sessions', session.id, req);
  res.status(201).json(session);
});

// ─── Reorder agenda ───────────────────────────────────────────────────────────

const reorderSchema = z.object({
  order: z.array(z.object({ sessionId: z.string().uuid(), agendaIndex: z.number().int().min(0) })),
});

export const reorderAgenda = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const meeting = await prisma.bccMeeting.findUnique({ where: { id: req.params.id } });
  if (!meeting) throw new AppError(404, 'Meeting not found');

  const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
  if (req.user.role !== 'ADMIN' && user?.branchId !== meeting.branchId) {
    throw new AppError(403, 'Access denied – different branch');
  }

  const { order } = reorderSchema.parse(req.body);

  await prisma.$transaction(
    order.map(({ sessionId, agendaIndex }) =>
      prisma.bccSession.update({ where: { id: sessionId }, data: { agendaIndex } }),
    ),
  );

  res.json({ success: true });
});

// ─── Start presenting a session ───────────────────────────────────────────────

export const startPresenting = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const session = await prisma.bccSession.findUnique({
    where: { id: req.params.sessionId },
    include: {
      loanApplication: {
        include: { customer: { select: { firstName: true, lastName: true } } },
      },
      meeting: true,
    },
  });
  if (!session) throw new AppError(404, 'BCC session not found');

  const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
  if (req.user.role !== 'ADMIN' && user?.branchId !== session.branchId) {
    throw new AppError(403, 'Access denied – different branch');
  }

  const updated = await prisma.bccSession.update({
    where: { id: session.id },
    data: { presentedAt: new Date() },
  });

  // SSE broadcast to this session's subscribers
  broadcastToSession(session.id, 'presenting', { sessionId: session.id, presentedAt: updated.presentedAt });

  // Notify branch users
  const branchUsers = await prisma.user.findMany({
    where: { branchId: session.branchId, isActive: true, id: { not: req.user.sub } },
    select: { id: true },
  });
  const customerName = `${session.loanApplication.customer.firstName} ${session.loanApplication.customer.lastName}`;
  await notifyUsers(
    branchUsers.map(u => u.id),
    'BCC_SESSION_PRESENTING',
    `Now presenting: ${customerName}`,
    'The loan officer is presenting this credit case. Join to participate.',
    'BccSession',
    session.id,
  );

  res.json(updated);
});
