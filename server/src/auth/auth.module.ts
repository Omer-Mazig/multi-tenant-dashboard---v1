import { Module, forwardRef } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from '../user/user.module';
import { LoginSessionGuard } from './login-session.guard';

@Module({
  imports: [forwardRef(() => UserModule)],
  providers: [AuthService, LoginSessionGuard],
  controllers: [AuthController],
  exports: [AuthService, LoginSessionGuard],
})
export class AuthModule {}
