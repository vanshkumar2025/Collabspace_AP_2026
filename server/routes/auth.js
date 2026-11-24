import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { requireUser } from '../middleware/auth.js';
import { makePasswordHash, passwordMatches } from '../utils/password.js';
import { clearSessionCookie, setSessionCookie } from '../utils/session.js';
import { cleanString, parseList } from '../utils/validation.js';

const router = Router();

router.post('/register', async (req, res, next) => {
  const name = cleanString(req.body?.name, 80);
  const email = cleanString(req.body?.email, 254).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (name.length < 2) return res.status(400).json({ error: 'Enter your name (at least 2 characters).' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 10 || password.length > 128) {
    return res.status(400).json({ error: 'Your password must be 10 to 128 characters long.' });
  }

  try {
    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        email,
        name,
        passwordHash: await makePasswordHash(password),
        course: cleanString(req.body?.course, 120),
        year: cleanString(req.body?.year, 40),
        about: cleanString(req.body?.about, 1000),
        skills: parseList(req.body?.skills),
        workFocus: parseList(req.body?.workFocus),
        createdAt: new Date().toISOString(),
      },
      select: { id: true, name: true, email: true, course: true, year: true, about: true, skills: true, workFocus: true },
    });
    setSessionCookie(res, user.id);
    res.status(201).json({ user });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'An account with that email already exists.' });
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  const email = cleanString(req.body?.email, 254).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await passwordMatches(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }
    setSessionCookie(res, user.id);
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        course: user.course,
        year: user.year,
        about: user.about,
        skills: user.skills,
        workFocus: user.workFocus,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireUser, (req, res) => {
  res.json({ user: req.user });
});

router.patch('/profile', requireUser, async (req, res, next) => {
  const name = cleanString(req.body?.name, 80);
  if (name.length < 2) return res.status(400).json({ error: 'Name must be at least 2 characters.' });
  try {
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
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
      return updated;
    });
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

export default router;
