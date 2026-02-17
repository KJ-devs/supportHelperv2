// Re-export common guards for backwards compatibility
export { JwtAuthGuard, SdkKeyGuard, TenantGuard, RolesGuard } from '../../common/guards';

// Deprecated: use SdkKeyGuard instead
export { SdkKeyGuard as ApiKeyAuthGuard } from '../../common/guards';
