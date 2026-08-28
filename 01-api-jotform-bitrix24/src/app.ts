import cors from 'cors';
import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import multer from 'multer';
import routes from './routes';
import { logger } from './utils/logger';

const app: Application = express();
const upload = multer();

// Global security and cross-origin middleware
app.use(helmet());
app.use(cors());

// Middleware for parsing JSON, URL-encoded bodies, and multipart form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(upload.none());

// Request logging middleware
app.use((req: Request, _res: Response, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Mount application routes
app.use('/', routes);

// Catch-all 404 handler for undefined routes
app.use((req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

export default app;
