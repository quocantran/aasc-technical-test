import { Request, Response } from 'express';
import { config } from '../configs/env';

// Return service health status and active configuration metadata
export function getHealthStatus(_req: Request, res: Response): void {
  res.status(200).json({
    status: 'healthy',
    service: 'jotform-bitrix24-integration',
    uptime: `${Math.floor(process.uptime())}s`,
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
    configuration: {
      bitrix24: Boolean(config.bitrix24.webhookUrl),
      jotformApiKey: Boolean(config.jotform.apiKey),
      jotformFormId: config.jotform.formId || 'not_configured',
    },
  });
}
