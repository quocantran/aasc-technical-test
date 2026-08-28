import { Router } from 'express';
import healthRoutes from './health.route';
import webhookRoutes from './webhook.route';

const router = Router();

// Root route welcoming message and directory
router.get('/', (_req, res) => {
  res.status(200).json({
    message: 'Jotform to Bitrix24 Integration API is running',
    endpoints: {
      health: 'GET /health',
    },
  });
});

// Mount module routes
router.use('/health', healthRoutes);
router.use('/webhook', webhookRoutes);

export default router;
