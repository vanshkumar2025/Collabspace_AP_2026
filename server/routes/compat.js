import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { requireUser } from '../middleware/auth.js';
import { makePasswordHash, passwordMatches } from '../utils/password.js';
import { cleanString, parseList } from '../utils/validation.js';
import {
  buildTeamPeerRatingSnapshot,
  buildWeeklyProgressReport,
} from '../services/insights.service.js';

const router = Router();
router.use(requireUser);

const pendingTaskCreations = new Map();

// Helper to resolve the active team for a user
async function resolveUserTeam(userId, teamId) {
  if (teamId) {
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
      include: {
        team: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    skills: true,
                    workFocus: true,
                    course: true,
                    year: true,
                    about: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (membership?.team) return membership.team;

    const team = await prisma.team.findFirst({
      where: { id: teamId, createdById: userId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                skills: true,
                workFocus: true,
                course: true,
                year: true,
                about: true,
              },
            },
          },
        },
      },
    });
    return team;
  }

  // Fallback to first team the user is part of
  const membership = await prisma.teamMember.findFirst({
    where: { userId },
    include: {
      team: {
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  skills: true,
                  workFocus: true,
                  course: true,
                  year: true,
                  about: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  });
  if (membership?.team) return membership.team;

  return prisma.team.findFirst({
    where: { createdById: userId },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              skills: true,
              workFocus: true,
              course: true,
              year: true,
              about: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

function formatTeamForClient(team) {
  if (!team) return null;
  return {
    id: team.id,
    name: team.name,
    projectTitle: team.projectTitle || `${team.name} Project`,
    deadline: team.deadline || '',
    createdBy: team.createdById,
    createdAt: team.createdAt,
    members: (team.members || []).map((m) => ({
      userId: m.userId,
      name: m.name,
      email: m.user?.email || '',
      role: m.role || 'Member',
      joinedAt: m.joinedAt || team.createdAt,
      skills: m.user?.skills || [],
      workFocus: m.user?.workFocus || [],
      course: m.user?.course || '',
      year: m.user?.year || '',
      about: m.user?.about || '',
    })),
  };
}

/* ── Workspaces & Invitations for User Hub ───────────────── */

// GET /api/user/teams
router.get('/user/teams', async (req, res, next) => {
  try {
    const teams = await prisma.team.findMany({
      where: {
        OR: [
          { members: { some: { userId: req.user.id } } },
          { createdById: req.user.id },
        ],
      },
      include: {
        members: { select: { userId: true, name: true, role: true, joinedAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const leaderTeams = [];
    const memberTeams = [];

    for (const t of teams) {
      const memberObj = t.members.find((m) => m.userId === req.user.id);
      const isLeader =
        t.createdById === req.user.id || memberObj?.role === 'Lead' || memberObj?.role === 'Leader';
      const info = {
        id: t.id,
        name: t.name,
        projectTitle: t.projectTitle || `${t.name} Project`,
        role: memberObj?.role || (isLeader ? 'Leader' : 'Member'),
        memberCount: t.members.length,
        joinedAt: memberObj?.joinedAt || t.createdAt,
        createdAt: t.createdAt,
        deadline: t.deadline || '',
      };
      if (isLeader) {
        leaderTeams.push(info);
      } else {
        memberTeams.push(info);
      }
    }

    res.json({ leaderTeams, memberTeams });
  } catch (error) {
    next(error);
  }
});

// GET /api/user/invitations
router.get('/user/invitations', async (req, res, next) => {
  try {
    const invitations = await prisma.teamInvitation.findMany({
      where: { userId: req.user.id },
      include: { team: { select: { id: true, name: true } } },
      orderBy: { invitedAt: 'desc' },
    });
    res.json({
      invitations: invitations.map((inv) => ({
        id: inv.id,
        teamId: inv.teamId,
        teamName: inv.team?.name || 'Workspace',
        invitedBy: inv.invitedBy,
        invitedByName: inv.invitedBy,
        invitedAt: inv.invitedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/team/invitations/accept
router.post('/team/invitations/accept', async (req, res, next) => {
  const teamId = cleanString(req.body?.teamId, 80);
  try {
    const invitation = await prisma.teamInvitation.findFirst({
      where: { teamId, userId: req.user.id },
    });
    if (!invitation) return res.status(404).json({ error: 'Invitation not found.' });

    await prisma.$transaction([
      prisma.teamMember.upsert({
        where: { teamId_userId: { teamId, userId: req.user.id } },
        update: { role: invitation.role || 'Member' },
        create: {
          id: randomUUID(),
          teamId,
          userId: req.user.id,
          name: req.user.name,
          role: invitation.role || 'Member',
          joinedAt: new Date().toISOString(),
        },
      }),
      prisma.teamInvitation.delete({ where: { id: invitation.id } }),
    ]);

    res.json({ ok: true, teamId });
  } catch (error) {
    next(error);
  }
});

// POST /api/team/invitations/reject
router.post('/team/invitations/reject', async (req, res, next) => {
  const teamId = cleanString(req.body?.teamId, 80);
  try {
    const invitation = await prisma.teamInvitation.findFirst({
      where: { teamId, userId: req.user.id },
    });
    if (invitation) {
      await prisma.teamInvitation.delete({ where: { id: invitation.id } });
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

/* ── Team / Workspace Details ────────────────────────────── */

// GET /api/team
router.get('/team', async (req, res, next) => {
  const teamId = cleanString(req.query.teamId, 80);
  try {
    const team = await resolveUserTeam(req.user.id, teamId);
    if (!team) return res.json({ team: null });
    res.json({ team: formatTeamForClient(team) });
  } catch (error) {
    next(error);
  }
});

// POST /api/team
router.post('/team', async (req, res, next) => {
  const name = cleanString(req.body?.name, 100);
  const projectTitle = cleanString(req.body?.projectTitle || req.body?.alias, 160) || `${name} Project`;
  const deadline = cleanString(req.body?.deadline, 40) || new Date(Date.now() + 30 * 86400000).toISOString();
  if (name.length < 2) return res.status(400).json({ error: 'Team name must be at least 2 characters.' });

  try {
    const now = new Date().toISOString();
    const team = await prisma.team.create({
      data: {
        id: randomUUID(),
        name,
        projectTitle,
        deadline,
        createdById: req.user.id,
        createdAt: now,
        members: {
          create: {
            id: randomUUID(),
            userId: req.user.id,
            name: req.user.name,
            role: 'Leader',
            joinedAt: now,
          },
        },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, skills: true, workFocus: true } },
          },
        },
      },
    });

    res.status(201).json({ team: formatTeamForClient(team) });
  } catch (error) {
    next(error);
  }
});

// PUT /api/team
router.put('/team', async (req, res, next) => {
  const teamId = cleanString(req.body?.teamId, 80);
  const name = req.body?.name === undefined ? undefined : cleanString(req.body.name, 100);
  const projectTitle = req.body?.projectTitle === undefined ? undefined : cleanString(req.body.projectTitle, 160);
  const deadline = req.body?.deadline === undefined ? undefined : cleanString(req.body.deadline, 40);

  try {
    const team = await resolveUserTeam(req.user.id, teamId);
    if (!team) return res.status(404).json({ error: 'Team not found.' });

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.team.update({
        where: { id: team.id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(projectTitle !== undefined ? { projectTitle } : {}),
          ...(deadline !== undefined ? { deadline } : {}),
        },
        include: {
          members: {
            include: { user: { select: { id: true, name: true, email: true, skills: true, workFocus: true } } },
          },
        },
      });
      if (name !== undefined) {
        await tx.task.updateMany({ where: { teamId: saved.id }, data: { teamName: name } });
        await tx.message.updateMany({ where: { teamId: saved.id }, data: { teamName: name } });
        await tx.peerRating.updateMany({ where: { teamId: saved.id }, data: { teamName: name } });
      }
      return saved;
    });

    res.json({ team: formatTeamForClient(updated) });
  } catch (error) {
    next(error);
  }
});

// POST /api/team/members (invite teammate)
router.post('/team/members', async (req, res, next) => {
  const teamId = cleanString(req.body?.teamId, 80);
  const email = cleanString(req.body?.email, 254).toLowerCase();
  const role = cleanString(req.body?.role, 40) || 'Member';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }

  try {
    const team = await resolveUserTeam(req.user.id, teamId);
    if (!team) return res.status(404).json({ error: 'Team not found.' });

    const invitee = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true },
    });
    if (!invitee) {
      return res.status(404).json({ error: 'That person needs a CollabSpace account before they can be invited.' });
    }
    if (invitee.id === req.user.id) {
      return res.status(400).json({ error: 'You are already in this workspace.' });
    }

    const existingMember = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: team.id, userId: invitee.id } },
    });
    if (existingMember) {
      return res.status(409).json({ error: 'That person is already a workspace member.' });
    }

    const invitation = await prisma.teamInvitation.upsert({
      where: { teamId_userId: { teamId: team.id, userId: invitee.id } },
      update: { role, invitedAt: new Date().toISOString(), invitedBy: req.user.name },
      create: {
        id: randomUUID(),
        teamId: team.id,
        userId: invitee.id,
        name: invitee.name,
        email: invitee.email,
        role,
        invitedAt: new Date().toISOString(),
        invitedBy: req.user.name,
      },
    });

    res.status(201).json({ ok: true, invitation });
  } catch (error) {
    next(error);
  }
});

/* ── Tasks API ───────────────────────────────────────────── */

// GET /api/tasks
router.get('/tasks', async (req, res, next) => {
  const teamId = cleanString(req.query.teamId, 80);
  try {
    const team = await resolveUserTeam(req.user.id, teamId);
    if (!team) return res.json({ tasks: [] });

    const tasks = await prisma.task.findMany({
      where: { teamId: team.id, archivedAt: '' },
      orderBy: { createdAt: 'desc' },
      include: {
        assignees: { select: { userId: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    res.json({
      tasks: tasks.map((t) => ({
        ...t,
        assigneeId: t.assigneeId || (t.assignees[0]?.userId || null),
        assignee: t.assignee || (t.assignees[0]?.name || ''),
      })),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/tasks/archive
router.get('/tasks/archive', async (req, res, next) => {
  const teamId = cleanString(req.query.teamId, 80);
  try {
    const team = await resolveUserTeam(req.user.id, teamId);
    if (!team) return res.json({ tasks: [] });

    const tasks = await prisma.task.findMany({
      where: { teamId: team.id, archivedAt: { not: '' } },
      orderBy: { updatedAt: 'desc' },
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

// POST /api/tasks
router.post('/tasks', async (req, res, next) => {
  const teamId = cleanString(req.body?.teamId || req.query.teamId, 80);
  const title = cleanString(req.body?.title, 200);
  const description = cleanString(req.body?.description, 5000);
  const status = cleanString(req.body?.status, 40) || 'To Do';
  const priority = cleanString(req.body?.priority, 20) || 'medium';
  const deadline = cleanString(req.body?.deadline, 40);

  if (!title) return res.status(400).json({ error: 'Task title is required.' });

  try {
    const team = await resolveUserTeam(req.user.id, teamId);
    if (!team) return res.status(404).json({ error: 'Workspace not found.' });

    const lockKey = `${req.user.id}:${team.id}:${title}`;
    if (pendingTaskCreations.has(lockKey)) {
      const existingTask = await pendingTaskCreations.get(lockKey);
      if (existingTask) {
        return res.status(200).json({ task: existingTask });
      }
    }

    let resolveLock;
    const lockPromise = new Promise((resolve) => { resolveLock = resolve; });
    pendingTaskCreations.set(lockKey, lockPromise);

    // Guard against rapid duplicate submissions (e.g. double click or stacked listeners)
    const recentDuplicate = await prisma.task.findFirst({
      where: {
        teamId: team.id,
        createdById: req.user.id,
        title,
        createdAt: {
          gte: new Date(Date.now() - 3000).toISOString(),
        },
      },
      include: { assignees: { select: { userId: true, name: true } } },
    });
    if (recentDuplicate) {
      if (resolveLock) resolveLock(recentDuplicate);
      setTimeout(() => pendingTaskCreations.delete(lockKey), 2500);
      return res.status(200).json({ task: recentDuplicate });
    }

    let assigneeIds = [];
    if (Array.isArray(req.body?.assignees)) {
      assigneeIds = req.body.assignees.map((a) => (typeof a === 'string' ? a : a.id || a.userId));
    } else if (Array.isArray(req.body?.assigneeIds)) {
      assigneeIds = req.body.assigneeIds;
    } else if (req.body?.assigneeId) {
      assigneeIds = [req.body.assigneeId];
    }
    assigneeIds = [...new Set(assigneeIds.map((id) => cleanString(id, 80)).filter(Boolean))];

    const teamMembers = assigneeIds.length
      ? await prisma.teamMember.findMany({
          where: { teamId: team.id, userId: { in: assigneeIds } },
          select: { userId: true, name: true },
        })
      : [];

    const primaryAssignee = teamMembers[0] || null;
    const now = new Date().toISOString();

    const task = await prisma.task.create({
      data: {
        id: randomUUID(),
        title,
        description,
        status,
        priority,
        deadline,
        teamId: team.id,
        teamName: team.name,
        createdById: req.user.id,
        createdByName: req.user.name,
        assignee: primaryAssignee?.name || '',
        assigneeId: primaryAssignee?.userId || null,
        createdAt: now,
        updatedAt: now,
        assignees: teamMembers.length
          ? {
              create: teamMembers.map((member) => ({
                id: randomUUID(),
                userId: member.userId,
                name: member.name,
              })),
            }
          : undefined,
      },
      include: { assignees: { select: { userId: true, name: true } } },
    });

    if (resolveLock) resolveLock(task);
    setTimeout(() => pendingTaskCreations.delete(lockKey), 2500);
    res.status(201).json({ task });
  } catch (error) {
    const lockKey = `${req.user?.id}:${req.body?.teamId || req.query?.teamId}:${title}`;
    pendingTaskCreations.delete(lockKey);
    next(error);
  }
});

// PUT /api/tasks/:id
router.put('/tasks/:id', async (req, res, next) => {
  const taskId = req.params.id;
  const title = req.body?.title === undefined ? undefined : cleanString(req.body.title, 200);
  const description = req.body?.description === undefined ? undefined : cleanString(req.body.description, 5000);
  const status = req.body?.status === undefined ? undefined : cleanString(req.body.status, 40);
  const priority = req.body?.priority === undefined ? undefined : cleanString(req.body.priority, 20);
  const deadline = req.body?.deadline === undefined ? undefined : cleanString(req.body.deadline, 40);
  const archived = typeof req.body?.archived === 'boolean' ? req.body.archived : undefined;
  const commentText = cleanString(req.body?.comment, 2000);

  try {
    const existing = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignees: true },
    });
    if (!existing) return res.status(404).json({ error: 'Task not found.' });

    let teamMembers = null;
    if (Array.isArray(req.body?.assignees) || Array.isArray(req.body?.assigneeIds)) {
      const ids = Array.isArray(req.body?.assignees)
        ? req.body.assignees.map((a) => (typeof a === 'string' ? a : a.id || a.userId))
        : req.body.assigneeIds;
      const cleanIds = [...new Set(ids.map((id) => cleanString(id, 80)).filter(Boolean))];
      teamMembers = await prisma.teamMember.findMany({
        where: { teamId: existing.teamId, userId: { in: cleanIds } },
        select: { userId: true, name: true },
      });
    }

    const now = new Date().toISOString();
    const comments = Array.isArray(existing.comments) ? existing.comments : [];
    if (commentText) {
      comments.push({ id: randomUUID(), userId: req.user.id, userName: req.user.name, text: commentText, createdAt: now });
    }
    const completedAt = status === undefined ? existing.completedAt : status === 'Done' ? (existing.completedAt || now) : '';

    const updated = await prisma.$transaction(async (tx) => {
      if (teamMembers) {
        await tx.taskAssignee.deleteMany({ where: { taskId: existing.id } });
        if (teamMembers.length) {
          await tx.taskAssignee.createMany({
            data: teamMembers.map((member) => ({
              id: randomUUID(),
              taskId: existing.id,
              userId: member.userId,
              name: member.name,
            })),
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
          ...(teamMembers
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

// DELETE /api/tasks/:id
router.delete('/tasks/:id', async (req, res, next) => {
  const taskId = req.params.id;
  try {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    await prisma.task.delete({ where: { id: taskId } });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

/* ── Messages API ────────────────────────────────────────── */

// GET /api/messages
router.get('/messages', async (req, res, next) => {
  const teamId = cleanString(req.query.teamId, 80);
  try {
    const team = await resolveUserTeam(req.user.id, teamId);
    if (!team) return res.json({ messages: [] });

    const messages = await prisma.message.findMany({
      where: { teamId: team.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
    res.json({ messages: messages.reverse() });
  } catch (error) {
    next(error);
  }
});

// POST /api/messages
router.post('/messages', async (req, res, next) => {
  const teamId = cleanString(req.body?.teamId || req.query.teamId, 80);
  const text = cleanString(req.body?.text, 4000);
  if (!text) return res.status(400).json({ error: 'Message text is required.' });

  try {
    const team = await resolveUserTeam(req.user.id, teamId);
    if (!team) return res.status(404).json({ error: 'Team not found.' });

    const message = await prisma.message.create({
      data: {
        id: randomUUID(),
        text,
        teamId: team.id,
        teamName: team.name,
        userId: req.user.id,
        userName: req.user.name,
        createdAt: new Date().toISOString(),
      },
    });
    res.status(201).json({ message });
  } catch (error) {
    next(error);
  }
});

/* ── Peer Ratings API ────────────────────────────────────── */

// GET /api/peer-ratings
router.get('/peer-ratings', async (req, res, next) => {
  const teamId = cleanString(req.query.teamId, 80);
  try {
    const team = await resolveUserTeam(req.user.id, teamId);
    if (!team) {
      return res.json({
        peerRatings: {
          currentUserRatings: {},
          members: [],
          summary: { eligibleRaters: 0, participationCount: 0, teamAverageScore: 0, totalRatings: 0 },
        },
      });
    }

    const ratings = await prisma.peerRating.findMany({
      where: { teamId: team.id },
    });

    const peerRatings = buildTeamPeerRatingSnapshot(team, ratings, req.user.id);
    res.json({ peerRatings });
  } catch (error) {
    next(error);
  }
});

// PUT /api/peer-ratings
router.put('/peer-ratings', async (req, res, next) => {
  const teamId = cleanString(req.body?.teamId || req.query.teamId, 80);
  const ratings = Array.isArray(req.body?.ratings) ? req.body.ratings : [];

  try {
    const team = await resolveUserTeam(req.user.id, teamId);
    if (!team) return res.status(404).json({ error: 'Team not found.' });

    const now = new Date().toISOString();
    for (const r of ratings) {
      const ratedUserId = cleanString(r.ratedUserId, 80);
      const score = Number(r.score);
      const feedback = cleanString(r.feedback, 2000);
      if (!ratedUserId || ratedUserId === req.user.id) continue;
      if (!Number.isInteger(score) || score < 1 || score > 5) continue;

      const ratedMember = team.members.find((m) => m.userId === ratedUserId);

      await prisma.peerRating.upsert({
        where: {
          teamId_raterId_ratedUserId: {
            teamId: team.id,
            raterId: req.user.id,
            ratedUserId,
          },
        },
        update: { score, feedback, updatedAt: now },
        create: {
          id: randomUUID(),
          teamId: team.id,
          raterId: req.user.id,
          ratedUserId,
          score,
          feedback,
          raterName: req.user.name,
          raterRole: 'Member',
          ratedUserName: ratedMember?.name || '',
          ratedUserRole: ratedMember?.role || 'Member',
          teamName: team.name,
          createdAt: now,
          updatedAt: now,
        },
      });
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

/* ── Weekly Report & Analytics ───────────────────────────── */

// GET /api/weekly-report
router.get('/weekly-report', async (req, res, next) => {
  const teamId = cleanString(req.query.teamId, 80);
  try {
    const team = await resolveUserTeam(req.user.id, teamId);
    if (!team) return res.status(404).json({ error: 'Team not found.' });

    const [tasks, messages, ratings] = await Promise.all([
      prisma.task.findMany({ where: { teamId: team.id } }),
      prisma.message.findMany({ where: { teamId: team.id } }),
      prisma.peerRating.findMany({ where: { teamId: team.id } }),
    ]);

    const report = buildWeeklyProgressReport({
      messages,
      now: new Date(),
      ratings,
      tasks,
      team,
    });

    res.json({ report });
  } catch (error) {
    next(error);
  }
});

// GET /api/analytics
router.get('/analytics', async (req, res, next) => {
  const teamId = cleanString(req.query.teamId, 80);
  try {
    const team = await resolveUserTeam(req.user.id, teamId);
    if (!team) return res.status(404).json({ error: 'Team not found.' });

    const tasks = await prisma.task.findMany({
      where: { teamId: team.id },
      include: { assignees: true },
    });

    const totalTasks = tasks.length;
    const completed = tasks.filter((t) => t.status === 'Done').length;
    const inProgress = tasks.filter((t) => t.status === 'In Progress').length;
    const todo = tasks.filter((t) => t.status === 'To Do').length;
    const now = new Date();
    const overdue = tasks.filter((t) => t.status !== 'Done' && t.deadline && new Date(`${t.deadline.slice(0, 10)}T23:59:59`) < now).length;

    const contributions = {};
    for (const member of team.members) {
      const memberTasks = tasks.filter((t) =>
        t.assigneeId === member.userId ||
        t.assignees?.some((a) => a.userId === member.userId)
      );
      const memberCompleted = memberTasks.filter((t) => t.status === 'Done').length;
      contributions[member.name] = {
        total: memberTasks.length,
        completed: memberCompleted,
        percentage: totalTasks > 0 ? Math.round((memberTasks.length / totalTasks) * 100) : 0,
        role: member.role || 'Member',
      };
    }

    res.json({ totalTasks, completed, inProgress, todo, overdue, contributions });
  } catch (error) {
    next(error);
  }
});

/* ── Profile & Password ──────────────────────────────────── */

// PUT /api/users/profile
router.put('/users/profile', async (req, res, next) => {
  const name = cleanString(req.body?.name, 80);
  if (name.length < 2) return res.status(400).json({ error: 'Name must be at least 2 characters.' });

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: req.user.id },
        data: {
          name,
          course: cleanString(req.body?.course, 120),
          year: cleanString(req.body?.year, 40),
          about: cleanString(req.body?.about, 1000),
          skills: parseList(req.body?.skills),
          workFocus: parseList(req.body?.workFocus),
          profileUpdatedAt: new Date().toISOString(),
        },
        select: { id: true, name: true, email: true, course: true, year: true, about: true, skills: true, workFocus: true },
      });
      await tx.teamMember.updateMany({ where: { userId: req.user.id }, data: { name } });
      await tx.taskAssignee.updateMany({ where: { userId: req.user.id }, data: { name } });
      await tx.task.updateMany({ where: { createdById: req.user.id }, data: { createdByName: name } });
      await tx.task.updateMany({ where: { assigneeId: req.user.id }, data: { assignee: name } });
      return user;
    });

    res.json({ user: updated });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/password/change
router.post('/auth/password/change', async (req, res, next) => {
  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

  if (newPassword.length < 10 || newPassword.length > 128) {
    return res.status(400).json({ error: 'New password must be 10 to 128 characters long.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !(await passwordMatches(currentPassword, user.passwordHash))) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    const passwordHash = await makePasswordHash(newPassword);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash },
    });

    res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    next(error);
  }
});

export default router;
