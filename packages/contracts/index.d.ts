export type Role = 'SUPERADMIN' | 'ADMIN' | 'USER';
export type AppLocale = 'es' | 'en';
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
}
export interface LoginInput { email: string; password: string }
export interface CreateUserInput { name: string; email: string; password: string; role: Role }
export interface UpdateUserInput { name?: string; email?: string; password?: string; role?: Role; active?: boolean }
export interface ProfileInput { name?: string; currentPassword?: string; newPassword?: string }
export interface UserResponse { user: User }
export interface UsersResponse { users: User[] }
export interface ProfileResponse extends UserResponse { sessionsRevoked: boolean }
export interface ConfigResponse { locale: AppLocale }
export interface CsrfResponse { token: string }
export interface ErrorResponse { error: string; code?: string; retryAfter?: number }
