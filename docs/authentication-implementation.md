# Web App Authentication Implementation

## Overview

This document describes the authentication system implementation for the Support Helper web application (US-001). The system provides secure JWT-based authentication with automatic token refresh and protected routes.

## Files Created/Modified

### New Files Created

1. **`apps/web/src/lib/auth.ts`** - Authentication manager
   - Token storage and retrieval (localStorage)
   - Login/register/logout functions
   - Token parsing and expiration checking
   - Automatic token refresh logic
   - User session management

2. **`apps/web/src/lib/hooks/use-auth.ts`** - TanStack Query hooks
   - `useLogin()` - Login mutation with redirect
   - `useRegister()` - Registration mutation with redirect
   - `useLogout()` - Logout mutation with cleanup
   - `useUser()` - Current user query
   - `useAuth()` - Combined authentication state

3. **`apps/web/src/components/auth/auth-guard.tsx`** - Route protection
   - Protects dashboard routes
   - Redirects unauthenticated users to login
   - Shows loading state during auth check

4. **`apps/web/src/components/auth/login-form-wrapper.tsx`** - Login form wrapper
   - Handles URL redirect parameters
   - Suspense boundary for search params

5. **`apps/web/src/lib/auth.test.ts`** - Authentication tests
   - Token management tests
   - JWT parsing tests
   - Error message tests
   - 8 test cases, all passing

6. **`apps/web/.env.example`** - Environment variables template
   - `NEXT_PUBLIC_API_URL` configuration
   - Monitoring service configurations

### Modified Files

1. **`apps/web/src/components/auth/login-form.tsx`**
   - Integrated with `useLogin` hook
   - Added error message display
   - Added loading states
   - Disabled inputs during submission
   - Redirect URL support

2. **`apps/web/src/components/auth/register-form.tsx`**
   - Integrated with `useRegister` hook
   - Added organization name field (required by API)
   - Added error message display
   - Added loading states
   - Disabled inputs during submission

3. **`apps/web/src/lib/api.ts`**
   - Enhanced with automatic token refresh
   - Handles expired tokens automatically
   - Prevents multiple simultaneous refresh attempts
   - Better error handling
   - Redirects to login on auth failure

4. **`apps/web/src/app/(auth)/login/page.tsx`**
   - Updated to use `LoginFormWrapper`
   - Supports redirect URL parameter

5. **`apps/web/src/app/(dashboard)/layout.tsx`**
   - Wrapped with `AuthGuard` component
   - Protects all dashboard routes

## Features Implemented

### 1. Authentication Flow

#### Login
```typescript
// User enters credentials
POST /api/auth/login
{
  email: "user@example.com",
  password: "password123"
}

// API returns
{
  accessToken: "jwt-token",
  refreshToken: "refresh-token",
  user: { id, email, name, role, tenantId, ... }
}

// Store in localStorage and redirect to dashboard
```

#### Registration
```typescript
// User enters details
POST /api/auth/register
{
  name: "John Doe",
  email: "user@example.com",
  password: "password123",
  tenantName: "Acme Inc"
}

// Same response as login
// Creates new user + tenant, returns tokens
```

#### Logout
```typescript
// Clear localStorage
// Call logout endpoint (optional - JWT is stateless)
POST /api/auth/logout

// Redirect to login page
```

### 2. Token Management

- **Access Token**: Stored in `localStorage` as `accessToken`
- **Refresh Token**: Stored in `localStorage` as `refreshToken`
- **User Data**: Stored in `localStorage` as `user` (JSON)

### 3. Automatic Token Refresh

The API client (`api.ts`) automatically:
1. Checks if access token is expired or expiring soon (within 60 seconds)
2. Calls `/api/auth/refresh` with refresh token
3. Updates stored tokens
4. Retries the original request
5. Prevents multiple simultaneous refresh attempts

### 4. Route Protection

- Dashboard routes are wrapped with `AuthGuard`
- Unauthenticated users are redirected to `/login?redirect=/original-path`
- After successful login, users are redirected back to the original path

### 5. Error Handling

User-friendly error messages for common scenarios:
- 401: "Invalid email or password"
- 409: "An account with this email already exists"
- 400: Shows API error message
- Network errors: Generic fallback message

### 6. Form Validation

- **Email**: Valid email format required
- **Password**: Minimum 8 characters
- **Name**: Minimum 2 characters
- **Organization Name**: Minimum 2 characters (registration only)
- **Confirm Password**: Must match password field

### 7. Loading States

- Button shows spinner during submission
- Form inputs disabled during submission
- Auth guard shows loading spinner while checking authentication

## API Integration

### Endpoints Used

