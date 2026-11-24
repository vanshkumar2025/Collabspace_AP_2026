import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { requireUser } from '../middleware/auth.js';
import { getMemberTeam, isTeamLead } from '../services/workspace.service.js';
import { cleanString } from '../utils/validation.js';

const router = Router({ mergeParams: true });

router.use(requireUser);

router.get('/', async (req, res, next) => {
  const { teamId } = req.params;
  try {
    if (!(await getMemberTeam(teamId, req.user.id))) {
      return res.status(404).json({ error: 'Workspace not found.' });
    }
    const tasks = await prisma.task.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
      include: {
        assignees: { select: { userId: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    res.json({ tasks });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  const { teamId } = req.params;
  const title = cleanString(req.body?.title, 200);
  const description = cleanString(req.body?.description, 5000);
  const status = cleanString(req.body?.status, 40) || 'To Do';
  const priority = cleanString(req.body?.priority, 20) || 'medium';
  const assigneeIds = Array.isArray(req.body?.assigneeIds)
    ? [...new Set(req.body.assigneeIds.map((id) => cleanString(id, 80)).filter(Boolean))]
    : (cleanString(req.body?.assigneeId, 80) ? [cleanString(req.body.assigneeId, 80)] : []);

  if (!title) return res.status(400).json({ error: 'Task title is required.' });
  if (!['To Do', 'In Progress', 'Done'].includes(status)) return res.status(400).json({ error: 'Choose a valid task status.' });
  if (!['low', 'medium', 'high'].includes(priority)) return res.status(400).json({ error: 'Choose a valid task priority.' });

  try {
    const membership = await getMemberTeam(teamId, req.user.id);
    if (!membership) return res.status(404).json({ error: 'Workspace not found.' });

    // Guard against rapid duplicate submissions
    const recentDuplicate = await prisma.task.findFirst({
      where: {
        teamId,
        createdById: req.user.id,
        title,
        createdAt: {
          gte: new Date(Date.now() - 3000).toISOString(),
        },
      },
      include: { assignees: { select: { userId: true, name: true } } },
    });
    if (recentDuplicate) {
      return res.status(200).json({ task: recentDuplicate });
    }

    const teamMembers = assigneeIds.length
      ? await prisma.teamMember.findMany({
          where: { teamId, userId: { in: assigneeIds } },
          select: { userId: true, name: true },
        })
      : [];

    if (teamMembers.length !== assigneeIds.length) {
      return res.status(400).json({ error: 'Every assignee must be a workspace member.' });
    }

    const primaryAssignee = teamMembers[0] || null;
    const now = new Date().toISOString();
    const task = await prisma.task.create({
      data: {
        id: randomUUID(),
        title,
        description,
        status,
        priority,
        deadline: cleanString(req.body?.deadline, 40),
        teamId,
        teamName: membership.team.name,
        createdById: req.user.id,
        createdByName: req.user.name,
        assignee: primaryAssignee?.name || '',
        assigneeId: primaryAssignee?.userId || null,
        createdAt: now,
        updatedAt: now,
        assignees: teamMembers.length
          ? {
              create: teamMembers.map((member) => ({ id: randomUUID(), userId: member.userId, name: member.name })),
            }
          : undefined,
      },
      include: { assignees: { select: { userId: true, name: true } } },
    });
    res.status(201).json({ task });
  } catch (error) {
    next(error);
  }
});

router.patch('/:taskId', async (req, res, next) => {
  const { teamId, taskId } = req.params;
  const title = req.body?.title === undefined ? undefined : cleanString(req.body.title, 200);
  const description = req.body?.description === undefined ? undefined : cleanString(req.body.description, 5000);
  const status = req.body?.status === undefined ? undefined : cleanString(req.body.status, 40);
  const priority = req.body?.priority === undefined ? undefined : cleanString(req.body.priority, 20);
  const deadline = req.body?.deadline === undefined ? undefined : cleanString(req.body.deadline, 40);
  const archived = typeof req.body?.archived === 'boolean' ? req.body.archived : undefined;
  const commentText = cleanString(req.body?.comment, 2000);

  if (title !== undefined && !title) return res.status(400).json({ error: 'Task title cannot be empty.' });
  if (status !== undefined && !['To Do', 'In Progress', 'Done'].includes(status)) return res.status(400).json({ error: 'Choose a valid task status.' });
  if (priority !== undefined && !['low', 'medium', 'high'].includes(priority)) return res.status(400).json({ error: 'Choose a valid task priority.' });

  try {
    if (!(await getMemberTeam(teamId, req.user.id))) return res.status(404).json({ error: 'Workspace not found.' });
    const existing = await prisma.task.findFirst({
      where: { id: taskId, teamId },
      include: { assignees: true },
    });
    if (!existing) return res.status(404).json({ error: 'Task not found.' });

    let assigneeIds = existing.assignees.map(({ userId }) => userId);
    if (Array.isArray(req.body?.assigneeIds)) {
      assigneeIds = [...new Set(req.body.assigneeIds.map((id) => cleanString(id, 80)).filter(Boolean))];
    }

    const teamMembers = assigneeIds.length
      ? await prisma.teamMember.findMany({
          where: { teamId, userId: { in: assigneeIds } },
          select: { userId: true, name: true },
        })
      : [];

    if (teamMembers.length !== assigneeIds.length) {
      return res.status(400).json({ error: 'Every assignee must be a workspace member.' });
    }

    const now = new Date().toISOString();
    const comments = Array.isArray(existing.comments) ? existing.comments : [];
    if (commentText) {
      comments.push({ id: randomUUID(), userId: req.user.id, userName: req.user.name, text: commentText, createdAt: now });
    }
    const completedAt = status === undefined ? existing.completedAt : status === 'Done' ? (existing.completedAt || now) : '';

    const updated = await prisma.$transaction(async (tx) => {
      if (Array.isArray(req.body?.assigneeIds)) {
        await tx.taskAssignee.deleteMany({ where: { taskId: existing.id } });
        if (teamMembers.length) {
          await tx.taskAssignee.createMany({
            data: teamMembers.map((member) => ({ id: randomUUID(), taskId: existing.id, userId: member.userId, name: member.name })),
          });
        }
      }
      return tx.task.update({
        where: { id: existing.id },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(status !== undefined ? { status, completedAt } : {}),
          ...(priority !== undefined ? { priority } : {}),
          ...(deadline !== undefined ? { deadline } : {}),
          ...(archived !== undefined ? { archivedAt: archived ? (existing.archivedAt || now) : '' } : {}),
          ...(Array.isArray(req.body?.assigneeIds)
            ? {
                assigneeId: teamMembers[0]?.userId || null,
                assignee: teamMembers[0]?.name || '',
              }
            : {}),
          ...(commentText ? { comments } : {}),
          updatedAt: now,
        },
        include: { assignees: { select: { userId: true, name: true } }, createdBy: { select: { id: true, name: true } } },
      });
    });
    res.json({ task: updated });
  } catch (error) {
    next(error);
  }
});

router.delete('/:taskId', async (req, res, next) => {
  const { teamId, taskId } = req.params;
  try {
    const membership = await getMemberTeam(teamId, req.user.id);
    if (!membership) return res.status(404).json({ error: 'Workspace not found.' });

    const task = await prisma.task.findFirst({ where: { id: taskId, teamId } });
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    if (!isTeamLead(membership) && task.createdById !== req.user.id) {
      return res.status(403).json({ error: 'Only the task creator or a team lead can delete this task.' });
    }

    await prisma.task.delete({ where: { id: task.id } });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export async function getSuggestedAssignee(req, res, next) {
  const { teamId } = req.params;
  const taskText = `${cleanString(req.query.title, 200)} ${cleanString(req.query.description, 1000)}`.toLowerCase();
  try {
    if (!(await getMemberTeam(teamId, req.user.id))) return res.status(404).json({ error: 'Workspace not found.' });
    const [members, activeTasks] = await Promise.all([
      prisma.teamMember.findMany({ where: { teamId }, include: { user: { select: { skills: true, workFocus: true } } } }),
      prisma.taskAssignee.findMany({ where: { task: { teamId, status: { not: 'Done' }, archivedAt: '' } }, select: { userId: true } }),
    ]);
    const workload = new Map();
    activeTasks.forEach(({ userId }) => workload.set(userId, (workload.get(userId) || 0) + 1));
    const suggestions = members
      .map(({ userId, name, user }) => {
        const matches = [...user.skills, ...user.workFocus].filter((skill) => {
          const term = skill.toLowerCase().trim();
          return term.length > 1 && taskText.includes(term);
        });
        return { userId, name, activeTasks: workload.get(userId) || 0, matchedSkills: [...new Set(matches)] };
      })
      .sort((a, b) => b.matchedSkills.length - a.matchedSkills.length || a.activeTasks - b.activeTasks || a.name.localeCompare(b.name));
    res.json({ suggestion: suggestions[0] || null, candidates: suggestions, method: 'skill match, then lowest active workload' });
  } catch (error) {
    next(error);
  }
}

export default router;
