import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock, Mail, UserCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input, Label, FieldError } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StatusBanner } from '@/components/feedback/StatusBanner';
import { PageHeader } from '@/components/ui/PageHeader';
import { PlatformBootstrapCard } from '@/components/PlatformBootstrapCard';
import { useToast } from '@/hooks/useToast';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

const registerSchema = z.object({
  displayName: z.string().min(2, 'Full name is required.'),
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Use at least 8 characters for your password.'),
});

const forgotSchema = z.object({
  email: z.string().email('Enter your registered email address.'),
});

export function LoginPage() {
  const { isAuthenticated, login, firebaseInfo } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema) });

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (values) => {
    setError('');
    try {
      await login(values.email, values.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err?.message || 'Unable to sign in. Verify your credentials and Firebase Emulator status.');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Sign in to CampusOS</CardTitle>
          <CardDescription>Access your multi-role academic workspace</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!firebaseInfo.configured && (
          <StatusBanner
            tone="warning"
            title="Firebase Configuration Required"
            description="Copy .env.example to .env and configure VITE_FIREBASE_* keys or enable VITE_USE_FIREBASE_EMULATORS=true."
          />
        )}
        {error && <StatusBanner tone="error" title="Sign-in failed" description={error} />}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="login-email" required>
              Email Address
            </Label>
            <Input id="login-email" type="email" placeholder="admin@campusos.edu" {...register('email')} error={errors.email} />
            <FieldError message={errors.email?.message} />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="login-password" required>
                Password
              </Label>
              <Link to="/forgot-password" className="text-xs font-medium text-indigo-700 hover:underline mb-1.5">
                Forgot password?
              </Link>
            </div>
            <Input
              id="login-password"
              type="password"
              placeholder="••••••••"
              {...register('password')}
              error={errors.password}
            />
            <FieldError message={errors.password?.message} />
          </div>
          <Button type="submit" className="w-full" loading={isSubmitting} disabled={!firebaseInfo.configured}>
            <Lock className="h-4 w-4" />
            Sign In
          </Button>
        </form>

        <div className="border-t border-slate-100 pt-3 text-center text-xs text-slate-500">
          Invited or new user?{' '}
          <Link to="/register" className="font-semibold text-indigo-700 hover:underline">
            Create account
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export function RegisterPage() {
  const { isAuthenticated, register: registerAccount, firebaseInfo } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(registerSchema) });

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (values) => {
    setError('');
    try {
      await registerAccount(values);
      navigate('/dashboard');
    } catch (err) {
      setError(err?.message || 'Registration failed.');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Create CampusOS Account</CardTitle>
          <CardDescription>Register your identity before an admin assigns your college role</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <StatusBanner tone="error" title="Registration failed" description={error} />}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="reg-name" required>
              Full Name
            </Label>
            <Input id="reg-name" placeholder="Dr. Ananya Rao" {...register('displayName')} error={errors.displayName} />
            <FieldError message={errors.displayName?.message} />
          </div>
          <div>
            <Label htmlFor="reg-email" required>
              Email Address
            </Label>
            <Input id="reg-email" type="email" placeholder="user@college.edu" {...register('email')} error={errors.email} />
            <FieldError message={errors.email?.message} />
          </div>
          <div>
            <Label htmlFor="reg-password" required>
              Password
            </Label>
            <Input
              id="reg-password"
              type="password"
              placeholder="Minimum 8 characters"
              {...register('password')}
              error={errors.password}
            />
            <FieldError message={errors.password?.message} />
          </div>
          <Button type="submit" className="w-full" loading={isSubmitting} disabled={!firebaseInfo.configured}>
            <UserCheck className="h-4 w-4" />
            Create Account
          </Button>
        </form>
        <div className="border-t border-slate-100 pt-3 text-center text-xs text-slate-500">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-indigo-700 hover:underline">
            Back to sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export function ForgotPasswordPage() {
  const { sendPasswordReset, firebaseInfo } = useAuth();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(forgotSchema) });

  const onSubmit = async (values) => {
    setError('');
    try {
      await sendPasswordReset(values.email);
      setSent(true);
    } catch (err) {
      setError(err?.message || 'Could not send reset email.');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>Firebase Auth will send a secure reset link to your inbox</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {sent && (
          <StatusBanner
            tone="success"
            title="Reset email dispatched"
            description={
              firebaseInfo.mode === 'emulator'
                ? 'Check the Firebase Auth Emulator console logs for the reset link.'
                : 'Check your email inbox (and spam folder) for the Firebase password reset link.'
            }
          />
        )}
        {error && <StatusBanner tone="error" title="Request failed" description={error} />}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="forgot-email" required>
              Email Address
            </Label>
            <Input id="forgot-email" type="email" {...register('email')} error={errors.email} />
            <FieldError message={errors.email?.message} />
          </div>
          <Button type="submit" className="w-full" loading={isSubmitting} disabled={!firebaseInfo.configured}>
            <Mail className="h-4 w-4" />
            Send Password Reset Link
          </Button>
        </form>

        <div className="border-t border-slate-100 pt-3 text-center text-xs">
          <Link to="/login" className="font-semibold text-indigo-700 hover:underline">
            Return to sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProfilePage() {
  const {
    user,
    profile,
    activeTenant,
    role,
    roleLabel,
    firebaseInfo,
    backendStatus,
    bootstrapInitialized,
    resendVerification,
    refreshBackendHealth,
  } = useAuth();
  const { toast } = useToast();
  const [sending, setSending] = useState(false);

  const handleVerifyEmail = async () => {
    setSending(true);
    try {
      await resendVerification();
      toast({
        variant: 'success',
        title: 'Verification email sent',
        description:
          firebaseInfo.mode === 'emulator'
            ? 'Check the Auth Emulator logs to confirm verification.'
            : 'Check your inbox and click the verification link.',
      });
    } catch (err) {
      toast({ variant: 'error', title: 'Failed to send verification email', description: err.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile &amp; System Diagnostics"
        description="Verified Firebase Authentication identity, tenant membership, and service connection status."
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Profile' }]}
      />

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Identity &amp; Role Context</CardTitle>
            <Badge variant={user?.emailVerified ? 'success' : 'warning'}>
              {user?.emailVerified ? 'Email Verified' : 'Verification Pending'}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">UID</span>
              <span className="font-mono text-xs text-slate-900">{user?.uid || '—'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Display Name</span>
              <span className="font-medium text-slate-900">{profile?.displayName || '—'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Email</span>
              <span className="text-slate-900">{user?.email || '—'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Active College</span>
              <span className="font-medium text-slate-900">{activeTenant?.name || 'None Assigned'}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Trusted Role</span>
              <Badge variant="indigo">{roleLabel} ({role || 'none'})</Badge>
            </div>
            {!user?.emailVerified && (
              <Button variant="secondary" size="sm" onClick={handleVerifyEmail} loading={sending} className="mt-2">
                Send Verification Email
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Platform Connection Status</CardTitle>
            <Button variant="ghost" size="sm" onClick={refreshBackendHealth}>
              Recheck
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Firebase SDK Mode</span>
              <Badge variant={firebaseInfo.mode === 'emulator' ? 'info' : firebaseInfo.configured ? 'success' : 'danger'}>
                {firebaseInfo.mode}
              </Badge>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Server API Health</span>
              <Badge variant={backendStatus.reachable ? 'success' : 'warning'}>
                {backendStatus.reachable ? 'Connected' : 'Unreachable / Offline'}
              </Badge>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Server Firebase Admin</span>
              <Badge variant={backendStatus.firebaseAdminConfigured ? 'success' : 'warning'}>
                {backendStatus.firebaseAdminConfigured ? 'Configured' : 'Service Account Needed'}
              </Badge>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Gemini Server Secret</span>
              <Badge variant={backendStatus.geminiConfigured ? 'success' : 'neutral'}>
                {backendStatus.geminiConfigured ? 'Configured' : 'Not Configured'}
              </Badge>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Payment Gateway Secret</span>
              <Badge variant={backendStatus.paymentGatewayConfigured ? 'success' : 'neutral'}>
                {backendStatus.paymentGatewayConfigured ? 'Configured' : 'Not Configured'}
              </Badge>
            </div>
            {!activeTenant && (
              <StatusBanner
                tone="info"
                title="Awaiting College Assignment"
                description={
                  !bootstrapInitialized
                    ? 'This deployment has not been initialized yet. Complete the First-Time Production Setup below.'
                    : 'Verify your email address and ask your College Admin to invite your email under College Setup.'
                }
              />
            )}
          </CardContent>
        </Card>
      </div>
      {!activeTenant && !bootstrapInitialized && <PlatformBootstrapCard />}
    </div>
  );
}
