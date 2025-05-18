import {
  Controller,
  Get,
  Req,
  Res,
  Logger,
  UnauthorizedException,
  Param,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import 'express-session';
import { TenantService } from './tenant.service';
import { TenantSessionGuard } from './tenant-session.guard';
import { AuthService } from '../auth/auth.service';

@Controller('tenant')
export class TenantController {
  private readonly logger = new Logger(TenantController.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly authService: AuthService,
  ) {}

  @Get('verify-token/:token')
  async verifyToken(
    @Param('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      this.logger.debug(`Verifying one-time token: ${token}`);
      this.logger.debug(
        `Hostname: ${req.hostname}, Headers host: ${req.headers.host}`,
      );

      const result = await this.authService.verifyTenantToken(token, req);
      this.logger.debug(`Token verification result: ${JSON.stringify(result)}`);

      if (!result.success) {
        this.logger.error(`Token verification failed: ${result.message}`);
        throw new UnauthorizedException(
          result.message || 'Invalid or expired token',
        );
      } else {
        this.logger.debug(
          `Token verified successfully, sending HTML response with redirect`,
        );

        // Instead of using redirect, send HTML with JavaScript that redirects
        res.setHeader('Content-Type', 'text/html');
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Authentication Successful</title>
            <script>
              console.log("Authentication successful, redirecting to dashboard");
              // Use window.location.origin to maintain the same host and port
              window.location.href = window.location.origin + '/';
            </script>
          </head>
          <body>
            <h1>Authentication successful</h1>
            <p>Redirecting to dashboard...</p>
          </body>
          </html>
        `);
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Token verification failed: ${errorMessage}`);
      res.status(401).send('Authentication failed');
    }
  }

  @UseGuards(TenantSessionGuard)
  @Get('dashboard')
  dashboard(@Req() req: Request, @Res() res: Response) {
    if (!req.session.user) {
      return res.status(401).send('Not logged in');
    }

    res.send(`Welcome to ${req.hostname}, user: ${req.session.user.id}`);
  }

  @UseGuards(TenantSessionGuard)
  @Get('ping')
  ping(@Req() req: Request, @Res() res: Response) {
    // The guard already updates the lastAccess timestamp
    res.status(200).send({
      success: true,
      message: 'Session refreshed',
      timestamp: Date.now(),
    });
  }
}
