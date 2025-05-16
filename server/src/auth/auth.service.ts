import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { Response, Request } from 'express';
import { UserService } from '../user/user.service';
import { User } from '../user/interfaces/user.interface';
import * as crypto from 'crypto';

// Define custom session data
interface UserSession {
  id: string;
  email: string;
  name?: string;
  tenants?: string[];
}

// Create a simplified request interface
interface RequestWithSession extends Request {
  session: any; // Using any for session to fix typing issues
}

// Tenant verification response
interface VerifyTokenResult {
  success: boolean;
  message?: string;
}

// Token structure
interface TempAuthToken {
  id: string;
  tenantId: string;
  expires: number;
}

// Extended session declaration to allow lastAccess
declare module 'express-session' {
  interface SessionData {
    user?: UserSession & {
      tenant?: string;
      lastAccess?: number;
    };
    lastAccess?: number;
  }
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly tempAuthTokens: Map<string, TempAuthToken> = new Map();

  constructor(private readonly userService: UserService) {
    // Schedule token cleanup every 15 minutes
    setInterval(() => this.cleanExpiredTokens(), 15 * 60 * 1000);
  }

  validateUserForLogin(
    email: string,
    password: string,
  ): Omit<User, 'password'> | null {
    this.logger.debug(`Validating user: ${email}`);
    const user = this.userService.findByEmail(email);

    if (!user) {
      this.logger.debug(`User not found: ${email}`);
      return null;
    }

    if (user.password === password) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _, ...result } = user;
      this.logger.debug(`User validation successful for: ${email}`);
      return result;
    }

    this.logger.debug(`Invalid password for user: ${email}`);
    return null;
  }

  async login(loginDto: LoginDto, res: Response) {
    this.logger.debug(`Login attempt for: ${loginDto.email}`);

    const user = this.validateUserForLogin(loginDto.email, loginDto.password);

    if (!user) {
      this.logger.warn(`Login failed for: ${loginDto.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const req = res.req as RequestWithSession;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      tenants: user.tenants,
      lastAccess: Date.now(),
    };

    // Save the session explicitly
    try {
      await new Promise<void>((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        req.session.save((err: Error | null) => {
          if (err) {
            this.logger.error(`Failed to save session: ${err.message}`);

            reject(new Error(`Failed to save session: ${err.message}`));
          } else {
            this.logger.debug(`Session saved successfully for: ${user.email}`);
            resolve();
          }
        });
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error saving session: ${errorMessage}`);
      throw new Error(`Error saving session: ${errorMessage}`);
    }

    this.logger.debug(`Login successful for: ${user.email}`);
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tenants: user.tenants,
      },
    };
  }

  getUserSessionData(req: RequestWithSession): UserSession {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!req.session || !req.session.user) {
      throw new UnauthorizedException('No user session found');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
    return req.session.user;
  }

  generateTenantToken(userId: string, tenantId: string): string {
    const token = crypto.randomBytes(32).toString('hex');

    this.tempAuthTokens.set(token, {
      id: userId,
      tenantId,
      expires: Date.now() + 30000, // 30 seconds expiry
    });

    this.cleanExpiredTokens();
    return token;
  }

  verifyTenantToken(token: string, req: Request): VerifyTokenResult {
    try {
      const tokenData = this.tempAuthTokens.get(token);

      if (!tokenData) {
        this.logger.error('Invalid or expired token');
        return { success: false, message: 'Invalid or expired token' };
      }

      if (tokenData.expires < Date.now()) {
        this.logger.error('Token expired');
        this.tempAuthTokens.delete(token);
        return { success: false, message: 'Token expired' };
      }

      const { id, tenantId } = tokenData;

      const hostname = req.hostname || req.headers.host?.split(':')[0] || '';
      if (!hostname.includes(tenantId)) {
        this.logger.error(
          `Token used on wrong tenant: ${hostname} vs ${tenantId}`,
        );
        return { success: false, message: 'Invalid tenant' };
      }

      // Safely set the session if it exists
      if (req.session) {
        // Find the user to get additional data if needed
        const user = this.userService.findById(id, tenantId);

        req.session.user = {
          id,
          email: user?.email || 'unknown@example.com', // Provide email as required
          tenant: tenantId,
          lastAccess: Date.now(),
        };
        req.session.lastAccess = Date.now();
        req.session.save();
      } else {
        this.logger.warn('No session object available for tenant verification');
        return { success: false, message: 'Session not available' };
      }

      this.tempAuthTokens.delete(token);
      return { success: true };
    } catch (error) {
      this.logger.error('Error verifying tenant token:', error);
      return { success: false, message: 'Verification error' };
    }
  }

  private cleanExpiredTokens() {
    const now = Date.now();
    for (const [key, value] of this.tempAuthTokens.entries()) {
      if (value.expires < now) {
        this.tempAuthTokens.delete(key);
      }
    }
  }
}
