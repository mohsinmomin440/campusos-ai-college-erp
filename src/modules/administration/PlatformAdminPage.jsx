import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Plus, CheckCircle2, Ban } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { requireDb } from '@/firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { useTrustedFunction } from '@/hooks/useTenantCollection';
import { PageHeader, StatCard } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Label, Select, FieldError } from '@/components/ui/Input';

const tenantSchema = z.object({
  tenantId: z.string().regex(/^[a-z0-9-]{3,40}$/, 'Use 3–40 lowercase letters, numbers, or hyphens.'),
  name: z.string().min(2, 'College name is required.'),
  code: z.string().min(2, 'Short code is required (e.g. NMIT).'),
  city: z.string().optional().default(''),
  state: z.string().optional().default(''),
  subscriptionPlan: z.enum(['starter', 'growth', 'enterprise']).default('growth'),
  adminEmail: z.string().email('Enter a valid email').or(z.literal('')).optional(),
  adminName: z.string().optional().default(''),
});

export default function PlatformAdminPage() {
  const { isSuperAdmin, refreshContext } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const tenantsQ = useQuery({
    queryKey: ['platform', 'tenants'],
    queryFn: async () => {
      const snap = await getDocs(collection(requireDb(), 'tenants'));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
    enabled: isSuperAdmin,
  });

  const provisionFn = useTrustedFunction('provisionTenant', { successTitle: 'College tenant provisioned' });
  const statusFn = useTrustedFunction('updateTenantStatus', { successTitle: 'Tenant status updated' });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(tenantSchema),
    defaultValues: { subscriptionPlan: 'growth' },
  });

  const onCreate = async (values) => {
    const payload = { ...values };
    if (!payload.adminEmail) delete payload.adminEmail;
    await provisionFn.mutateAsync(payload);
    await queryClient.invalidateQueries({ queryKey: ['platform', 'tenants'] });
    await refreshContext();
    reset();
    setDialogOpen(false);
  };

  const toggleStatus = async (tenant) => {
    const nextStatus = tenant.status === 'active' ? 'suspended' : 'active';
    await statusFn.mutateAsync({ tenantId: tenant.id, status: nextStatus });
    await queryClient.invalidateQueries({ queryKey: ['platform', 'tenants'] });
    await refreshContext();
  };

  const tenants = tenantsQ.data || [];
  const activeCount = tenants.filter((t) => t.status === 'active').length;

  const columns = [
    {
      key: 'name',
      header: 'College / Tenant',
      render: (t) => (
        <div>
          <p className="font-semibold text-slate-900">{t.name}</p>
          <p className="font-mono text-xs text-slate-500">{t.id} • {t.code}</p>
        </div>
      ),
    },
    {
      key: 'city',
      header: 'Location',
      render: (t) => [t.city, t.state].filter(Boolean).join(', ') || '—',
    },
    {
      key: 'subscriptionPlan',
      header: 'Plan',
      render: (t) => <Badge variant="indigo">{t.subscriptionPlan || 'growth'}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (t) => (
        <Badge variant={t.status === 'active' ? 'success' : 'danger'}>
          {t.status || 'active'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (t) => (
        <Button
          size="sm"
          variant={t.status === 'active' ? 'secondary' : 'success'}
          loading={statusFn.isPending}
          onClick={() => toggleStatus(t)}
        >
          {t.status === 'active' ? (
            <>
              <Ban className="h-3.5 w-3.5" /> Suspend
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" /> Activate
            </>
          )}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Administration"
        description="Provision colleges, manage multi-tenant subscription plans, and control tenant activation."
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Platform Admin' }]}
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Provision College
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Colleges" value={tenants.length} icon={Building2} tone="indigo" />
        <StatCard label="Active Colleges" value={activeCount} icon={CheckCircle2} tone="emerald" />
        <StatCard label="Suspended Colleges" value={tenants.length - activeCount} icon={Ban} tone="rose" />
      </div>

      <DataTable
        columns={columns}
        data={tenants}
        loading={tenantsQ.isLoading}
        error={tenantsQ.error}
        onRetry={tenantsQ.refetch}
        searchKeys={['name', 'code', 'id', 'city']}
        searchPlaceholder="Search colleges by name, code, or city..."
        emptyTitle="No college tenants provisioned"
        emptyActionLabel="Provision First College"
        onEmptyAction={() => setDialogOpen(true)}
      />

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Provision New College Tenant"
        description="Creates an isolated Firestore tenant workspace via trusted Cloud Function."
      >
        <form onSubmit={handleSubmit(onCreate)} className="space-y-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="t-id" required>Tenant Slug ID</Label>
              <Input id="t-id" placeholder="st-xaviers-bca" {...register('tenantId')} error={errors.tenantId} />
              <FieldError message={errors.tenantId?.message} />
            </div>
            <div>
              <Label htmlFor="t-code" required>College Code</Label>
              <Input id="t-code" placeholder="SXC" {...register('code')} error={errors.code} />
              <FieldError message={errors.code?.message} />
            </div>
          </div>
          <div>
            <Label htmlFor="t-name" required>College Full Name</Label>
            <Input id="t-name" placeholder="St. Xavier Institute of Computing" {...register('name')} error={errors.name} />
            <FieldError message={errors.name?.message} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="t-city">City</Label>
              <Input id="t-city" placeholder="Bengaluru" {...register('city')} />
            </div>
            <div>
              <Label htmlFor="t-state">State</Label>
              <Input id="t-state" placeholder="Karnataka" {...register('state')} />
            </div>
            <div>
              <Label htmlFor="t-plan">Plan</Label>
              <Select id="t-plan" {...register('subscriptionPlan')}>
                <option value="starter">Starter</option>
                <option value="growth">Growth</option>
                <option value="enterprise">Enterprise</option>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 border-t border-slate-100 pt-3">
            <div>
              <Label htmlFor="t-admin-email">Initial College Admin Email</Label>
              <Input id="t-admin-email" type="email" placeholder="principal@college.edu" {...register('adminEmail')} error={errors.adminEmail} />
              <FieldError message={errors.adminEmail?.message} />
            </div>
            <div>
              <Label htmlFor="t-admin-name">Admin Name</Label>
              <Input id="t-admin-name" placeholder="Dr. K. Sharma" {...register('adminName')} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" loading={provisionFn.isPending}>Provision Tenant</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
