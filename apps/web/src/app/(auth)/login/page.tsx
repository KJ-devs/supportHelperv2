import { type Metadata } from 'next';
import Link from 'next/link';
import { LoginFormWrapper } from '@/components/auth/login-form-wrapper';

export const metadata: Metadata = {
  title: 'Login',
  description: 'Sign in to your Support Helper account',
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-muted-foreground">Sign in to your account to continue</p>
        </div>

        <div className="bg-card border rounded-lg p-6 shadow-sm">
          <LoginFormWrapper />
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
