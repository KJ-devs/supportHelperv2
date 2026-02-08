import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  TenantSchema,
  CreateTenantSchema,
  UserSchema,
  CreateUserSchema,
  UserRoleSchema,
  ApplicationSchema,
  CreateApplicationSchema,
  TicketSchema,
  CreateTicketSchema,
  TicketStatusSchema,
  TicketTypeSchema,
  TicketSeveritySchema,
} from '../src/schemas';

describe('Database Schemas', () => {
  describe('TenantSchema', () => {
    it('should validate a valid tenant', () => {
      const validTenant = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Company',
        slug: 'test-company',
        plan: 'free',
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = TenantSchema.safeParse(validTenant);
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const invalidTenant = {
        id: 'not-a-uuid',
        name: 'Test Company',
        slug: 'test-company',
        plan: 'free',
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = TenantSchema.safeParse(invalidTenant);
      expect(result.success).toBe(false);
    });

    it('should reject invalid slug format', () => {
      const invalidTenant = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Company',
        slug: 'Test Company!', // Invalid: contains spaces and special chars
        plan: 'free',
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = TenantSchema.safeParse(invalidTenant);
      expect(result.success).toBe(false);
    });

    it('should reject invalid plan', () => {
      const invalidTenant = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Company',
        slug: 'test-company',
        plan: 'invalid-plan',
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = TenantSchema.safeParse(invalidTenant);
      expect(result.success).toBe(false);
    });
  });

  describe('CreateTenantSchema', () => {
    it('should validate without id, createdAt, updatedAt', () => {
      const validCreate = {
        name: 'New Company',
        slug: 'new-company',
        plan: 'starter',
        settings: { theme: 'dark' },
      };

      const result = CreateTenantSchema.safeParse(validCreate);
      expect(result.success).toBe(true);
    });

    it('should apply default plan', () => {
      const validCreate = {
        name: 'New Company',
        slug: 'new-company',
        settings: {},
      };

      const result = CreateTenantSchema.safeParse(validCreate);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.plan).toBe('free');
      }
    });
  });

  describe('UserSchema', () => {
    it('should validate a valid user', () => {
      const validUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        tenantId: '123e4567-e89b-12d3-a456-426614174001',
        email: 'user@example.com',
        name: 'John Doe',
        role: 'member',
        passwordHash: null,
        authProvider: null,
        authProviderId: null,
        createdAt: new Date(),
      };

      const result = UserSchema.safeParse(validUser);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalidUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        tenantId: '123e4567-e89b-12d3-a456-426614174001',
        email: 'not-an-email',
        name: 'John Doe',
        role: 'member',
        passwordHash: null,
        authProvider: null,
        authProviderId: null,
        createdAt: new Date(),
      };

      const result = UserSchema.safeParse(invalidUser);
      expect(result.success).toBe(false);
    });
  });

  describe('UserRoleSchema', () => {
    it('should accept valid roles', () => {
      const validRoles = ['admin', 'manager', 'member', 'viewer'];
      validRoles.forEach(role => {
        const result = UserRoleSchema.safeParse(role);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid role', () => {
      const result = UserRoleSchema.safeParse('superadmin');
      expect(result.success).toBe(false);
    });
  });

  describe('CreateUserSchema', () => {
    it('should validate user creation with password', () => {
      const validCreate = {
        tenantId: '123e4567-e89b-12d3-a456-426614174001',
        email: 'newuser@example.com',
        name: 'New User',
        role: 'member',
        password: 'securepassword123',
        authProvider: null,
        authProviderId: null,
      };

      const result = CreateUserSchema.safeParse(validCreate);
      expect(result.success).toBe(true);
    });

    it('should reject short password', () => {
      const invalidCreate = {
        tenantId: '123e4567-e89b-12d3-a456-426614174001',
        email: 'newuser@example.com',
        name: 'New User',
        role: 'member',
        password: 'short',
        authProvider: null,
        authProviderId: null,
      };

      const result = CreateUserSchema.safeParse(invalidCreate);
      expect(result.success).toBe(false);
    });
  });

  describe('ApplicationSchema', () => {
    it('should validate a valid application', () => {
      const validApp = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        tenantId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'My App',
        platform: 'web',
        sdkKey: 'sk_live_xxxxx',
        settings: {},
        githubRepo: 'org/repo',
        createdAt: new Date(),
      };

      const result = ApplicationSchema.safeParse(validApp);
      expect(result.success).toBe(true);
    });
  });

  describe('TicketStatusSchema', () => {
    it('should accept all valid statuses', () => {
      const validStatuses = ['new', 'triaged', 'in_progress', 'waiting', 'resolved', 'closed'];
      validStatuses.forEach(status => {
        const result = TicketStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('TicketTypeSchema', () => {
    it('should accept all valid types', () => {
      const validTypes = [
        'bug',
        'feature_request',
        'question',
        'documentation',
        'performance',
        'security',
      ];
      validTypes.forEach(type => {
        const result = TicketTypeSchema.safeParse(type);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('TicketSeveritySchema', () => {
    it('should accept all valid severities', () => {
      const validSeverities = ['critical', 'high', 'medium', 'low'];
      validSeverities.forEach(severity => {
        const result = TicketSeveritySchema.safeParse(severity);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('TicketSchema', () => {
    it('should validate a complete ticket', () => {
      const validTicket = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        tenantId: '123e4567-e89b-12d3-a456-426614174001',
        applicationId: '123e4567-e89b-12d3-a456-426614174002',
        reporterId: '123e4567-e89b-12d3-a456-426614174003',
        status: 'new',
        type: 'bug',
        typeConfidence: 0.95,
        severity: 'high',
        severityConfidence: 0.88,
        priority: 1,
        title: 'Button not working',
        description: 'The submit button does not respond to clicks',
        reproductionSteps: ['Go to form', 'Fill in fields', 'Click submit'],
        userContext: { browser: 'Chrome', os: 'Windows' },
        sessionId: 'session-123',
        aiSummary: 'User reports unresponsive button',
        aiAnalysis: { category: 'ui', component: 'form' },
        keywords: ['button', 'submit', 'form'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = TicketSchema.safeParse(validTicket);
      expect(result.success).toBe(true);
    });

    it('should validate ticket with nullable fields', () => {
      const minimalTicket = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        tenantId: '123e4567-e89b-12d3-a456-426614174001',
        applicationId: '123e4567-e89b-12d3-a456-426614174002',
        reporterId: null,
        status: 'new',
        type: null,
        typeConfidence: null,
        severity: null,
        severityConfidence: null,
        priority: 0,
        title: null,
        description: null,
        reproductionSteps: null,
        userContext: null,
        sessionId: null,
        aiSummary: null,
        aiAnalysis: null,
        keywords: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = TicketSchema.safeParse(minimalTicket);
      expect(result.success).toBe(true);
    });

    it('should reject invalid confidence values', () => {
      const invalidTicket = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        tenantId: '123e4567-e89b-12d3-a456-426614174001',
        applicationId: '123e4567-e89b-12d3-a456-426614174002',
        reporterId: null,
        status: 'new',
        type: 'bug',
        typeConfidence: 1.5, // Invalid: > 1
        severity: null,
        severityConfidence: null,
        priority: 0,
        title: null,
        description: null,
        reproductionSteps: null,
        userContext: null,
        sessionId: null,
        aiSummary: null,
        aiAnalysis: null,
        keywords: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = TicketSchema.safeParse(invalidTicket);
      expect(result.success).toBe(false);
    });
  });

  describe('CreateTicketSchema', () => {
    it('should validate ticket creation without AI fields', () => {
      const validCreate = {
        tenantId: '123e4567-e89b-12d3-a456-426614174001',
        applicationId: '123e4567-e89b-12d3-a456-426614174002',
        reporterId: null,
        status: 'new',
        type: 'bug',
        severity: 'medium',
        priority: 1,
        title: 'Issue title',
        description: 'Issue description',
        reproductionSteps: ['Step 1', 'Step 2'],
        userContext: null,
        sessionId: null,
        keywords: ['keyword1'],
      };

      const result = CreateTicketSchema.safeParse(validCreate);
      expect(result.success).toBe(true);
    });
  });
});
