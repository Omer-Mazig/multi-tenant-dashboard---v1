import {
  ExecutionContext,
  UnauthorizedException,
  Logger,
  Injectable,
} from '@nestjs/common';
import { CanActivate } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Request, Response } from 'express';
import 'express-session';
import { User } from '../user/interfaces/user.interface';

// Extend Request type to include session properties
interface RequestWithSession extends Request {
  user?: Omit<User, 'password'>;
}

@Injectable()
export class LoginSessionGuard implements CanActivate {
  private readonly logger = new Logger(LoginSessionGuard.name);
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithSession>();
    const res = context.switchToHttp().getResponse<Response>();
    const tenantId = req.params?.tenantId;

    try {
      this.logger.debug(
        `LoginSessionGuard checking session for host: ${req.headers.host}`,
      );

      this.logger.debug(`Route params: ${JSON.stringify(req.params)}`);

      // Check if user session exists
      if (!req.session) {
        this.logger.error('No session object found');
        return this.handleLoginRedirect(req, res, tenantId);
      }

      if (!req.session.user) {
        this.logger.error('No user in session');
        return this.handleLoginRedirect(req, res, tenantId);
      }

      const id = req.session.user.id;
      this.logger.debug(`Found user ID in session: ${id}`);

      const host = req.headers.host?.split(':')[0];
      const isValidHost = host?.includes('lvh.me');

      if (!isValidHost) {
        this.logger.error(`Unauthorized request for (host: ${host})`);
        throw new UnauthorizedException('Unauthorized - Invalid host');
      }

      req.session.user = {
        id,
        email: req.session.user.email,
        name: req.session.user.name,
        tenants: req.session.user.tenants,
      };

      this.logger.log(`Authorized request for (host: ${host})`);

      return true;
    } catch (error: unknown) {
      this.logger.error(
        `Unauthorized request for login: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      this.logger.error(error);

      // Try to handle redirect instead of just throwing an error
      if (req.params.tenantId) {
        return this.handleLoginRedirect(req, res, tenantId);
      }

      throw new UnauthorizedException('Unauthorized');
    }
  }

  private handleLoginRedirect(
    req: RequestWithSession,
    res: Response,
    tenantId?: string,
  ): boolean {
    // If this is a tenant login request but user isn't logged in, redirect to main login
    if (req.url.includes('/login/') && tenantId) {
      this.logger.debug(`Redirecting to login page for tenant: ${tenantId}`);
      res.redirect(`http://login.lvh.me:3000/login?tenantId=${tenantId}`);
      return false;
    }

    throw new UnauthorizedException('Unauthorized - Please log in');
  }
}
