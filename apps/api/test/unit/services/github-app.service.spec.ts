import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { generateKeyPairSync } from 'crypto';

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({})),
}));

import { GithubAppService } from '../../../src/modules/github/services/github-app.service';
import { CacheService } from '../../../src/cache/cache.service';

// Generate a throwaway RSA key pair for testing
const { privateKey: TEST_PRIVATE_KEY, publicKey: TEST_PUBLIC_KEY } =
  generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

describe('GithubAppService', () => {
  let service: GithubAppService;

  const mockConfig: Record<string, any> = {
    'github.appId': '12345',
    'github.privateKey': TEST_PRIVATE_KEY,
    'github.appName': 'test-app',
    'github.appEnabled': true,
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const buildModule = async (configOverrides: Record<string, any> = {}) => {
    const config = { ...mockConfig, ...configOverrides };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GithubAppService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => config[key]) },
        },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();
    return module.get<GithubAppService>(GithubAppService);
  };

  beforeEach(async () => {
    service = await buildModule();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── isEnabled ────────────────────────────────────────────────

  describe('isEnabled', () => {
    it('should return true when app is configured', () => {
      expect(service.isEnabled()).toBe(true);
    });

    it('should return false when app is not configured', async () => {
      const svc = await buildModule({ 'github.appEnabled': false });
      expect(svc.isEnabled()).toBe(false);
    });
  });

  // ─── generateAppJwt ───────────────────────────────────────────

  describe('generateAppJwt', () => {
    it('should generate a valid RS256 JWT with 3 parts', () => {
      const token = service.generateAppJwt();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include correct issuer (appId) in payload', () => {
      const token = service.generateAppJwt();
      const decoded = jwt.verify(token, TEST_PUBLIC_KEY, {
        algorithms: ['RS256'],
      }) as jwt.JwtPayload;

      expect(decoded.iss).toBe('12345');
    });

    it('should backdate iat by ~60 seconds for clock drift', () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const token = service.generateAppJwt();
      const decoded = jwt.decode(token) as jwt.JwtPayload;

      // iat should be approximately now - 60
      expect(decoded.iat).toBeGreaterThanOrEqual(nowSec - 63);
      expect(decoded.iat).toBeLessThanOrEqual(nowSec - 58);
    });

    it('should set expiry to ~10 minutes from now', () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const token = service.generateAppJwt();
      const decoded = jwt.decode(token) as jwt.JwtPayload;

      // iat is backdated ~60s for clock drift, exp = iat + 600 ≈ now + 540
      expect(decoded.exp).toBeGreaterThanOrEqual(nowSec + 535);
      expect(decoded.exp).toBeLessThanOrEqual(nowSec + 545);
    });

    it('should produce a token verifiable with the matching public key', () => {
      const token = service.generateAppJwt();
      expect(() =>
        jwt.verify(token, TEST_PUBLIC_KEY, { algorithms: ['RS256'] }),
      ).not.toThrow();
    });

    it('should throw BadRequestException when appId is missing', async () => {
      const svc = await buildModule({ 'github.appId': '' });
      expect(() => svc.generateAppJwt()).toThrow(BadRequestException);
    });

    it('should throw BadRequestException when privateKey is missing', async () => {
      const svc = await buildModule({ 'github.privateKey': '' });
      expect(() => svc.generateAppJwt()).toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException for invalid PEM key', async () => {
      const svc = await buildModule({
        'github.privateKey': 'not-a-pem-key',
      });
      expect(() => svc.generateAppJwt()).toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── getInstallationToken ─────────────────────────────────────

  describe('getInstallationToken', () => {
    const installationId = 99999;

    it('should return cached token when available', async () => {
      mockCacheService.get.mockResolvedValue('cached-token');

      const token = await service.getInstallationToken(installationId);

      expect(token).toBe('cached-token');
      expect(mockCacheService.get).toHaveBeenCalledWith(
        `github:installation-token:${installationId}`,
      );
    });

    it('should not call generateAppJwt when cache hit', async () => {
      mockCacheService.get.mockResolvedValue('cached-token');
      const spy = jest.spyOn(service, 'generateAppJwt');

      await service.getInstallationToken(installationId);

      expect(spy).not.toHaveBeenCalled();
    });

    it('should use correct cache key format', async () => {
      mockCacheService.get.mockResolvedValue('tok');

      await service.getInstallationToken(installationId);

      expect(mockCacheService.get).toHaveBeenCalledWith(
        'github:installation-token:99999',
      );
    });
  });

  // ─── invalidateInstallationToken ──────────────────────────────

  describe('invalidateInstallationToken', () => {
    it('should delete the cached token', async () => {
      await service.invalidateInstallationToken(99999);

      expect(mockCacheService.del).toHaveBeenCalledWith(
        'github:installation-token:99999',
      );
    });
  });
});
