import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Rocket } from 'lucide-react';
import { callTrustedFunction } from '@/firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label, FieldError } from '@/components/ui/Input';
import { StatusBanner } from '@/components/feedback/StatusBanner';

const bootstrapSchema = z.object({
  tenantId: z.string().regex(/^[a-z0-9-]{3,40}$/, 'Use 3–40 lowercase letters, numbers, or hyphens.'),
  collegeName: z.string().min(2, 'College name is required.'),
  collegeCode: z.string().min(2, 'College short code is required.'),
  city: z.string().optional().default(''),
  state: z.string().optional().default(''),
});

export function PlatformBootstrapCard() {
  const { refreshContext, backendStatus } = useAuth();
  const { toast } = useToast();
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(bootstrapSchema),
  });

  const onSubmit = async (values) => {
    setError('');
    try {
      await callTrustedFunction('bootstrapPlatform', values);
      await refreshContext();
      toast({
        variant: 'success',
        title: 'CampusOS Platform Initialized',
        description: `${values.collegeName} is ready. You are now Platform Super Admin.`,
      });
    } catch (err) {
      setError(err?.message || 'Unable to initialize platform.');
    }
  };

  return (
    <Card className="border-indigo-200">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Rocket className="h-4.5 w-4.5 text-indigo-700" />
          <div>
            <CardTitle>First-Time Production Setup</CardTitle>
            <CardDescription>
              Initialize CampusOS once by registering your Platform Super Admin &amp; primary college tenant.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {(!backendStatus.reachable || !backendStatus.firebaseAdminConfigured) && (
          <StatusBanner
            tone="warning"
            title={
              !backendStatus.reachable
                ? 'Backend API Unreachable'
                : 'Firebase Admin Service Account Required on Server'
            }
            description={
              !backendStatus.reachable
                ? 'Connect the free Vercel serverless backend (/api) or Firebase Cloud Functions before initializing.'
                : 'The Vercel API is live, but FIREBASE_SERVICE_ACCOUNT_JSON is not yet set in Vercel Environment Variables. Add your Firebase Service Account JSON to enable admin initialization, payments, and invitations.'
            }
          />
        )}
        {error && <StatusBanner tone="error" title="Initialization Failed" description={error} />}

        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3.5 sm:grid-cols-2">
          <div>
            <Label htmlFor="boot-id" required>Primary Tenant Slug ID</Label>
            <Input id="boot-id" placeholder="my-college-main" {...register('tenantId')} error={errors.tenantId} />
            <FieldError message={errors.tenantId?.message} />
          </div>
          <div>
            <Label htmlFor="boot-code" required>College Code</Label>
            <Input id="boot-code" placeholder="MCET" {...register('collegeCode')} error={errors.collegeCode} />
            <FieldError message={errors.collegeCode?.message} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="boot-name" required>College Full Name</Label>
            <Input id="boot-name" placeholder="My College of Engineering & Technology" {...register('collegeName')} error={errors.collegeName} />
            <FieldError message={errors.collegeName?.message} />
          </div>
          <div>
            <Label htmlFor="boot-city">City</Label>
            <Input id="boot-city" placeholder="City" {...register('city')} />
          </div>
          <div>
            <Label htmlFor="boot-state">State</Label>
            <Input id="boot-state" placeholder="State" {...register('state')} />
          </div>
          <div className="sm:col-span-2 flex justify-end pt-1">
            <Button type="submit" loading={isSubmitting} disabled={!backendStatus.reachable || !backendStatus.firebaseAdminConfigured}>
              Initialize Platform &amp; Create College
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
