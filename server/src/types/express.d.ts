export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
  currency: string;
  dateFormat: string;
  numberFormat: string;
  theme: string;
  timezone: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      sessionId?: string;
    }
  }
}

export {};
