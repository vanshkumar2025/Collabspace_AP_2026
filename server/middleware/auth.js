import { prisma } from '../db/prisma.js';
import { readSession } from '../utils/session.js';

export async function requireUser(req, res, next) {
  const session = readSession(req);
  if (!session) return res.status(401).json({ error: 'Please sign in to continue.' });
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, name: true, email: true, course: true, year: true, about: true, skills: true, workFocus: true },
    });
    if (!user) return res.status(401).json({ error: 'Your session is no longer valid.' });
    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}
