import { Application } from 'express';
import healthRouter from './health.routes';
import merchantRouter from '../modules/merchant/merchant.routes';
import planRouter from '../modules/plan/plan.routes';
import customerRouter from '../modules/customer/customer.routes';
import subscriptionRouter from '../modules/subscription/subscription.routes';
import webhookRouter from '../modules/webhook/webhook.routes';
import dunningRouter from '../modules/dunning/dunning.routes';

const API_PREFIX = '/api/v1';

export function registerRoutes(app: Application): void {
  app.use('/health', healthRouter);

  app.use(`${API_PREFIX}/merchants`, merchantRouter);
  app.use(`${API_PREFIX}/plans`, planRouter);
  app.use(`${API_PREFIX}/customers`, customerRouter);
  app.use(`${API_PREFIX}/subscriptions`, subscriptionRouter);
  app.use(`${API_PREFIX}/dunning`, dunningRouter);
  app.use(`${API_PREFIX}/webhooks`, webhookRouter);

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      message: 'Route not found',
    });
  });
}
