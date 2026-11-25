import { useState } from 'react';
import { ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTenantQuery } from '@/hooks/useTenantCollection';
import { orderBy, limit } from '@/firebase/firestore';
import { ROLES } from '@/schemas/roles';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { formatDateTime } from '@/utils/date';

export default function AuditLogsPage() {
  const { role } = useAuth();
  const [tab, setTab] = useState('audit');
  const canSeeAiLogs = role !== ROLES.ACCOUNTANT;

  const auditQ = useTenantQuery('auditLogs', {
    constraints: [orderBy('createdAt', 'desc'), limit(100)],
  });
  const aiLogsQ = useTenantQuery('aiLogs', {
    constraints: [orderBy('createdAt', 'desc'), limit(100)],
    enabled: canSeeAiLogs,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs &amp; Security Governance"
        description="Immutable server-generated audit trail for role changes, admissions, marks publication, fee payments, and AI usage."
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Audit Logs' }]}
      />

      <Tabs
        activeTab={tab}
        onChange={setTab}
        tabs={[
          { id: 'audit', label: 'Security & ERP Audit Trail', icon: ShieldCheck, count: (auditQ.data || []).length },
          ...(canSeeAiLogs ? [{ id: 'ai', label: 'Gemini AI Audit Log', icon: Sparkles, count: (aiLogsQ.data || []).length }] : []),
        ]}
      />

      {tab === 'audit' ? (
        <DataTable
          columns={[
            { key: 'createdAt', header: 'Timestamp', render: (l) => formatDateTime(l.createdAt) },
            { key: 'module', header: 'Module', render: (l) => <Badge variant="indigo">{l.module}</Badge> },
            { key: 'action', header: 'Action', render: (l) => <span className="font-mono text-xs">{l.action}</span> },
            { key: 'actorRole', header: 'Actor Role', render: (l) => <Badge variant="neutral">{l.actorRole}</Badge> },
            { key: 'summary', header: 'Summary' },
          ]}
          data={auditQ.data || []}
          loading={auditQ.isLoading}
          error={auditQ.error}
          onRetry={auditQ.refetch}
          searchKeys={['module', 'action', 'actorRole', 'summary']}
        />
      ) : (
        <DataTable
          columns={[
            { key: 'createdAt', header: 'Timestamp', render: (l) => formatDateTime(l.createdAt) },
            { key: 'feature', header: 'AI Feature', render: (l) => <Badge variant="indigo">{l.feature}</Badge> },
            { key: 'model', header: 'Model' },
            { key: 'actorRole', header: 'Caller Role' },
            { key: 'latencyMs', header: 'Latency', render: (l) => `${l.latencyMs || 0} ms` },
            { key: 'outcome', header: 'Outcome', render: (l) => <Badge variant={l.outcome === 'success' ? 'success' : 'danger'}>{l.outcome}</Badge> },
          ]}
          data={aiLogsQ.data || []}
          loading={aiLogsQ.isLoading}
          error={aiLogsQ.error}
          onRetry={aiLogsQ.refetch}
        />
      )}
    </div>
  );
}
