# SDK CDN Deployment Setup

This document describes the automated SDK CDN build and deployment system.

## Overview

The SDK is automatically built as a CDN-ready IIFE bundle and deployed to:
1. **jsDelivr CDN** - Automatic via npm publish (no setup required)
2. **Custom S3/CloudFront CDN** - Optional, requires AWS credentials

## Automatic CDN Build

### CI Pipeline

Every PR and push to main/develop runs:
```bash
pnpm --filter @support-helper/sdk-web build:cdn
```

This ensures the CDN bundle is never forgotten and always tested.

**Artifacts:**
- `dist/cdn/sdk.iife.js` - Minified IIFE bundle
- `dist/cdn/sdk.iife.js.map` - Source map

### Build Verification

The CI pipeline verifies:
1. CDN bundle exists at `dist/cdn/sdk.iife.js`
2. Source map exists at `dist/cdn/sdk.iife.js.map`
3. Build completes without errors (pipeline fails if CDN build fails)

## Deployment

### 1. jsDelivr CDN (Default, No Setup Required)

When the SDK is published to npm, jsDelivr automatically serves the CDN bundle:

```html
<!-- Specific version (recommended) -->
<script src="https://cdn.jsdelivr.net/npm/@support-helper/sdk-web@0.1.0/dist/cdn/sdk.iife.js"></script>

<!-- Latest version (not recommended for production) -->
<script src="https://cdn.jsdelivr.net/npm/@support-helper/sdk-web@latest/dist/cdn/sdk.iife.js"></script>

<!-- With SRI hash for security -->
<script
  src="https://cdn.jsdelivr.net/npm/@support-helper/sdk-web@0.1.0/dist/cdn/sdk.iife.js"
  integrity="sha384-..."
  crossorigin="anonymous">
</script>
```

**Advantages:**
- Zero configuration
- Automatic versioning
- Global CDN with edge caching
- Free forever
- Works immediately after npm publish

### 2. Custom S3/CloudFront CDN (Optional)

For enterprise deployments, you can host the SDK on your own S3/CloudFront infrastructure.

#### Setup Instructions

1. **Create S3 bucket:**
   ```bash
   aws s3 mb s3://your-sdk-bucket
   ```

2. **Configure bucket for public read:**
   ```bash
   aws s3api put-bucket-policy --bucket your-sdk-bucket --policy '{
     "Version": "2012-10-17",
     "Statement": [{
       "Sid": "PublicReadGetObject",
       "Effect": "Allow",
       "Principal": "*",
       "Action": "s3:GetObject",
       "Resource": "arn:aws:s3:::your-sdk-bucket/*"
     }]
   }'
   ```

3. **Enable CORS:**
   ```bash
   aws s3api put-bucket-cors --bucket your-sdk-bucket --cors-configuration '{
     "CORSRules": [{
       "AllowedOrigins": ["*"],
       "AllowedMethods": ["GET"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 3600
     }]
   }'
   ```

4. **(Optional) Create CloudFront distribution:**
   - Origin: Your S3 bucket
   - Viewer protocol: Redirect HTTP to HTTPS
   - Cache policy: CachingOptimized
   - Origin request policy: CORS-S3Origin

5. **Configure GitHub secrets:**
   ```
   AWS_ACCESS_KEY_ID          - AWS access key
   AWS_SECRET_ACCESS_KEY      - AWS secret key
   AWS_REGION                 - us-east-1 (or your region)
   S3_CDN_BUCKET             - your-sdk-bucket
   CDN_DOMAIN                - your-cdn.cloudfront.net (optional)
   CLOUDFRONT_DISTRIBUTION_ID - E1234567890ABC (optional)
   ```

#### Deployment Workflow

**Automatic deployment:**
- Triggered on pushes to `main` that modify `packages/sdk-web/**`
- Deploys versioned bundle: `sdk@{version}.js`
- Updates `@latest` tag (5-minute cache)

**Manual deployment:**
```bash
# Via GitHub Actions UI
# Go to Actions > Deploy SDK to CDN > Run workflow
# Optionally specify custom version
```

**URLs after deployment:**
```html
<!-- Versioned (immutable, 1-year cache) -->
<script src="https://your-cdn.cloudfront.net/sdk@0.1.0.js"></script>

<!-- Latest (5-minute cache) -->
<script src="https://your-cdn.cloudfront.net/sdk@latest.js"></script>
```

## Versioning Strategy

### Semantic Versioning

- **Major** (1.0.0): Breaking changes
- **Minor** (0.1.0): New features, backward compatible
- **Patch** (0.0.1): Bug fixes

### CDN URLs

| URL Pattern | Cache Duration | Use Case |
|-------------|----------------|----------|
| `sdk@{version}.js` | 1 year (immutable) | Production (pinned version) |
| `sdk@latest.js` | 5 minutes | Development/testing |
| jsDelivr versioned | Forever (immutable) | Production (recommended) |

### Best Practices

**Production:**
```html
<!-- Always pin to specific version -->
<script src="https://cdn.jsdelivr.net/npm/@support-helper/sdk-web@0.1.0/dist/cdn/sdk.iife.js"></script>
```

