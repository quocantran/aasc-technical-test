import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { integrationService } from '../services/integration.service';
import { logger } from '../utils/logger';

// Determine appropriate HTTP status code based on error classification
function resolveErrorStatus(error: any): number {
  if (error.statusCode && typeof error.statusCode === 'number') {
    return error.statusCode;
  }
  if (error instanceof ZodError || error.name === 'ZodError') {
    return 400;
  }
  const msg = (error.message || '').toLowerCase();
  if (msg.includes('missing') || msg.includes('invalid') || msg.includes('required')) {
    return 400;
  }
  if (
    msg.includes('api error') ||
    msg.includes('timeout') ||
    msg.includes('network') ||
    msg.includes('econnrefused')
  ) {
    return 502;
  }
  return 500;
}

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
    const statusCode = resolveErrorStatus(error);
    const submissionId =
      req.body?.submissionID || req.body?.submission_id || req.body?.id || 'unknown';

    logger.error(`Webhook processing encountered an error [${statusCode}]: ${error.message}`, {
      submissionId,
      statusCode,
      stack: error.stack,
    });

    res.status(statusCode).json({
      status: 'error',
      statusCode,
      message: error.message || 'Failed to process Jotform webhook',
    });
  }
}
