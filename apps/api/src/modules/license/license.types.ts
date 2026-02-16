export type PlanType = 'free' | 'pro' | 'enterprise';

export interface LicensePayload {
  plan: PlanType;
  tenantName: string;
  maxUsers: number;
  maxTicketsPerMonth: number;
  maxAgentTasksPerMonth: number;
  maxRepos: number;
  features: string[];
  expiresAt: string;
  iat?: number;
  exp?: number;
}

export interface PlanLimits {
  maxTicketsPerMonth: number;
  maxAgentTasksPerMonth: number;
  maxRepos: number;
  maxUsers: number;
  features: string[];
}

export const FREE_PLAN_LIMITS: PlanLimits = {
  maxTicketsPerMonth: 50,
  maxAgentTasksPerMonth: 10,
  maxRepos: 1,
  maxUsers: 3,
  features: [],
};

export const PLAN_FEATURES: Record<string, PlanType[]> = {
  auto_merge: ['pro', 'enterprise'],
  audit_logs: ['pro', 'enterprise'],
  multi_provider_ai: ['pro', 'enterprise'],
  backup_restore: ['pro', 'enterprise'],
  sso: ['enterprise'],
};
