import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { requireUser } from '../middleware/auth.js';
import { getMemberTeam, isTeamLead } from '../services/workspace.service.js';
import { cleanString } from '../utils/validation.js';
import tasksRouter, { getSuggestedAssignee } from './tasks.js';
import messagesRouter from './messages.js';
import ratingsRouter from './ratings.js';
import { workspaceInvitationsRouter } from './invitations.js';

const router = Router();
router.use(requireUser);

// Nested sub-routers under /api/workspaces/:teamId/...
router.use('/:teamId/tasks', tasksRouter);
router.use('/:teamId/messages', messagesRouter);
router.use('/:teamId/ratings', ratingsRouter);
router.use('/:teamId/invitations', workspaceInvitationsRouter);
router.get('/:teamId/suggested-assignee', getSuggestedAssignee);

router.get('/', async (req, res, next) => {
  try {
    const teams = await prisma.team.findMany({
      where: {
        OR: [
          { members: { some: { userId: req.user.id } } },
          { createdById: req.user.id },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        projectTitle: true,
        deadline: true,
        createdAt: true,
        _count: { select: { members: true, tasks: true } },
      },
    });
    res.json({ workspaces: teams });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  const name = cleanString(req.body?.name, 100);
  const projectTitle = cleanString(req.body?.projectTitle, 160);
  const deadline = cleanString(req.body?.deadline, 40);
  if (name.length < 2) return res.status(400).json({ error: 'Workspace name must be at least 2 characters.' });

  try {
    const team = await prisma.team.create({
      data: {
        id: randomUUID(),
        name,
        projectTitle,
        deadline,
        createdById: req.user.id,
        createdAt: new Date().toISOString(),
        members: {
          create: {
            id: randomUUID(),
            userId: req.user.id,
            name: req.user.name,
            role: 'Lead',
            joinedAt: new Date().toISOString(),
          },
        },
      },
      select: { id: true, name: true, projectTitle: true, deadline: true, createdAt: true },
    });
    res.status(201).json({ workspace: team });
  } catch (error) {
    next(error);
  }
});

router.patch('/:teamId', async (req, res, next) => {
  const { teamId } = req.params;
  const name = req.body?.name === undefined ? undefined : cleanString(req.body.name, 100);
  const projectTitle = req.body?.projectTitle === undefined ? undefined : cleanString(req.body.projectTitle, 160);
  const deadline = req.body?.deadline === undefined ? undefined : cleanString(req.body.deadline, 40);
  if (name !== undefined && name.length < 2) return res.status(400).json({ error: 'Workspace name must be at least 2 characters.' });

  try {
    const membership = await getMemberTeam(teamId, req.user.id);
    if (!membership) return res.status(404).json({ error: 'Workspace not found.' });
    if (!isTeamLead(membership)) return res.status(403).json({ error: 'Only a team lead can edit workspace details.' });

    const workspace = await prisma.$transaction(async (tx) => {
      const updated = await tx.team.update({
        where: { id: teamId },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(projectTitle !== undefined ? { projectTitle } : {}),
          ...(deadline !== undefined ? { deadline } : {}),
        },
      });
      if (name !== undefined) {
        await tx.task.updateMany({ where: { teamId: updated.id }, data: { teamName: name } });
        await tx.message.updateMany({ where: { teamId: updated.id }, data: { teamName: name } });
        await tx.peerRating.updateMany({ where: { teamId: updated.id }, data: { teamName: name } });
      }
      return updated;
    });
    res.json({ workspace: { id: workspace.id, name: workspace.name, projectTitle: workspace.projectTitle, deadline: workspace.deadline } });
  } catch (error) {
    next(error);
  }
});

router.get('/:teamId/summary', async (req, res, next) => {
  const { teamId } = req.params;
  try {
    if (!(await getMemberTeam(teamId, req.user.id))) return res.status(404).json({ error: 'Workspace not found.' });
    const [team, tasks, ratings] = await Promise.all([
      prisma.team.findUnique({
        where: { id: teamId },
        include: { members: { include: { user: { select: { id: true, name: true, skills: true, workFocus: true } } } } },
      }),
      prisma.task.findMany({
        where: { teamId },
        select: { id: true, status: true, deadline: true, archivedAt: true, assignees: { select: { userId: true } } },
      }),
      prisma.peerRating.findMany({
        where: { teamId, score: { not: null } },
        select: { ratedUserId: true, score: true },
      }),
    ]);
    if (!team) return res.status(404).json({ error: 'Workspace not found.' });

    const activeTasks = new Map();
    const completedTasks = new Map();
    tasks.filter((task) => !task.archivedAt).forEach((task) => task.assignees.forEach(({ userId }) => {
      const counts = task.status === 'Done' ? completedTasks : activeTasks;
      counts.set(userId, (counts.get(userId) || 0) + 1);
    }));

    const ratingTotals = new Map();
    ratings.forEach(({ ratedUserId, score }) => {
      const row = ratingTotals.get(ratedUserId) || { total: 0, count: 0 };
      row.total += score;
      row.count += 1;
      ratingTotals.set(ratedUserId, row);
    });

    const members = team.members.map(({ user, role, joinedAt }) => {
      const rating = ratingTotals.get(user.id);
      return {
        id: user.id,
        name: user.name,
        role,
        joinedAt,
        skills: user.skills,
        workFocus: user.workFocus,
        activeTasks: activeTasks.get(user.id) || 0,
        completedTasks: completedTasks.get(user.id) || 0,
        averageRating: rating ? Number((rating.total / rating.count).toFixed(2)) : null,
        ratingCount: rating?.count || 0,
      };
    });

    const now = new Date();
    const deadlineDate = team.deadline ? new Date(`${team.deadline.slice(0, 10)}T00:00:00`) : null;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const daysRemaining = deadlineDate ? Math.round((deadlineDate.getTime() - today.getTime()) / 86400000) : null;
    const currentTasks = tasks.filter((task) => !task.archivedAt);

    res.json({
      workspace: { id: team.id, name: team.name, projectTitle: team.projectTitle, deadline: team.deadline, daysRemaining },
      members,
      tasks: {
        total: currentTasks.length,
        archived: tasks.length - currentTasks.length,
        todo: currentTasks.filter((task) => task.status === 'To Do').length,
        inProgress: currentTasks.filter((task) => task.status === 'In Progress').length,
        done: currentTasks.filter((task) => task.status === 'Done').length,
        overdue: currentTasks.filter((task) => task.status !== 'Done' && task.deadline && new Date(`${task.deadline.slice(0, 10)}T23:59:59`) < now).length,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:teamId/members', async (req, res, next) => {
  const { teamId } = req.params;
  try {
    if (!(await getMemberTeam(teamId, req.user.id))) return res.status(404).json({ error: 'Workspace not found.' });
    const members = await prisma.teamMember.findMany({
      where: { teamId },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      select: { userId: true, name: true, role: true, joinedAt: true, user: { select: { email: true } } },
    });
    res.json({ members: members.map(({ user, ...member }) => ({ ...member, email: user.email })) });
  } catch (error) {
    next(error);
  }
});

export default router;
