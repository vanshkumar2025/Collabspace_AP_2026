import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { requireUser } from '../middleware/auth.js';
import { getMemberTeam } from '../services/workspace.service.js';
import { cleanString } from '../utils/validation.js';

const router = Router({ mergeParams: true });
router.use(requireUser);

router.get('/', async (req, res, next) => {
  const { teamId } = req.params;
  try {
    if (!(await getMemberTeam(teamId, req.user.id))) return res.status(404).json({ error: 'Workspace not found.' });
    const ratings = await prisma.peerRating.findMany({
      where: { teamId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        teamId: true,
        raterId: true,
        ratedUserId: true,
        score: true,
        feedback: true,
        raterName: true,
        ratedUserName: true,
        updatedAt: true,
      },
    });
    res.json({ ratings });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  const { teamId } = req.params;
  const ratedUserId = cleanString(req.body?.ratedUserId, 80);
  const score = Number(req.body?.score);
  const feedback = cleanString(req.body?.feedback, 2000);

  if (!ratedUserId) return res.status(400).json({ error: 'Choose a teammate to rate.' });
  if (!Number.isInteger(score) || score < 1 || score > 5) return res.status(400).json({ error: 'Choose a score from 1 to 5.' });

  try {
    const [raterMembership, ratedMembership] = await Promise.all([
      getMemberTeam(teamId, req.user.id),
      prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId: ratedUserId } }, include: { user: true } }),
    ]);
    if (!raterMembership || !ratedMembership) return res.status(404).json({ error: 'Workspace member not found.' });
    if (ratedUserId === req.user.id) return res.status(400).json({ error: 'You cannot rate yourself.' });

    const raterRecord = await prisma.user.findUnique({ where: { id: req.user.id }, select: { role: true } });
    const now = new Date().toISOString();
    const rating = await prisma.peerRating.upsert({
      where: { teamId_raterId_ratedUserId: { teamId, raterId: req.user.id, ratedUserId } },
      update: { score, feedback, updatedAt: now },
      create: {
        id: randomUUID(),
        teamId,
        raterId: req.user.id,
        ratedUserId,
        score,
        feedback,
        ratedUserName: ratedMembership.name,
        ratedUserRole: ratedMembership.role,
        raterName: req.user.name,
        raterRole: raterRecord?.role || 'Member',
        teamName: raterMembership.team.name,
        createdAt: now,
        updatedAt: now,
      },
    });
    res.status(201).json({ rating });
  } catch (error) {
    next(error);
  }
});

export default router;
