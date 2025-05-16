import 'express-session';

declare module 'express-session' {
  interface SessionData {
    user?: {
      id: string;
      tenant?: string;
      tenants?: string[];
      email?: string;
      name?: string;
    };
    lastAccess?: number;
  }
}
