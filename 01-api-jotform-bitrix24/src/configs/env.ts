import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Environment configuration object
export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  bitrix24: {
    webhookUrl: process.env.BITRIX24_WEBHOOK_URL || '',
  },
  jotform: {
    formId: process.env.JOTFORM_FORM_ID || '',
    apiKey: process.env.JOTFORM_API_KEY || '',
    apiBaseUrl: process.env.JOTFORM_API_BASE_URL || 'https://api.jotform.com',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || 'logs',
  },
};

// Validate mandatory environment variables at startup
export function validateConfig(): void {
  if (!config.bitrix24.webhookUrl) {
    throw new Error('CRITICAL: BITRIX24_WEBHOOK_URL is not defined in .env');
  }
  if (!config.jotform.apiKey) {
    throw new Error('CRITICAL: JOTFORM_API_KEY is not defined in .env');
  }
}
