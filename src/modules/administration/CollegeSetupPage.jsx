import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { UserPlus, Settings, Shield, Mail } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { requireDb } from '@/firebase/firestore';
import { useTenantQuery, useTrustedFunction } from '@/hooks/useTenantCollection';
import { ROLE_LABELS, ROLES } from '@/schemas/roles';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, FieldError } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { DataTable } from '@/components/tables/DataTable';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/hooks/useToast';

const settingsSchema = z.object({
  name: z.string().min(2),
  city: z.string().optional().default(''),
  state: z.string().optional().default(''),
  contactEmail: z.string().email().or(z.literal('')).optional(),
  attendanceThresholdPercent: z.coerce.number().int().min(50).max(95),
});

const memberSchema = z.object({
  email: z.string().email('Valid Firebase user email required.'),
  displayName: z.string().min(2, 'Display name is required.'),
  role: z.enum(Object.values(ROLES).filter((r) => r !== ROLES.PLATFORM_SUPER_ADMIN)),
  status: z.enum(['active', 'disabled']).default('active'),
  linkedStudentIdsRaw: z.string().optional().default(''),
});

export default function CollegeSetupPage() {
  const { activeTenant, activeTenantId, refreshContext } = useAuth();
  const { toast } = useToast();
  const [memberOpen, setMemberOpen] = useState(false);
  const [memberTab, setMemberTab] = useState('members');

  const membersQ = useTenantQuery('members');
  const invitationsQ = useTenantQuery('invitations');
  const assignRoleFn = useTrustedFunction('assignMemberRole', {
    invalidateCollections: ['members', 'invitations'],
    successTitle: 'Membership / invitation saved',
  });

  const settingsForm = useForm({
    resolver: zodResolver(settingsSchema),
    values: {
      name: activeTenant?.name || '',
      city: activeTenant?.city || '',
      state: activeTenant?.state || '',
      contactEmail: activeTenant?.contactEmail || '',
      attendanceThresholdPercent: activeTenant?.attendanceThresholdPercent || 75,
    },
  });

  const memberForm = useForm({
    resolver: zodResolver(memberSchema),
    defaultValues: { role: ROLES.FACULTY, status: 'active', linkedStudentIdsRaw: '' },
  });

  const saveSettings = async (values) => {
    try {
      await updateDoc(doc(requireDb(), 'tenants', activeTenantId), {
        ...values,
        updatedAt: serverTimestamp(),
      });
      await refreshContext();
      toast({ variant: 'success', title: 'College settings updated' });
    } catch (err) {
      toast({ variant: 'error', title: 'Unable to save settings', description: err.message });
    }
  };

  const assignMember = async (values) => {
    const linkedStudentIds = values.linkedStudentIdsRaw
      ? values.linkedStudentIdsRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    await assignRoleFn.mutateAsync({
      tenantId: activeTenantId,
      email: values.email,
      displayName: values.displayName,
      role: values.role,
      status: values.status,
      linkedStudentIds,
    });
    memberForm.reset();
    setMemberOpen(false);
  };

  const memberColumns = [
    {
      key: 'displayName',
      header: 'Member',
      render: (m) => (
        <div>
          <p className="font-medium text-slate-900">{m.displayName || '—'}</p>
          <p className="text-xs text-slate-500">{m.email || m.uid}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Assigned Role',
      render: (m) => <Badge variant="indigo">{ROLE_LABELS[m.role] || m.role}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (m) => <Badge variant={m.status === 'active' ? 'success' : 'danger'}>{m.status}</Badge>,
    },
    {
      key: 'linkedStudentIds',
      header: 'Linked Students',
      render: (m) => (Array.isArray(m.linkedStudentIds) && m.linkedStudentIds.length ? m.linkedStudentIds.join(', ') : '—'),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="College Administration &amp; Members"
        description="Configure institution profile, attendance policy thresholds, and trusted role memberships."
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'College Setup' }]}
        actions={
          <Button onClick={() => setMemberOpen(true)}>
            <UserPlus className="h-4 w-4" /> Assign Member Role
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-indigo-600" />
            <div>
              <CardTitle>Institution Configuration</CardTitle>
              <CardDescription>Tenant ID: {activeTenantId || '—'}</CardDescription>
            </div>
          </div>
          <Badge variant={activeTenant?.status === 'active' ? 'success' : 'danger'}>
            {activeTenant?.status || 'unknown'}
          </Badge>
        </CardHeader>
        <CardContent>
          <form onSubmit={settingsForm.handleSubmit(saveSettings)} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label htmlFor="c-name" required>College Name</Label>
              <Input id="c-name" {...settingsForm.register('name')} error={settingsForm.formState.errors.name} />
              <FieldError message={settingsForm.formState.errors.name?.message} />
            </div>
            <div>
              <Label htmlFor="c-city">City</Label>
              <Input id="c-city" {...settingsForm.register('city')} />
            </div>
            <div>
              <Label htmlFor="c-state">State</Label>
              <Input id="c-state" {...settingsForm.register('state')} />
            </div>
            <div>
              <Label htmlFor="c-email">Official Contact Email</Label>
              <Input id="c-email" type="email" {...settingsForm.register('contactEmail')} />
            </div>
            <div>
              <Label htmlFor="c-att" required>Attendance Shortage Threshold (%)</Label>
              <Input id="c-att" type="number" {...settingsForm.register('attendanceThresholdPercent')} />
            </div>
            <div className="flex items-end">
              <Button type="submit" loading={settingsForm.formState.isSubmitting}>
                Save College Settings
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Tabs
          activeTab={memberTab}
          onChange={setMemberTab}
          tabs={[
            { id: 'members', label: 'Active & Disabled Members', icon: Shield, count: (membersQ.data || []).length },
            { id: 'invitations', label: 'Pending Invitations', icon: Mail, count: (invitationsQ.data || []).filter((i) => i.status === 'pending').length },
          ]}
        />
        {memberTab === 'members' ? (
          <DataTable
            columns={memberColumns}
            data={membersQ.data || []}
            loading={membersQ.isLoading}
            error={membersQ.error}
            onRetry={membersQ.refetch}
            searchKeys={['displayName', 'email', 'role']}
            searchPlaceholder="Filter members by name, email, or role..."
          />
        ) : (
          <DataTable
            columns={[
              { key: 'displayName', header: 'Invitee', render: (i) => <div><p className="font-medium text-slate-900">{i.displayName}</p><p className="text-xs text-slate-500">{i.email}</p></div> },
              { key: 'role', header: 'Invited Role', render: (i) => <Badge variant="indigo">{ROLE_LABELS[i.role] || i.role}</Badge> },
              { key: 'status', header: 'State', render: (i) => <Badge variant={i.status === 'accepted' ? 'success' : 'warning'}>{i.status}</Badge> },
            ]}
            data={invitationsQ.data || []}
            loading={invitationsQ.isLoading}
            error={invitationsQ.error}
            onRetry={invitationsQ.refetch}
            searchKeys={['displayName', 'email', 'role', 'status']}
            searchPlaceholder="Search invitations..."
          />
        )}
      </div>

      <Dialog
        open={memberOpen}
        onClose={() => setMemberOpen(false)}
        title="Assign or Invite Tenant Member"
        description="Assigns role immediately if registered, or creates a secure invitation claimed automatically upon email verification."
      >
        <form onSubmit={memberForm.handleSubmit(assignMember)} className="space-y-3.5">
          <div>
            <Label htmlFor="m-email" required>Registered User Email</Label>
            <Input id="m-email" type="email" placeholder="faculty@college.edu" {...memberForm.register('email')} error={memberForm.formState.errors.email} />
            <FieldError message={memberForm.formState.errors.email?.message} />
          </div>
          <div>
            <Label htmlFor="m-name" required>Display Name</Label>
            <Input id="m-name" placeholder="Prof. R. Iyer" {...memberForm.register('displayName')} error={memberForm.formState.errors.displayName} />
            <FieldError message={memberForm.formState.errors.displayName?.message} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="m-role" required>Role</Label>
              <Select id="m-role" {...memberForm.register('role')}>
                {Object.values(ROLES)
                  .filter((r) => r !== ROLES.PLATFORM_SUPER_ADMIN)
                  .map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="m-status" required>Account Status</Label>
              <Select id="m-status" {...memberForm.register('status')}>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="m-linked">Linked Student IDs (comma-separated, for Parent role)</Label>
            <Input id="m-linked" placeholder="stu-001, stu-002" {...memberForm.register('linkedStudentIdsRaw')} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setMemberOpen(false)}>Cancel</Button>
            <Button type="submit" loading={assignRoleFn.isPending}>Assign Role</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
