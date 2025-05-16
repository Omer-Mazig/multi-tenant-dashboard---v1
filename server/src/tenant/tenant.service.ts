import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { Request } from 'express';

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);
  private readonly validTenants = ['acme', 'globex', 'initech', 'stark'];

  constructor(private readonly authService: AuthService) {}

  isTenantValid(tenantId: string): boolean {
    return this.validTenants.includes(tenantId);
  }

  getTenantFromHost(host: string): string | null {
    this.logger.debug(`Extracting tenant from host: ${host}`);

    return host.split('.')[0];
  }

  getAllTenants(): string[] {
    return [...this.validTenants];
  }

  generateTenantToken(userId: string, tenantId: string): string {
    return this.authService.generateTenantToken(userId, tenantId);
  }

  verifyTenantToken(token: string, req: Request): boolean {
    const result = this.authService.verifyTenantToken(token, req);

    if (!result.success) {
      this.logger.error(`Token verification failed: ${result.message}`);
      throw new UnauthorizedException(
        result.message || 'Token verification failed',
      );
    }

    return true;
  }

  // Helper to check if a string is potentially an IP address
  private isIpAddress(str: string): boolean {
    return /^\d{1,3}$/.test(str);
  }
}
