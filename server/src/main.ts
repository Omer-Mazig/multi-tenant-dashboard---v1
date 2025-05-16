import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import * as session from 'express-session';
import * as csurf from 'csurf';
import { Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

const tenantTokens = new Map<
  string,
  { id: string; tenant: string; expires: number }
>();

// Login domain session middleware
const loginSessionMiddleware = session({
  name: 'login.sid',
  secret: 'login-secret',
  resave: true,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    domain: 'login.lvh.me',
    maxAge: 1000 * 60 * 60, // 1 hour
    path: '/',
  },
});

// Tenant domain session middleware
const createTenantSessionMiddleware = (hostname: string) => {
  const sessionName = hostname.replace(/\./g, '_') + '.sid';
  const subdomain = hostname.split('.')[0];
  return session({
    name: sessionName,
    secret: 'tenant-secret',
    resave: true,
    saveUninitialized: true,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      domain: subdomain + '.lvh.me',
      maxAge: 1000 * 60 * 60, // 1 hour
    },
  });
};

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  logger.log('Starting server with debug logging enabled');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'debug', 'log', 'verbose'],
  });

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (
        !origin ||
        origin.match(/^https?:\/\/(([a-z0-9-]+\.)?lvh\.me)(:\d+)?$/)
      ) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
  });

  app.use(cookieParser());

  // Dynamic session middleware based on hostname
  app.use((req: Request, res: Response, next: NextFunction) => {
    const hostname = req.hostname;

    if (hostname === 'login.lvh.me') {
      // Login domain
      logger.debug(`Using login session middleware for ${hostname}`);
      return loginSessionMiddleware(req, res, next);
    } else if (/^tenant\d+\.lvh\.me$/.test(hostname)) {
      // Tenant domain
      logger.debug(`Using tenant session middleware for ${hostname}`);
      return createTenantSessionMiddleware(hostname)(req, res, next);
    }
  });

  // Idle timeout for tenant sessions
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!/^tenant\d+\.lvh\.me$/.test(req.hostname) || !req.session)
      return next();

    const now = Date.now();
    if (
      req.session.lastAccess &&
      now - req.session.lastAccess > 20 * 60 * 1000
    ) {
      req.session.destroy(() => res.status(401).send('Session expired'));
    } else {
      req.session.lastAccess = now;
      next();
    }
  });

  // CSRF protection
  app.use(
    csurf({
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      },
    }),
  );

  // Store token map globally
  (global as unknown as { tenantTokens: Map<string, any> }).tenantTokens =
    tenantTokens;

  await app.listen(process.env.PORT ?? 3000);
  logger.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
