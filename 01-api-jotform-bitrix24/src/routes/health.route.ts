import { Router } from 'express';
import { getHealthStatus } from '../controllers/health.controller';

const router = Router();

// Health check endpoint route
router.get('/', getHealthStatus);

export default router;
