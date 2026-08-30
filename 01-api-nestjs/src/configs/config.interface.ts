/**
 * Strongly typed interface for application configuration properties.
 */
export interface AppConfig {
  port: number;
  nodeEnv: string;
  corsOrigin: string;
  bitrix24: {
    clientId: string;
    clientSecret: string;
    oauthUrl: string;
    apiTimeout: number;
    defaultDomain: string;
  };
  apiKey: string;
  databasePath: string;
  logLevel: string;
}
