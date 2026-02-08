/**
 * User payload extracted from JWT token
 */
export interface UserPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
}
