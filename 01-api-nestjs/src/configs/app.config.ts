import { registerAs } from '@nestjs/config';
import { AppConfig } from './config.interface';
import { BITRIX_CONSTANTS } from '../common/constants/bitrix.constants';

/**
 * Loads and normalizes environment variables from `.env` with enterprise default fallbacks.
 */
export default registerAs('app', (): AppConfig => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  bitrix24: {
    clientId: process.env.BITRIX24_CLIENT_ID || '',
    clientSecret: process.env.BITRIX24_CLIENT_SECRET || '',
    oauthUrl:
      process.env.BITRIX24_OAUTH_URL || BITRIX_CONSTANTS.OAUTH.TOKEN_ENDPOINT,
    apiTimeout: parseInt(process.env.BITRIX24_API_TIMEOUT, 10) || 10000,
    defaultDomain: process.env.BITRIX24_DEFAULT_DOMAIN || 'default',
  },
  apiKey: process.env.API_KEY || 'aasc_technical_test_secret_key_2026',
  databasePath: process.env.DATABASE_PATH || 'data/tokens.sqlite',
  logLevel:
    process.env.LOG_LEVEL ||
    (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
}));