1. **POST `/api/auth/login`**
   - Body: `{ email, password }`
   - Returns: `{ accessToken, refreshToken, user }`

2. **POST `/api/auth/register`**
   - Body: `{ name, email, password, tenantName }`
   - Returns: `{ accessToken, refreshToken, user }`

3. **POST `/api/auth/refresh`**
   - Body: `{ refreshToken }`
   - Returns: `{ accessToken, refreshToken, user }`

4. **POST `/api/auth/logout`**
   - Headers: `Authorization: Bearer <token>`
   - Returns: `{ message }`

5. **GET `/api/auth/me`**
   - Headers: `Authorization: Bearer <token>`
   - Returns: User object with tenant info

### Authentication Headers

All authenticated requests include:
```
Authorization: Bearer <access-token>
```

## Environment Configuration

Create `apps/web/.env.local`:
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

The `NEXT_PUBLIC_` prefix is required for Next.js to expose the variable to the browser.

## Usage Examples

### Using Authentication in Components

```tsx
import { useAuth } from '@/lib/hooks/use-auth';

function MyComponent() {
  const { user, isLoading, isAuthenticated, logout } = useAuth();

  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <div>Not authenticated</div>;

  return (
    <div>
      <p>Welcome, {user?.name}!</p>
      <button onClick={() => logout()}>Logout</button>
    </div>
  );
}
```

### Making Authenticated API Calls

```tsx
import { api } from '@/lib/api';

// Automatically includes Authorization header and handles token refresh
const data = await api.get('/api/tickets');
```

### Protecting Routes

```tsx
import { AuthGuard } from '@/components/auth/auth-guard';

export default function ProtectedPage() {
  return (
    <AuthGuard>
      {/* This content only renders for authenticated users */}
      <div>Protected content</div>
    </AuthGuard>
  );
}
```

## Testing

### Run Tests
```bash
pnpm --filter @repo/web test
```

### Test Coverage
- 56 total tests passing
- Auth tests: 8 tests covering token management, JWT parsing, and error handling
- UI component tests: 48 tests

### Build Verification
```bash
pnpm --filter @repo/web build
```

Build succeeds with no errors or warnings.

## Security Considerations

1. **Token Storage**: Tokens stored in localStorage (acceptable for SPAs, consider httpOnly cookies for enhanced security)
2. **Token Expiration**: Access tokens expire in 30 minutes (configurable)
3. **Refresh Tokens**: Valid for 30 days (configurable)
4. **Automatic Refresh**: Tokens refreshed automatically 60 seconds before expiration
5. **HTTPS**: Should be used in production (configure in deployment)
6. **CORS**: API must allow web app origin (configured via `DASHBOARD_URL` env var)

## Future Enhancements

1. **Remember Me**: Optional persistent sessions
2. **2FA**: Two-factor authentication support
3. **Session Management**: View and revoke active sessions
4. **Password Reset**: Forgot password flow
5. **Email Verification**: Verify email after registration
6. **Social Login**: OAuth with Google, GitHub, etc.
7. **Token Blacklist**: Revoke refresh tokens on logout (requires Redis)

## Troubleshooting

### "Network Error" or CORS Issues
- Ensure API is running on port 3001
- Check `DASHBOARD_URL` in API `.env.local` includes `http://localhost:3002`
- Verify `NEXT_PUBLIC_API_URL` in web `.env.local` is set to `http://localhost:3001`

### "Invalid Token" or Infinite Redirects
- Clear localStorage: `localStorage.clear()`
- Check JWT_SECRET is set in API `.env.local`
- Verify tokens are not expired

### Form Not Submitting
- Check browser console for errors
- Verify API endpoints are accessible
- Check network tab for failed requests

### Build Errors
- Run `pnpm install` to ensure dependencies are installed
- Clear build cache: `rm -rf .next`
- Verify TypeScript types are generated

## Related Files

- API Auth Controller: `apps/api/src/auth/auth.controller.ts`
- API Auth Service: `apps/api/src/auth/auth.service.ts`
- API Auth DTOs: `apps/api/src/auth/dto/auth.dto.ts`
- JWT Strategy: `apps/api/src/auth/strategies/jwt.strategy.ts`

## Status

✅ **COMPLETED** - All requirements from US-001 implemented and tested

- [x] Login form connected to API
- [x] Registration form connected to API
- [x] JWT token storage
- [x] Authorization header interceptor
- [x] Token refresh logic
- [x] Error handling with user-friendly messages
- [x] Loading states
- [x] Redirect after login
- [x] Form validation
- [x] Route protection
- [x] Tests passing
- [x] Build successful
