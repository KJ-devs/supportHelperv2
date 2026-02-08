export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: TenantPlan;
  settings: TenantSettings;
  createdAt: Date;
  updatedAt: Date;
}

export type TenantPlan = 'free' | 'pro' | 'team' | 'enterprise';

export interface TenantSettings {
  maxTicketsPerMonth?: number;
  maxApps?: number;
  maxVideoMinutes?: number;
  enableAI?: boolean;
  enableGithubSync?: boolean;
  customBranding?: {
    logo?: string;
    primaryColor?: string;
  };
}

export interface Application {
  id: string;
  tenantId: string;
  name: string;
  platform?: AppPlatform;
  sdkKey: string;
  settings: ApplicationSettings;
  githubRepo?: string;
  createdAt: Date;
}

export type AppPlatform = 'web' | 'desktop' | 'mobile' | 'other';

export interface ApplicationSettings {
  enableVideoCapture?: boolean;
  enableLogCapture?: boolean;
  maxVideoDuration?: number;
  customFields?: CustomField[];
}

export interface CustomField {
  name: string;
  type: 'text' | 'number' | 'select' | 'boolean';
  required?: boolean;
  options?: string[];
}

export interface CreateApplicationDto {
  name: string;
  platform?: AppPlatform;
  githubRepo?: string;
  settings?: ApplicationSettings;
}

export interface UpdateApplicationDto {
  name?: string;
  platform?: AppPlatform;
  githubRepo?: string;
  settings?: ApplicationSettings;
}

export const PLAN_LIMITS: Record<TenantPlan, TenantSettings> = {
  free: {
    maxTicketsPerMonth: 50,
    maxApps: 1,
    maxVideoMinutes: 5,
    enableAI: true,
    enableGithubSync: false,
  },
  pro: {
    maxTicketsPerMonth: 500,
    maxApps: 5,
    maxVideoMinutes: 30,
    enableAI: true,
    enableGithubSync: true,
  },
  team: {
    maxTicketsPerMonth: 2000,
    maxApps: 20,
    maxVideoMinutes: -1, // unlimited
    enableAI: true,
    enableGithubSync: true,
  },
  enterprise: {
    maxTicketsPerMonth: -1,
    maxApps: -1,
    maxVideoMinutes: -1,
    enableAI: true,
    enableGithubSync: true,
  },
};
