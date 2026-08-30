import { LoggerService } from '@nestjs/common';
import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Custom Winston logger implementing NestJS LoggerService with console and file transports.
 */
export class WinstonLogger implements LoggerService {
  private logger: winston.Logger;

  constructor() {
    const logDir = path.resolve(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, context, trace }) => {
        const ctx = context ? `[${context}] ` : '';
        const trc = trace ? `\nStack: ${trace}` : '';
        return `[${timestamp}] [${level.toUpperCase()}] ${ctx}${message}${trc}`;
      }),
    );

    const consoleFormat = winston.format.combine(
      winston.format.colorize({ all: true }),
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, context }) => {
        const ctx = context ? `\x1b[33m[${context}]\x1b[0m ` : '';
        return `[${timestamp}] ${level}: ${ctx}${message}`;
      }),
    );

    this.logger = winston.createLogger({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      format: logFormat,
      transports: [
        new winston.transports.Console({
          format: consoleFormat,
        }),
        new winston.transports.File({
          filename: path.join(logDir, 'error.log'),
          level: 'error',
          maxsize: 5242880, // 5MB limit
          maxFiles: 5,
        }),
        new winston.transports.File({
          filename: path.join(logDir, 'combined.log'),
          maxsize: 10485760, // 10MB limit
          maxFiles: 5,
        }),
      ],
    });
  }

  log(message: any, context?: string) {
    this.logger.info(
      typeof message === 'object' ? JSON.stringify(message) : message,
      { context },
    );
  }

  error(message: any, trace?: string, context?: string) {
    this.logger.error(
      typeof message === 'object' ? JSON.stringify(message) : message,
      { trace, context },
    );
  }

  warn(message: any, context?: string) {
    this.logger.warn(
      typeof message === 'object' ? JSON.stringify(message) : message,
      { context },
    );
  }

  debug(message: any, context?: string) {
    this.logger.debug(
      typeof message === 'object' ? JSON.stringify(message) : message,
      { context },
    );
  }

  verbose(message: any, context?: string) {
    this.logger.verbose(
      typeof message === 'object' ? JSON.stringify(message) : message,
      { context },
    );
  }
}