**Development:**
```html
<!-- Use @latest for quick iteration -->
<script src="https://your-cdn.cloudfront.net/sdk@latest.js"></script>
```

## Release Process

### 1. Create Release Tag

```bash
# Update version in package.json
cd packages/sdk-web
npm version patch  # or minor, major

# Create git tag
git tag v0.1.1
git push origin v0.1.1
```

### 2. Automated Release Pipeline

The `release.yml` workflow automatically:
1. Builds SDK (npm + CDN bundles)
2. Publishes to npm registry
3. Uploads CDN bundle to S3 (if configured)
4. Updates `@latest` tag
5. Invalidates CloudFront cache
6. Creates GitHub release with CDN URLs

### 3. Verify Deployment

```bash
# Check jsDelivr (may take a few minutes)
curl -I https://cdn.jsdelivr.net/npm/@support-helper/sdk-web@0.1.1/dist/cdn/sdk.iife.js

# Check custom CDN (if configured)
curl -I https://your-cdn.cloudfront.net/sdk@0.1.1.js
```

## Monitoring

### Build Artifacts

Every CI run uploads artifacts:
- `build-artifacts` - All package builds (7-day retention)
- `sdk-cdn-bundle` - CDN bundle + package.json (30-day retention)
- `sdk-cdn-{version}` - Release-specific CDN bundle (90-day retention)

### Metrics to Track

1. **Bundle size** - Target: <50KB gzipped
2. **Build time** - Typical: 10-20 seconds
3. **CDN cache hit rate** - Target: >95%
4. **jsDelivr availability** - Monitor via uptime service

### Troubleshooting

**Issue: CDN build fails in CI**
```bash
# Reproduce locally
cd packages/sdk-web
pnpm build:cdn

# Check for errors in vite.config.cdn.ts
# Verify terser options are valid
```

**Issue: jsDelivr returns 404**
```bash
# Wait 5-10 minutes after npm publish
# jsDelivr needs time to fetch from npm

# Force refresh
curl https://purge.jsdelivr.net/npm/@support-helper/sdk-web@0.1.0/dist/cdn/sdk.iife.js
```

**Issue: S3 upload fails**
```bash
# Verify AWS credentials
aws s3 ls s3://your-sdk-bucket

# Check IAM permissions (needs s3:PutObject)
```

## Security Considerations

### Subresource Integrity (SRI)

Generate SRI hash:
```bash
curl https://cdn.jsdelivr.net/npm/@support-helper/sdk-web@0.1.0/dist/cdn/sdk.iife.js | \
  openssl dgst -sha384 -binary | \
  openssl base64 -A
```

Use in HTML:
```html
<script
  src="https://cdn.jsdelivr.net/npm/@support-helper/sdk-web@0.1.0/dist/cdn/sdk.iife.js"
  integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/ux..."
  crossorigin="anonymous">
</script>
```

### Content Security Policy (CSP)

```http
Content-Security-Policy:
  script-src 'self' https://cdn.jsdelivr.net https://your-cdn.cloudfront.net;
  connect-src 'self' https://api.support-helper.com;
```

## Cost Estimation

### jsDelivr
- **Cost:** Free forever
- **Bandwidth:** Unlimited
- **Requests:** Unlimited

### AWS S3/CloudFront
- **S3 storage:** $0.023/GB/month (~$0.01/month for SDK)
- **CloudFront data transfer:**
  - First 10TB: $0.085/GB
  - Next 40TB: $0.080/GB
- **CloudFront requests:** $0.0075 per 10,000 requests

**Example:** 1M SDK downloads/month (50KB bundle):
- Data transfer: 50GB × $0.085 = $4.25
- Requests: 100 × $0.0075 = $0.75
- **Total:** ~$5/month

## Migration Guide

### From Manual CDN Build

**Before:**
```bash
# Manual step (easy to forget)
pnpm --filter @support-helper/sdk-web build:cdn

# Manual upload
aws s3 cp dist/cdn/sdk.iife.js s3://bucket/sdk.js
```

**After:**
```bash
# Just push to main - CI handles everything
git push origin main

# Or create release tag
git tag v0.1.1
git push origin v0.1.1
```

### From Legacy Script Tag

**Old (broken when CDN build missing):**
```html
<script src="/path/to/local/sdk.js"></script>
```

**New (always available):**
```html
<script src="https://cdn.jsdelivr.net/npm/@support-helper/sdk-web@0.1.0/dist/cdn/sdk.iife.js"></script>
```

## Future Enhancements

- [ ] Add bundle size tracking (GitHub Actions comment)
- [ ] Implement semantic-release for automatic versioning
- [ ] Add smoke tests for CDN URLs post-deployment
- [ ] Create Webpack/Rollup/Vite plugins for easier integration
- [ ] Add CDN fallback mechanism (try S3, fallback to jsDelivr)
- [ ] Implement feature flags via CDN query params
- [ ] Add A/B testing support with versioned deployments

## Support

For issues with:
- **CI/CD pipeline:** Check `.github/workflows/ci.yml` and `deploy-sdk-cdn.yml`
- **Build configuration:** See `vite.config.cdn.ts`
- **npm publishing:** Check `release.yml` workflow
- **AWS/CDN setup:** Review this document's setup section

Need help? Open an issue or contact the DevOps team.
