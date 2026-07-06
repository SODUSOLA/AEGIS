import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { errorMiddleware } from './middleware/error.middleware';
import { registerRoutes } from './routes';
import { logger } from './lib/logger';

// Creates and configures the Express application with middleware, routes, and error handling
export function createApp(): Application {
  const app = express();

  // Trust proxy headers so rate-limiting and IP logging work behind a reverse proxy
  app.set('trust proxy', true);
  app.use(helmet());

  app.use(
    cors({
      origin: env.NODE_ENV === 'production' ? [] : '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Log every incoming request
  app.use((req, _res, next) => {
    logger.info('Incoming request', {
      method: req.method,
      path: req.path,
      ip: req.ip,
    });
    next();
  });

  // Apply rate-limiting to all /api routes
  const limiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please slow down.' },
  });
  app.use('/api', limiter);

  registerRoutes(app);

  // Must be registered last so it catches errors from all preceding middleware/routes
  app.use(errorMiddleware);

  return app;
}
