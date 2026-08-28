import fs from 'fs';
import path from 'path';
import winston from 'winston';
import { config } from '../configs/env';

// Ensure log directory exists
const logDir = path.resolve(process.cwd(), config.logging.dir);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Custom log formatting template
const logFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  const metaString = Object.keys(meta).length ? JSON.stringify(meta) : '';
  return `[${timestamp}] [${level.toUpperCase()}]: ${message} ${metaString}`;
});

// Configure Winston logger instance with console and file transports
export const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        logFormat
      ),
    }),
  ],
});
