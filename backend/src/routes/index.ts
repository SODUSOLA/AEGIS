import { Application } from 'express';
import healthRouter from './health.routes';
import merchantRouter from '../modules/merchant/merchant.routes';
import planRouter from '../modules/plan/plan.routes';
import customerRouter from '../modules/customer/customer.routes';
import subscriptionRouter from '../modules/subscription/subscription.routes';
import inboundWebhookRouter from '../modules/webhook/inbound/inbound.routes';
import outboundWebhookRouter from '../modules/webhook/outbound/outbound.routes';
import dunningRouter from '../modules/dunning/dunning.routes';
import dashboardRouter from '../modules/dashboard/dashboard.routes';

const API_PREFIX = '/api/v1';

/** Mounts all route modules onto the Express application. */
export function registerRoutes(app: Application): void {
  app.use('/health', healthRouter);

  app.use(`${API_PREFIX}/merchants`, merchantRouter);
  app.use(`${API_PREFIX}/plans`, planRouter);
  app.use(`${API_PREFIX}/customers`, customerRouter);
  app.use(`${API_PREFIX}/subscriptions`, subscriptionRouter);
  app.use(`${API_PREFIX}/dunning`, dunningRouter);
  app.use(`${API_PREFIX}/dashboard`, dashboardRouter);
  app.use(`${API_PREFIX}/webhooks`, inboundWebhookRouter);
  app.use(`${API_PREFIX}/webhooks`, outboundWebhookRouter);

  // Catch-all 404 for undefined routes
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      message: 'Route not found',
    });
  });
}
