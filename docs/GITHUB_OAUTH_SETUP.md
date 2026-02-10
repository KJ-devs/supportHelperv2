# GitHub OAuth Setup Guide

This guide explains how to enable the GitHub integration in Support Helper Platform.

## Prerequisites

- A GitHub account with access to create OAuth Apps
- Support Helper Platform running locally or deployed

## Step 1: Create a GitHub OAuth App

1. Go to **GitHub Settings** > **Developer settings** > **OAuth Apps**
   - Direct link: https://github.com/settings/developers
2. Click **New OAuth App**
3. Fill in the application details:
   - **Application name**: Support Helper Platform (or your preferred name)
   - **Homepage URL**: `http://localhost:3000` (or your dashboard URL)
   - **Authorization callback URL**: `http://localhost:3001/api/github/oauth/callback` (or your API URL + `/api/github/oauth/callback`)
   - **Application description**: (optional)
4. Click **Register application**

## Step 2: Get OAuth Credentials

1. After creating the app, you'll see the **Client ID** - copy this
2. Click **Generate a new client secret**
3. Copy the **Client Secret** immediately (it won't be shown again)

## Step 3: Configure Environment Variables

1. Open your `.env` file in the project root
2. Set the GitHub OAuth credentials:

```bash
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
```

3. Generate a webhook secret (used for securing webhook payloads):

```bash
openssl rand -hex 32
```

4. Add the webhook secret to your `.env`:

```bash
GITHUB_WEBHOOK_SECRET=your_generated_webhook_secret
```

## Step 4: Restart the API

Restart your API server to load the new environment variables:

```bash
pnpm --filter @support-helper/api dev
```

Or if using the full development environment:

```bash
pnpm dev
```

## Step 5: Test the Integration

1. Log in to the Support Helper Dashboard at `http://localhost:3000`
2. Navigate to **Settings** > **GitHub** (or `/dashboard/github`)
3. Click **Connect GitHub**
4. You should be redirected to GitHub's authorization page
5. Authorize the application
6. You'll be redirected back to the dashboard with a success message

## Production Deployment

For production:

1. Update the **Homepage URL** to your production dashboard URL (e.g., `https://app.yourdomain.com`)
2. Update the **Authorization callback URL** to your production API URL (e.g., `https://api.yourdomain.com/api/github/oauth/callback`)
3. Set the environment variables on your production server
4. Ensure your `API_URL` environment variable matches your production API URL

## Troubleshooting

### "GitHub integration is not enabled"

**Cause**: `GITHUB_CLIENT_ID` or `GITHUB_CLIENT_SECRET` is not set or empty in your `.env` file.

**Solution**: Follow Step 3 to set these environment variables and restart the API.

### OAuth callback fails with "redirect_uri mismatch"

**Cause**: The callback URL configured in GitHub doesn't match the API's callback endpoint.

**Solution**:
1. Check your `API_URL` environment variable
2. Update the callback URL in your GitHub OAuth App settings to: `{API_URL}/api/github/oauth/callback`

### Token expired or invalid

**Cause**: GitHub OAuth tokens can expire.

**Solution**: Disconnect and reconnect GitHub from the dashboard settings.

## Required Scopes

The integration requests the following GitHub scopes:

- `repo` - Access to repositories (for syncing issues)
- `read:user` - Read user profile information
- `user:email` - Access user email
- `admin:repo_hook` - Manage repository webhooks

These scopes are required for the full integration functionality (issue sync, webhook notifications, etc.).

## Security Notes

- Keep your `GITHUB_CLIENT_SECRET` secure and never commit it to version control
- The `GITHUB_WEBHOOK_SECRET` is used to verify webhook payloads from GitHub
- All OAuth tokens are encrypted in the database
- Tokens are scoped to the tenant and never shared across organizations
