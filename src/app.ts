import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';

import { config } from './config';
import { logger } from './common/utils';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

// Controllers
import { providerController, storagePlansController } from './modules/providers';
import { paymentController } from './modules/payments';
import { orderController } from './modules/orders';
import { userController } from './modules/users';

// ============================================
// Express Application
// ============================================

export function createApp(): Express {
  const app = express();

  // ============================================
  // Middleware
  // ============================================

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: false, // Disable for development UI
  }));

  // CORS
  app.use(cors({
    origin: config.security.corsOrigins,
    credentials: true,
  }));

  // Compression
  app.use(compression());

  // Request logging
  app.use(morgan('combined', {
    stream: {
      write: (message: string) => logger.info(message.trim()),
    },
  }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
      },
    },
  });
  app.use('/api', limiter);

  // Body parsing
  // Raw body for Stripe webhooks
  app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
  // JSON body for other routes
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Static files for UI
  app.use(express.static(path.join(__dirname, '../public')));

  // View engine for simple UI
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '../views'));

  // ============================================
  // API Routes
  // ============================================

  // Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
      },
    });
  });

  // API routes
  app.use('/api/providers', providerController);
  app.use('/api/storage', storagePlansController);
  app.use('/api/payments', paymentController);
  app.use('/api/orders', orderController);
  app.use('/api/users', userController);

  // ============================================
  // UI Routes
  // ============================================

  // Homepage - Storage plans listing
  app.get('/', async (req: Request, res: Response) => {
    res.render('index', {
      title: 'DePIN Storage Aggregator',
      stripePublishableKey: config.stripe.publishableKey,
    });
  });

  // Orders page
  app.get('/orders', (req: Request, res: Response) => {
    res.render('orders', {
      title: 'My Orders - DePIN Storage',
      stripePublishableKey: config.stripe.publishableKey,
    });
  });

  // Order success page
  app.get('/orders/success', (req: Request, res: Response) => {
    res.render('order-success', {
      title: 'Order Successful - DePIN Storage',
      orderId: req.query.order_id,
    });
  });

  // Order cancel page
  app.get('/orders/cancel', (req: Request, res: Response) => {
    res.render('order-cancel', {
      title: 'Order Cancelled - DePIN Storage',
      orderId: req.query.order_id,
    });
  });

  // ============================================
  // Error Handling
  // ============================================

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;