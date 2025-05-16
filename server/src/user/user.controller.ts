import {
  Controller,
  Get,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { UserService } from './user.service';
import { Request, Response } from 'express';
import { User } from './interfaces/user.interface';
import { TenantSessionGuard } from '../tenant/tenant-session.guard';
import { LoginSessionGuard } from '../auth/login-session.guard';
import { UserProfileDto } from './dto/user-profile.dto';

// Extended Request with proper session types
interface RequestWithUser extends Request {
  user: {
    id: string;
    tenantId?: string;
  };
}

@Controller('users')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) {}

  @UseGuards(LoginSessionGuard)
  @Get('login/me')
  getMeOnLoginDomain(@Req() req: RequestWithUser, @Res() res: Response) {
    try {
      const userId = req.user.id;
      this.logger.debug(`Getting user data for ID: ${userId} on login domain`);

      const user = this.userService.findMe(userId);

      const userProfile: UserProfileDto = {
        id: user.id,
        email: user.email,
        name: user.name,
        tenants: user.tenants,
      };

      res.status(200).json(userProfile);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error getting user data: ${errorMessage}`);
      throw new UnauthorizedException('Unauthorized: ' + errorMessage);
    }
  }

  @UseGuards(TenantSessionGuard)
  @Get('tenant/me')
  getMeOnTenantDomain(@Req() req: RequestWithUser, @Res() res: Response) {
    try {
      const userSession = req.user;
      this.logger.debug(
        `Getting user data for ID: ${userSession.id} on tenant domain`,
      );

      const user = this.userService.findMe(userSession.id);

      const userProfile: UserProfileDto = {
        id: user.id,
        email: user.email,
        name: user.name,
      };

      res.status(200).json({
        ...userProfile,
        tenantId: userSession.tenantId,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error getting user data: ${errorMessage}`);
      throw new UnauthorizedException('Unauthorized: ' + errorMessage);
    }
  }
}
