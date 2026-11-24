import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  cookieName,
  isProduction,
  sessionLifetimeSeconds,
  sessionSecret,
} from '../config/index.js';

export function signSession(userId) {
  const payload = Buffer.from(JSON.stringify({
    userId,
    expiresAt: Date.now() + sessionLifetimeSeconds * 1000,
  })).toString('base64url');
  const signature = createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function readSession(req) {
  const cookieHeader = req.headers.cookie || '';
  const token = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
  if (!token) return null;

  const [payload, providedSignature] = token.split('.');
  if (!payload || !providedSignature) return null;
  const expectedSignature = createHmac('sha256', sessionSecret).update(payload).digest();
  let actualSignature;
  try {
    actualSignature = Buffer.from(providedSignature, 'base64url');
  } catch {
    return null;
  }
  if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof session.userId !== 'string' || session.expiresAt < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function setSessionCookie(res, userId) {
  const secure = isProduction ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${cookieName}=${signSession(userId)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${sessionLifetimeSeconds}${secure}`,
  );
}

export function clearSessionCookie(res) {
  const secure = isProduction ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${cookieName}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`);
}
