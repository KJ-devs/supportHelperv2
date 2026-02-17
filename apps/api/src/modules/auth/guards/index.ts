// Re-export common guards for backwards compatibility
export { JwtAuthGuard, SdkKeyGuard, TenantGuard, RolesGuard } from '../../../common/guards';

// Keep tenant-specific rate limiting guard
export * from './tenant-rate-limit.guard';

// Keep API key guard (if still needed for passport strategy)
export * from './api-key.guard';

// Deprecated aliases
export { SdkKeyGuard as ApiKeyAuthGuard } from '../../../common/guards';
