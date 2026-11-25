import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BriefcaseBusiness, Plus, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { where } from '@/firebase/firestore';
import { useTenantCrud, useTenantQuery } from '@/hooks/useTenantCollection';
import { PERMISSIONS, ROLES } from '@/schemas/roles';
import { PageHeader, StatCard } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Label, Select } from '@/components/ui/Input';

const driveSchema = z.object({
  companyName: z.string().min(2),
  roleTitle: z.string().min(2),
  opportunityType: z.enum(['full_time', 'internship']),
  compensation: z.string().min(2),
  minPercentage: z.coerce.number().min(0).max(100).default(60),
  interviewDate: z.string().min(4),
  status: z.enum(['open', 'closed']).default('open'),
});

export default function PlacementsPage() {
  const { user, profile, role, can } = useAuth();
  const [tab, setTab] = useState('drives');
  const [driveOpen, setDriveOpen] = useState(false);

  const drivesQ = useTenantQuery('placements');
  const isStaffPlacementReader =
    role === ROLES.PLATFORM_SUPER_ADMIN ||
    role === ROLES.COLLEGE_ADMIN ||
    role === ROLES.PRINCIPAL ||
    role === ROLES.PLACEMENT_OFFICER ||
    role === ROLES.AUDITOR;
  const appsQ = useTenantQuery('placementApplications', {
    constraints: isStaffPlacementReader ? [] : user?.uid ? [where('studentUid', '==', user.uid)] : [],
    enabled: isStaffPlacementReader || role === ROLES.STUDENT,
    queryKeyExtra: [isStaffPlacementReader ? 'all' : user?.uid],
  });
  const driveCrud = useTenantCrud('placements', { label: 'Placement drive' });
  const appCrud = useTenantCrud('placementApplications', { label: 'Application' });

  const { register, handleSubmit, reset } = useForm({
    resolver: zodResolver(driveSchema),
    defaultValues: { opportunityType: 'full_time', minPercentage: 60, status: 'open' },
  });

  const onCreateDrive = async (values) => {
    await driveCrud.createMutation.mutateAsync({ data: values });
    reset();
    setDriveOpen(false);
  };

  const applyToDrive = async (drive) => {
    await appCrud.createMutation.mutateAsync({
      customId: `${drive.id}_${user.uid}`,
      data: {
        driveId: drive.id,
        companyName: drive.companyName,
        roleTitle: drive.roleTitle,
        studentUid: user.uid,
        studentName: profile?.displayName || user.email,
        status: 'applied',
      },
    });
  };

  const drives = drivesQ.data || [];
  const apps = appsQ.data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Placements &amp; Internships"
        description="Company drives, deterministic eligibility thresholds, student applications, interview schedules, and placement outcomes."
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Placements' }]}
        actions={
          can(PERMISSIONS.PLACEMENTS_WRITE) && (
            <Button onClick={() => setDriveOpen(true)}>
              <Plus className="h-4 w-4" /> Post Placement Drive
            </Button>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Active Drives" value={drives.filter((d) => d.status === 'open').length} icon={BriefcaseBusiness} tone="indigo" />
        <StatCard label="Student Applications" value={apps.length} icon={BriefcaseBusiness} tone="amber" />
        <StatCard label="Offers Recorded" value={apps.filter((a) => a.status === 'offered').length} icon={CheckCircle2} tone="emerald" />
      </div>

      <Tabs
        activeTab={tab}
        onChange={setTab}
        tabs={[
          { id: 'drives', label: 'Companies & Drives', count: drives.length },
          { id: 'applications', label: 'Applications & Outcomes', count: apps.length },
        ]}
      />

      {tab === 'drives' ? (
        <DataTable
          columns={[
            { key: 'companyName', header: 'Company', render: (d) => <div><p className="font-semibold text-slate-900">{d.companyName}</p><p className="text-xs text-slate-500">{d.roleTitle}</p></div> },
            { key: 'opportunityType', header: 'Type', render: (d) => <Badge variant="indigo">{d.opportunityType}</Badge> },
            { key: 'compensation', header: 'Package / Stipend' },
            { key: 'minPercentage', header: 'Min Eligibility', render: (d) => `${d.minPercentage}%` },
            { key: 'interviewDate', header: 'Drive Date' },
            {
              key: 'actions',
              header: 'Apply / Status',
              render: (d) =>
                role === ROLES.STUDENT && d.status === 'open' ? (
                  <Button size="sm" onClick={() => applyToDrive(d)} loading={appCrud.createMutation.isPending}>
                    Apply
                  </Button>
                ) : (
                  <Badge variant={d.status === 'open' ? 'success' : 'neutral'}>{d.status}</Badge>
                ),
            },
          ]}
          data={drives}
          loading={drivesQ.isLoading}
          searchKeys={['companyName', 'roleTitle']}
        />
      ) : (
        <DataTable
          columns={[
            { key: 'studentName', header: 'Student' },
            { key: 'companyName', header: 'Company' },
            { key: 'roleTitle', header: 'Role' },
            { key: 'status', header: 'Stage', render: (a) => <Badge variant={a.status === 'offered' ? 'success' : 'indigo'}>{a.status}</Badge> },
            {
              key: 'actions',
              header: 'Review',
              render: (a) =>
                can(PERMISSIONS.PLACEMENTS_WRITE) ? (
                  <Select
                    aria-label="Update placement application status"
                    value={a.status}
                    onChange={(e) => appCrud.updateMutation.mutate({ id: a.id, data: { status: e.target.value } })}
                    className="h-8 w-32 text-xs"
                  >
                    <option value="applied">Applied</option>
                    <option value="shortlisted">Shortlisted</option>
                    <option value="interviewed">Interviewed</option>
                    <option value="offered">Offered</option>
                    <option value="rejected">Rejected</option>
                  </Select>
                ) : '—',
            },
          ]}
          data={apps}
          loading={appsQ.isLoading}
        />
      )}

      <Dialog open={driveOpen} onClose={() => setDriveOpen(false)} title="Create Placement / Internship Drive">
        <form onSubmit={handleSubmit(onCreateDrive)} className="space-y-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor="pl-co" required>Company Name</Label><Input id="pl-co" {...register('companyName')} /></div>
            <div><Label htmlFor="pl-role" required>Role Title</Label><Input id="pl-role" {...register('roleTitle')} /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="pl-type">Type</Label>
              <Select id="pl-type" {...register('opportunityType')}>
                <option value="full_time">Full Time</option>
                <option value="internship">Internship</option>
              </Select>
            </div>
            <div><Label htmlFor="pl-comp" required>CTC / Stipend</Label><Input id="pl-comp" placeholder="6.5 LPA" {...register('compensation')} /></div>
            <div><Label htmlFor="pl-min">Min % Rule</Label><Input id="pl-min" type="number" {...register('minPercentage')} /></div>
          </div>
          <div><Label htmlFor="pl-date" required>Drive / Interview Date</Label><Input id="pl-date" type="date" {...register('interviewDate')} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setDriveOpen(false)}>Cancel</Button>
            <Button type="submit" loading={driveCrud.createMutation.isPending}>Publish Drive</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
