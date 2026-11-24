import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { port } from './config/index.js';
import { prisma } from './db/prisma.js';
import apiRouter from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();
const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Core middlewares
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

// API routes
app.use('/api', apiRouter);
app.use('/api', notFoundHandler);

// Static assets and SPA client fallback
app.use(express.static(path.join(projectRoot, 'dist')));
app.use((req, res, next) => {
  if (req.method === 'GET' && req.accepts('html')) {
    return res.sendFile(path.join(projectRoot, 'dist', 'index.html'), (error) => {
      if (error) next();
    });
  }
  next();
});

// Centralized error handling
app.use(errorHandler);

const server = app.listen(port, () => {
  console.log(`CollabSpace API listening on http://localhost:${port}`);
});

async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default app;
