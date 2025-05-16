import {
  ExecutionContext,
  UnauthorizedException,
  Logger,
  Injectable,
} from '@nestjs/common';
import { CanActivate } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { Request } from 'express';

// Define interface for user session data
interface SessionUser {
  id: string;
  tenant?: string;
  email?: string;
  name?: string;
  tenants?: string[];
}

// Extend Express Session
declare module 'express-session' {
  interface Session {
    user?: SessionUser;
    lastAccess?: number;
  }
}

// Extend Request with user property
interface RequestWithUser extends Request {
  user?: {
    id: string;
    tenantId?: string;
  };
}

@Injectable()
export class TenantSessionGuard implements CanActivate {
  private readonly logger = new Logger(TenantSessionGuard.name);

  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();

    try {
      const hostname = req.hostname || req.headers.host?.split(':')[0] || '';
      this.logger.debug(`TenantSessionGuard checking host: ${hostname}`);

      // Check if session exists
      if (!req.session) {
        this.logger.warn('No session found');
        throw new UnauthorizedException('No session found');
      }

      // Check if user is in session
      if (!req.session.user) {
        this.logger.warn('No user in session');
        throw new UnauthorizedException('User not authenticated');
      }

      // Check for inactivity timeout (20 minutes = 1200000 ms)
      const now = Date.now();
      const lastActivity = req.session.lastAccess || now;
      const inactiveDuration = now - lastActivity;

      if (inactiveDuration > 1200000) {
        this.logger.warn(
          `Session expired due to inactivity (${inactiveDuration} ms)`,
        );

        // Use await to ensure the session destruction is processed
        await new Promise<void>((resolve, reject) => {
          req.session.destroy((err) => {
            if (err) {
              this.logger.error(
                'Error destroying session after timeout:',
                err instanceof Error ? err.message : 'Unknown error',
              );
              reject(new Error(err));
            } else {
              resolve();
            }
          });
        });

        throw new UnauthorizedException('Session expired due to inactivity');
      }

      // Update lastActivity timestamp
      req.session.lastAccess = now;

      const userId = req.session.user.id;

      // Handle different domains
      if (hostname === 'login.lvh.me') {
        // Main login domain - just check if user is logged in
        req.user = {
          id: userId,
        };
      } else {
        // Tenant domain - verify tenant access
        const tenantId = req.session.user.tenant;

        if (!tenantId) {
          this.logger.error('No tenant specified in session');
          throw new UnauthorizedException('No tenant specified');
        }

        // Check if hostname matches tenant
        if (!hostname.includes(tenantId)) {
          this.logger.error(
            `Unauthorized request for tenant: ${tenantId} (host: ${hostname})`,
          );
          throw new UnauthorizedException('Tenant mismatch');
        }

        req.user = {
          id: userId,
          tenantId,
        };
      }

      this.logger.log(
        `Authorized request for user: ${userId} (host: ${hostname})`,
      );
      return true;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Unauthorized request: ${errorMessage}`);
      throw new UnauthorizedException('Unauthorized');
    }
  }
}
