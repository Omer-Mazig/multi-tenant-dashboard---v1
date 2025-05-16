import type { User } from "@/schemas/user";
import { AxiosError } from "axios";
import api, { authApi, isLoginDomain, isTenantDomain } from "./api";
import type { LoginFormData } from "../schemas/user";

interface LoginResponse {
  user: User;
  tenants: string[];
}

class AuthService {
  async login(email: string, password: string): Promise<LoginResponse> {
    const data = await authApi.login({ email, password } as LoginFormData);
    return data;
  }

  async logout(): Promise<void> {
    await authApi.logout();
  }

  async loginToTenant(tenantId: string): Promise<void> {
    // Use the correct endpoint based on our API structure
    if (this.isLoginDomain()) {
      // For login domain, redirect to the init-session endpoint on the login domain
      const redirectUrl = `http://login.lvh.me:5173/api/auth/init-session/${tenantId}`;
      console.log(`Redirecting to: ${redirectUrl}`);
      window.location.href = redirectUrl;
    } else {
      console.error("Cannot login to tenant from non-login domain");
    }
  }

  async getMe(): Promise<User> {
    try {
      // This will use the correct endpoint based on the domain (login/me or tenant/me)
      const data = await api.get("/users/login/me");
      return data.data;
    } catch (error) {
      console.error("Failed to get user data:", error);
      throw error;
    }
  }

  async validateSession(): Promise<boolean> {
    try {
      const data = await authApi.validateSession();
      return data.user;
    } catch (error: unknown) {
      if (error instanceof AxiosError && error.response?.status === 401) {
        return false;
      }
      throw error;
    }
  }

  getHostname(): string {
    return window.location.hostname;
  }

  isTenantDomain(): boolean {
    return isTenantDomain();
  }

  isLoginDomain(): boolean {
    return isLoginDomain();
  }
}

export const authService = new AuthService();
