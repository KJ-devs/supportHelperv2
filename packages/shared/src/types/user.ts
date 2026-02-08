export interface User {
  id: string;
  tenantId: string;
  email: string;
  name?: string;
  role: UserRole;
  authProvider?: AuthProvider;
  createdAt: Date;
}

export type UserRole = 'owner' | 'admin' | 'member' | 'viewer';

export type AuthProvider = 'email' | 'github' | 'google';

export interface CreateUserDto {
  email: string;
  name?: string;
  password?: string;
  role?: UserRole;
}

export interface UpdateUserDto {
  name?: string;
  role?: UserRole;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  name?: string;
  tenantName: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken?: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  tenantId: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}
