import { Router } from 'express';
import { handleJotformWebhook } from '../controllers/webhook.controller';

const router = Router();

// Route for receiving Jotform webhook triggers
router.post('/jotform', handleJotformWebhook);

export default router;
