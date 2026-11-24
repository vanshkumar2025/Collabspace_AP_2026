import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { requireUser } from '../middleware/auth.js';
import { getMemberTeam, isTeamLead } from '../services/workspace.service.js';
import { cleanString } from '../utils/validation.js';

// Workspace-specific invitations (/api/workspaces/:teamId/invitations)
export const workspaceInvitationsRouter = Router({ mergeParams: true });
workspaceInvitationsRouter.use(requireUser);

workspaceInvitationsRouter.post('/', async (req, res, next) => {
  const { teamId } = req.params;
  const email = cleanString(req.body?.email, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  try {
    const membership = await getMemberTeam(teamId, req.user.id);
    if (!membership) return res.status(404).json({ error: 'Workspace not found.' });
    if (!isTeamLead(membership)) return res.status(403).json({ error: 'Only a team lead can invite members.' });

    const invitee = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true } });
    if (!invitee) return res.status(404).json({ error: 'That person needs a CollabSpace account before they can be invited.' });
    if (invitee.id === req.user.id) return res.status(400).json({ error: 'You are already part of this workspace.' });

    const member = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId: invitee.id } } });
    if (member) return res.status(409).json({ error: 'That person is already a workspace member.' });

    const invitation = await prisma.teamInvitation.create({
      data: {
        id: randomUUID(),
        teamId,
        userId: invitee.id,
        name: invitee.name,
        email: invitee.email,
        role: 'Member',
        invitedAt: new Date().toISOString(),
        invitedBy: req.user.name,
      },
    });
    res.status(201).json({ invitation });
  } catch (error) {
    next(error);
  }
});

workspaceInvitationsRouter.get('/', async (req, res, next) => {
  const { teamId } = req.params;
  try {
    if (!(await getMemberTeam(teamId, req.user.id))) return res.status(404).json({ error: 'Workspace not found.' });
    const invitations = await prisma.teamInvitation.findMany({
      where: { teamId },
      orderBy: { invitedAt: 'desc' },
      select: { id: true, name: true, email: true, role: true, invitedAt: true, invitedBy: true },
    });
    res.json({ invitations });
  } catch (error) {
    next(error);
  }
});

workspaceInvitationsRouter.delete('/:invitationId', async (req, res, next) => {
  const { teamId, invitationId } = req.params;
  try {
    const membership = await getMemberTeam(teamId, req.user.id);
    if (!membership) return res.status(404).json({ error: 'Workspace not found.' });
    if (!isTeamLead(membership)) return res.status(403).json({ error: 'Only a team lead can cancel invitations.' });

    const invitation = await prisma.teamInvitation.findFirst({ where: { id: invitationId, teamId } });
    if (!invitation) return res.status(404).json({ error: 'Invitation not found.' });

    await prisma.teamInvitation.delete({ where: { id: invitation.id } });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// Personal user invitations (/api/invitations)
export const userInvitationsRouter = Router();
userInvitationsRouter.use(requireUser);

userInvitationsRouter.get('/', async (req, res, next) => {
  try {
    const invitations = await prisma.teamInvitation.findMany({
      where: { userId: req.user.id },
      include: { team: { select: { id: true, name: true, projectTitle: true } } },
      orderBy: { invitedAt: 'desc' },
    });
    res.json({ invitations });
  } catch (error) {
    next(error);
  }
});

userInvitationsRouter.post('/:invitationId/accept', async (req, res, next) => {
  const { invitationId } = req.params;
  try {
    const invitation = await prisma.teamInvitation.findFirst({ where: { id: invitationId, userId: req.user.id } });
    if (!invitation) return res.status(404).json({ error: 'Invitation not found.' });

    await prisma.$transaction([
      prisma.teamMember.create({
        data: {
          id: randomUUID(),
          teamId: invitation.teamId,
          userId: req.user.id,
          name: req.user.name,
          role: invitation.role,
          joinedAt: new Date().toISOString(),
        },
      }),
      prisma.teamInvitation.delete({ where: { id: invitation.id } }),
    ]);
    res.json({ ok: true, teamId: invitation.teamId });
  } catch (error) {
    next(error);
  }
});

userInvitationsRouter.delete('/:invitationId', async (req, res, next) => {
  const { invitationId } = req.params;
  try {
    const invitation = await prisma.teamInvitation.findFirst({ where: { id: invitationId, userId: req.user.id } });
    if (!invitation) return res.status(404).json({ error: 'Invitation not found.' });

    await prisma.teamInvitation.delete({ where: { id: invitation.id } });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
