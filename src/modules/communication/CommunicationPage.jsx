import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Megaphone, Calendar, LifeBuoy, Bell, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { where } from '@/firebase/firestore';
import { useTenantCrud, useTenantQuery } from '@/hooks/useTenantCollection';
import { PERMISSIONS, ROLES } from '@/schemas/roles';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Label, Select, Textarea } from '@/components/ui/Input';
import { formatDate } from '@/utils/date';

export default function CommunicationPage() {
  const { user, profile, role, can } = useAuth();
  const [tab, setTab] = useState('notices');
  const [modalOpen, setModalOpen] = useState(false);

  const isTicketStaffReader =
    can(PERMISSIONS.TICKETS_MANAGE) || role === ROLES.AUDITOR || role === ROLES.PLATFORM_SUPER_ADMIN;

  const noticesQ = useTenantQuery('notices');
  const eventsQ = useTenantQuery('events');
  const ticketsQ = useTenantQuery('tickets', {
    constraints: isTicketStaffReader ? [] : user?.uid ? [where('createdByUid', '==', user.uid)] : [],
    enabled: isTicketStaffReader || Boolean(user?.uid),
    queryKeyExtra: [isTicketStaffReader ? 'all' : user?.uid],
  });
  const notificationsQ = useTenantQuery('notifications', {
    constraints: role === ROLES.PLATFORM_SUPER_ADMIN ? [] : user?.uid ? [where('recipientUid', '==', user.uid)] : [],
    enabled: role === ROLES.PLATFORM_SUPER_ADMIN || Boolean(user?.uid),
    queryKeyExtra: [role === ROLES.PLATFORM_SUPER_ADMIN ? 'all' : user?.uid],
  });

  const noticeCrud = useTenantCrud('notices', { label: 'Notice' });
  const eventCrud = useTenantCrud('events', { label: 'Event' });
  const ticketCrud = useTenantCrud('tickets', { label: 'Support ticket' });
  const notifCrud = useTenantCrud('notifications', { label: 'Notification' });

  const noticeForm = useForm({ defaultValues: { audience: 'all', title: '', body: '' } });
  const eventForm = useForm({ defaultValues: { title: '', eventDate: '', location: '', description: '' } });
  const ticketForm = useForm({ defaultValues: { subject: '', category: 'academic', priority: 'medium', description: '' } });

  const onSaveNotice = async (v) => {
    await noticeCrud.createMutation.mutateAsync({ data: { ...v, authorName: profile?.displayName || user.email } });
    noticeForm.reset();
    setModalOpen(false);
  };
  const onSaveEvent = async (v) => {
    await eventCrud.createMutation.mutateAsync({ data: v });
    eventForm.reset();
    setModalOpen(false);
  };
  const onSaveTicket = async (v) => {
    await ticketCrud.createMutation.mutateAsync({
      data: {
        ...v,
        createdByUid: user.uid,
        createdByName: profile?.displayName || user.email,
        status: 'open',
      },
    });
    ticketForm.reset();
    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Communication, Events &amp; Helpdesk"
        description="Publish campus circulars, schedule academic calendar events, track support tickets, and review notifications."
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Communication' }]}
        actions={
          ((tab === 'notices' && can(PERMISSIONS.COMMUNICATION_WRITE)) ||
            (tab === 'events' && can(PERMISSIONS.COMMUNICATION_WRITE)) ||
            tab === 'tickets') && (
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" />
              {tab === 'notices' ? 'Publish Notice' : tab === 'events' ? 'Add Event' : 'Raise Ticket'}
            </Button>
          )
        }
      />

      <Tabs
        activeTab={tab}
        onChange={setTab}
        tabs={[
          { id: 'notices', label: 'Notices', icon: Megaphone, count: (noticesQ.data || []).length },
          { id: 'events', label: 'Events', icon: Calendar, count: (eventsQ.data || []).length },
          { id: 'tickets', label: 'Helpdesk Tickets', icon: LifeBuoy, count: (ticketsQ.data || []).length },
          { id: 'notifications', label: 'My Notifications', icon: Bell, count: (notificationsQ.data || []).filter((n) => !n.read).length },
        ]}
      />

      {tab === 'notices' && (
        <DataTable
          columns={[
            { key: 'title', header: 'Notice', render: (n) => <div><p className="font-semibold text-slate-900">{n.title}</p><p className="text-xs text-slate-600 line-clamp-2">{n.body}</p></div> },
            { key: 'audience', header: 'Target Audience', render: (n) => <Badge variant="indigo">{n.audience}</Badge> },
            { key: 'authorName', header: 'Issued By' },
            { key: 'createdAt', header: 'Date', render: (n) => formatDate(n.createdAt) },
          ]}
          data={noticesQ.data || []}
          loading={noticesQ.isLoading}
        />
      )}

      {tab === 'events' && (
        <DataTable
          columns={[
            { key: 'title', header: 'Event' },
            { key: 'eventDate', header: 'Date' },
            { key: 'location', header: 'Venue' },
            { key: 'description', header: 'Details' },
          ]}
          data={eventsQ.data || []}
          loading={eventsQ.isLoading}
        />
      )}

      {tab === 'tickets' && (
        <DataTable
          columns={[
            { key: 'subject', header: 'Subject', render: (t) => <div><p className="font-medium text-slate-900">{t.subject}</p><p className="text-xs text-slate-500">{t.description}</p></div> },
            { key: 'category', header: 'Category', render: (t) => <Badge variant="neutral">{t.category}</Badge> },
            { key: 'priority', header: 'Priority', render: (t) => <Badge variant={t.priority === 'high' ? 'danger' : 'warning'}>{t.priority}</Badge> },
            {
              key: 'status',
              header: 'Status',
              render: (t) =>
                can(PERMISSIONS.TICKETS_MANAGE) ? (
                  <Select
                    aria-label="Ticket status"
                    value={t.status}
                    onChange={(e) => ticketCrud.updateMutation.mutate({ id: t.id, data: { status: e.target.value } })}
                    className="h-8 w-32 text-xs"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                  </Select>
                ) : (
                  <Badge variant={t.status === 'resolved' ? 'success' : 'warning'}>{t.status}</Badge>
                ),
            },
          ]}
          data={ticketsQ.data || []}
          loading={ticketsQ.isLoading}
        />
      )}

      {tab === 'notifications' && (
        <DataTable
          columns={[
            { key: 'title', header: 'Alert' },
            { key: 'message', header: 'Details' },
            { key: 'read', header: 'State', render: (n) => <Badge variant={n.read ? 'neutral' : 'indigo'}>{n.read ? 'Read' : 'Unread'}</Badge> },
            {
              key: 'action',
              header: 'Action',
              render: (n) =>
                !n.read ? (
                  <Button size="sm" variant="ghost" onClick={() => notifCrud.updateMutation.mutate({ id: n.id, data: { read: true } })}>
                    Mark Read
                  </Button>
                ) : '—',
            },
          ]}
          data={notificationsQ.data || []}
          loading={notificationsQ.isLoading}
        />
      )}

      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={tab === 'notices' ? 'Publish Campus Notice' : tab === 'events' ? 'Schedule Event' : 'Submit Helpdesk Ticket'}
      >
        {tab === 'notices' && (
          <form onSubmit={noticeForm.handleSubmit(onSaveNotice)} className="space-y-3.5">
            <div><Label htmlFor="nt-title" required>Notice Title</Label><Input id="nt-title" {...noticeForm.register('title', { required: true })} /></div>
            <div>
              <Label htmlFor="nt-aud">Audience</Label>
              <Select id="nt-aud" {...noticeForm.register('audience')}>
                <option value="all">All Campus</option>
                <option value="students">Students</option>
                <option value="faculty">Faculty &amp; Staff</option>
                <option value="parents">Parents / Guardians</option>
              </Select>
            </div>
            <div><Label htmlFor="nt-body" required>Circular Body</Label><Textarea id="nt-body" rows={4} {...noticeForm.register('body', { required: true })} /></div>
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button type="submit">Publish Notice</Button></div>
          </form>
        )}

        {tab === 'events' && (
          <form onSubmit={eventForm.handleSubmit(onSaveEvent)} className="space-y-3.5">
            <div><Label htmlFor="ev-title" required>Event Title</Label><Input id="ev-title" {...eventForm.register('title', { required: true })} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label htmlFor="ev-date" required>Date</Label><Input id="ev-date" type="date" {...eventForm.register('eventDate', { required: true })} /></div>
              <div><Label htmlFor="ev-loc" required>Venue</Label><Input id="ev-loc" {...eventForm.register('location', { required: true })} /></div>
            </div>
            <div><Label htmlFor="ev-desc">Description</Label><Textarea id="ev-desc" {...eventForm.register('description')} /></div>
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button type="submit">Save Event</Button></div>
          </form>
        )}

        {tab === 'tickets' && (
          <form onSubmit={ticketForm.handleSubmit(onSaveTicket)} className="space-y-3.5">
            <div><Label htmlFor="tk-subj" required>Subject</Label><Input id="tk-subj" {...ticketForm.register('subject', { required: true })} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="tk-cat">Category</Label>
                <Select id="tk-cat" {...ticketForm.register('category')}>
                  <option value="academic">Academic</option>
                  <option value="finance">Finance / Fee</option>
                  <option value="library">Library</option>
                  <option value="technical">IT / Portal</option>
                  <option value="general">General</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="tk-prio">Priority</Label>
                <Select id="tk-prio" {...ticketForm.register('priority')}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </Select>
              </div>
            </div>
            <div><Label htmlFor="tk-desc" required>Description</Label><Textarea id="tk-desc" rows={3} {...ticketForm.register('description', { required: true })} /></div>
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button type="submit">Submit Ticket</Button></div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
