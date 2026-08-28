import { Request, Response } from 'express';
import { integrationService } from '../services/integration.service';
import { logger } from '../utils/logger';

// Handle incoming webhook requests from Jotform
export async function handleJotformWebhook(req: Request, res: Response): Promise<void> {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  logger.info(`Received Jotform Webhook trigger from IP: ${ip}`);

  try {
    const result = await integrationService.handleWebhookSubmission(req.body);

    res.status(200).json({
      status: 'success',
      message: 'Jotform submission successfully synchronized to Bitrix24 Contact module',
      data: result,
    });
  } catch (error: any) {
    logger.error(`Webhook processing encountered an error: ${error.message}`, {
      body: req.body,
      stack: error.stack,
    });

    res.status(400).json({
      status: 'error',
      message: error.message || 'Failed to process Jotform webhook',
    });
  }
}
