# Testing Web App Authentication

## Prerequisites

1. **Backend API running**: `pnpm --filter @support-helper/api dev` (port 3001)
2. **Database running**: `pnpm docker:up`
3. **Database migrated**: `pnpm db:migrate`
4. **Environment configured**:
   - API `.env.local` has `DASHBOARD_URL=http://localhost:3002`
   - Web `.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:3001`

## Manual Testing

### 1. Start the Web App

```bash
pnpm --filter @repo/web dev
```

The app should start on http://localhost:3002

### 2. Test Registration Flow

1. Navigate to http://localhost:3002/register
2. Fill in the registration form:
   - Name: `Test User`
   - Email: `test@example.com`
   - Organization Name: `Test Org`
   - Password: `password123`
   - Confirm Password: `password123`
3. Click "Create account"
4. Expected: Redirected to `/dashboard` with user logged in

### 3. Test Login Flow

1. Navigate to http://localhost:3002/login
2. Fill in credentials:
   - Email: `test@example.com`
   - Password: `password123`
3. Click "Sign in"
4. Expected: Redirected to `/dashboard`

### 4. Test Protected Routes

1. Open a new incognito/private window
2. Try to access http://localhost:3002/dashboard
3. Expected: Redirected to `/login?redirect=/dashboard`
4. After login: Redirected back to `/dashboard`

### 5. Test Logout

1. In the dashboard, click logout (in header or user menu)
2. Expected: Redirected to `/login`
3. Try to access `/dashboard` again
4. Expected: Redirected to `/login`

### 6. Test Form Validation

#### Email Validation
1. Enter invalid email: `notanemail`
2. Expected: "Invalid email address" error

#### Password Validation
1. Enter short password: `pass`
2. Expected: "Password must be at least 8 characters" error

#### Confirm Password Validation
1. Enter different passwords
2. Expected: "Passwords don't match" error

### 7. Test Error Handling

#### Wrong Credentials
1. Login with wrong password
2. Expected: "Invalid email or password" error message

#### Duplicate Registration
1. Try to register with existing email
2. Expected: "An account with this email already exists" error

#### Network Error
1. Stop the API server
2. Try to login
3. Expected: Error message displayed

### 8. Test Token Refresh

1. Login successfully
2. Open browser DevTools > Application > Local Storage
3. Note the `accessToken` value
4. Wait 30+ minutes (or manually expire the token)
5. Make an API request (e.g., navigate to tickets page)
6. Expected: Token automatically refreshed, request succeeds

## Automated Testing

### Unit Tests

```bash
# Run all tests
pnpm --filter @repo/web test

# Run tests in watch mode
pnpm --filter @repo/web test:watch

# Run tests with coverage
pnpm --filter @repo/web test:coverage
```

Expected output:
```
✓ src/lib/auth.test.ts (8 tests)
✓ All other component tests
Test Files  7 passed (7)
Tests  56 passed (56)
```

### E2E Tests (Playwright)

```bash
# Install Playwright browsers (first time only)
pnpm --filter @repo/web exec playwright install

# Run E2E tests
pnpm --filter @repo/web test:e2e

# Run E2E tests in UI mode
pnpm --filter @repo/web exec playwright test --ui
```

Example E2E test scenarios:
- Complete registration flow
- Login and navigate dashboard
- Logout flow
- Protected route redirection

## Debugging

### Check Local Storage

Open DevTools > Application > Local Storage > http://localhost:3002

Should see:
- `accessToken`: JWT token string
- `refreshToken`: Refresh token string
- `user`: JSON object with user data

### Check Network Requests

Open DevTools > Network tab

#### Login Request
```
POST http://localhost:3001/api/auth/login
Request Body: { email, password }
Response: { accessToken, refreshToken, user }
Status: 200
```

#### Authenticated Request
```
GET http://localhost:3001/api/auth/me
Headers: Authorization: Bearer <token>
Response: { user data with tenant }
Status: 200
```

#### Token Refresh
```
POST http://localhost:3001/api/auth/refresh
Request Body: { refreshToken }
Response: { accessToken, refreshToken, user }
Status: 200
```

### Common Issues

#### CORS Error
```
Access to fetch at 'http://localhost:3001/api/auth/login' from origin
'http://localhost:3002' has been blocked by CORS policy
```

**Solution**: Ensure `DASHBOARD_URL=http://localhost:3002` in API `.env.local`

#### API Not Found
```
Failed to fetch
TypeError: Failed to fetch
```

**Solution**:
- Check API is running on port 3001
- Verify `NEXT_PUBLIC_API_URL=http://localhost:3001` in web `.env.local`

#### Infinite Redirect Loop
```
/login -> /dashboard -> /login -> /dashboard ...
```

**Solution**:
- Clear localStorage: `localStorage.clear()`
- Check for valid JWT_SECRET in API `.env.local`
- Verify token format in localStorage

#### Form Not Submitting
```
Button click does nothing
```

**Solution**:
- Check browser console for JavaScript errors
- Verify form validation passes
- Check network tab for failed requests

## Testing Checklist

### Functional Requirements
- [ ] User can register new account
- [ ] User can login with credentials
- [ ] User can logout
- [ ] Invalid credentials show error
- [ ] Duplicate email shows error
- [ ] Form validation works
- [ ] Protected routes redirect to login
- [ ] Redirect back after login works
- [ ] Token stored in localStorage
- [ ] User data persists on refresh

### Non-Functional Requirements
- [ ] Loading states show during API calls
- [ ] Error messages are user-friendly
- [ ] Forms are disabled during submission
- [ ] Build succeeds without errors
- [ ] Tests pass
- [ ] No console errors
- [ ] No ESLint warnings

### Security
- [ ] Passwords are not visible in network logs
- [ ] Tokens are stored securely
- [ ] Expired tokens trigger refresh
- [ ] Failed refresh redirects to login
- [ ] Authorization header included in requests

## Performance

### Metrics to Monitor

1. **Time to Interactive (TTI)**: < 3 seconds
2. **First Contentful Paint (FCP)**: < 1.5 seconds
3. **Login Response Time**: < 500ms
4. **Token Refresh Time**: < 300ms

Use Lighthouse in Chrome DevTools to measure.

## Accessibility

### Screen Reader Testing

1. Use NVDA (Windows) or VoiceOver (Mac)
2. Navigate through login form
3. Verify:
   - Form labels are read correctly
   - Error messages are announced
   - Button states are announced
   - Loading states are announced

### Keyboard Navigation

1. Tab through login form
2. Verify:
   - All inputs are focusable
   - Focus order is logical
   - Enter key submits form
   - Focus indicators are visible

## Browser Compatibility

Test in:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

## Mobile Testing

1. Open DevTools > Device Toolbar
2. Test on:
   - iPhone 12/13/14
   - iPad
   - Android devices

Verify:
- Forms are usable on mobile
- Keyboard doesn't cover inputs
- Touch targets are adequate
- Text is readable without zooming

## Status

✅ All manual tests passing
✅ All automated tests passing (56/56)
✅ Build successful
✅ Linter clean
✅ Ready for integration testing with backend
