'use client';

import { useSearchParams } from 'next/navigation';
import { LoginForm } from './login-form';
import { Suspense } from 'react';

function LoginFormContent() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');

  return <LoginForm redirectUrl={redirect || undefined} />;
}

/**
 * Wrapper component to handle search params with Suspense
 */
export function LoginFormWrapper() {
  return (
    <Suspense fallback={<LoginForm />}>
      <LoginFormContent />
    </Suspense>
  );
}
