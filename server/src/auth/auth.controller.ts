import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  HttpCode,
  Logger,
  Get,
  Param,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Request, Response } from 'express';
import { LoginSessionGuard } from './login-session.guard';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const host = req.hostname || req.headers.host?.split(':')[0];
    this.logger.log(
      `Login attempt for email: ${loginDto.email} (host: ${host})`,
    );

    try {
      const result = await this.authService.login(loginDto, res);
      this.logger.log(`Login successful for user: ${result.user.id}`);
      res.status(200).send(result);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Login failed for email ${loginDto.email}: ${errorMessage}`,
      );
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Req() req: Request, @Res() res: Response) {
    try {
      const tenantId = req.session.user?.tenant;
      const host = req.hostname || req.headers.host?.split(':')[0];
      this.logger.log(`Logout request for tenant: ${tenantId} (host: ${host})`);

      req.session.destroy((err: unknown) => {
        if (err) {
          const errorMessage =
            err instanceof Error ? err.message : 'Unknown error';
          this.logger.error(`Error destroying session: ${errorMessage}`);
          res.status(500).send({ message: 'Logout failed' });
        } else {
          res.status(200).send({ message: 'Logout successful', tenantId });
        }
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Logout error: ${errorMessage}`);
      res.status(500).send({ message: 'Logout failed' });
    }
  }

  @UseGuards(LoginSessionGuard)
  @Get('init-session/:tenantId')
  initSession(
    @Req() req: Request,
    @Res() res: Response,
    @Param('tenantId') tenantId: string,
  ) {
    this.logger.debug(`Init session for tenant: ${tenantId}`);
    try {
      this.logger.debug(`Initializing session for tenant: ${tenantId}`);
      const userId = req.session.user?.id;

      if (!userId) {
        throw new UnauthorizedException('User not authenticated');
      }

      // Check if user has access to this tenant
      const userTenants = req.session.user?.tenants || [];
      if (!userTenants.includes(tenantId)) {
        throw new UnauthorizedException(
          `User does not have access to tenant: ${tenantId}`,
        );
      }

      this.logger.debug(
        `Generating tenant token for user ${userId} to tenant ${tenantId}`,
      );

      // Generate a token for tenant authentication
      const token = this.authService.generateTenantToken(userId, tenantId);

      // Redirect to tenant domain with the token
      this.logger.debug(`Redirecting to tenant domain with token: ${token}`);
      return res.redirect(
        301,
        `http://${tenantId}.lvh.me:5173/api/tenant/verify-token/${token}`,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to initialize tenant session: ${errorMessage}`);
      throw error;
    }
  }

  @Get('csrf-token')
  getCsrfToken(@Req() req: Request, @Res() res: Response) {
    res.status(200).json({ csrfToken: req.csrfToken() });
  }

  @Get('validate-session')
  validateSession(@Req() req: Request, @Res() res: Response) {
    try {
      const host = req.hostname || req.headers.host?.split(':')[0];
      const id = req.session?.user?.id;
      if (!req.session?.user) {
        return res.status(401).send({ valid: false });
      }

      this.logger.debug(`Validating session for user ${id} (host: ${host})`);

      return res.status(200).send({ valid: true });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error(error);
      this.logger.error(`Session validation failed: ${errorMessage}`);
      return res.status(401).send({ user: req.session?.user });
    }
  }
}
