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
    const membership = await getMemberTeam(teamId, req.user.id);
    if (!membership) return res.status(404).json({ error: 'Workspace not found.' });
    const messages = await prisma.message.findMany({
      where: { teamId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
    res.json({ messages: messages.reverse() });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  const { teamId } = req.params;
  const text = cleanString(req.body?.text, 4000);
  if (!text) return res.status(400).json({ error: 'Message text is required.' });
  try {
    const membership = await getMemberTeam(teamId, req.user.id);
    if (!membership) return res.status(404).json({ error: 'Workspace not found.' });
    const message = await prisma.message.create({
      data: {
        id: randomUUID(),
        text,
        teamId,
        teamName: membership.team.name,
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

export default router;
