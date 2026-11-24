import 'dotenv/config';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Copy .env.example to .env and configure PostgreSQL.');
}

export const port = Number(process.env.PORT || 3001);
export const databaseUrl = process.env.DATABASE_URL;
export const cookieName = 'collabspace_session';
export const sessionLifetimeSeconds = 60 * 60 * 24 * 7;
export const sessionSecret = process.env.SESSION_SECRET || 'local-development-secret-change-me';
export const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && sessionSecret === 'local-development-secret-change-me') {
  throw new Error('Set SESSION_SECRET to a strong random value in production.');
}
