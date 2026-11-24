import { Router } from 'express';
import healthRouter from './health.js';
import authRouter from './auth.js';
import workspacesRouter from './workspaces.js';
import { userInvitationsRouter } from './invitations.js';
import compatRouter from './compat.js';

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/invitations', userInvitationsRouter);
router.use('/workspaces', workspacesRouter);
router.use('/', compatRouter);

export default router;
