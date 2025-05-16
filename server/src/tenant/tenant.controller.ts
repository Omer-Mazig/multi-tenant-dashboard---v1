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
  verifyToken(
    @Param('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      this.logger.debug(`Verifying one-time token`);

      const result = this.authService.verifyTenantToken(token, req);

      if (!result) {
        throw new UnauthorizedException('Invalid or expired token');
      } else {
        res.redirect(301, '/');
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
