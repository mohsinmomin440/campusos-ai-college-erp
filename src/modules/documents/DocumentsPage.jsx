import { useMemo, useState } from 'react';
import { FileText, Upload, CheckCircle2, Printer, ExternalLink, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { where } from '@/firebase/firestore';
import { useTenantCrud, useTenantQuery } from '@/hooks/useTenantCollection';
import { uploadTenantDocument, deleteTenantStorageFile } from '@/firebase/storage';
import { PERMISSIONS, ROLES } from '@/schemas/roles';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { Input, Label, Select } from '@/components/ui/Input';
import { useToast } from '@/hooks/useToast';
import { formatDate, todayIsoDate } from '@/utils/date';

export default function DocumentsPage() {
  const { activeTenantId, activeTenant, user, role, can } = useAuth();
  const { toast } = useToast();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [certOpen, setCertOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState('file');
  const [externalUrl, setExternalUrl] = useState('');
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('academic_record');
  const [visibility, setVisibility] = useState('private');
  const [uploading, setUploading] = useState(false);

  const [certStudentId, setCertStudentId] = useState('');
  const [certType, setCertType] = useState('Bonafide Certificate');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const isPrivilegedDocReader =
    role === ROLES.PLATFORM_SUPER_ADMIN ||
    role === ROLES.COLLEGE_ADMIN ||
    role === ROLES.PRINCIPAL ||
    role === ROLES.ADMISSION_OFFICER ||
    role === ROLES.HOD ||
    role === ROLES.AUDITOR;

  const allDocsQ = useTenantQuery('documents', { enabled: isPrivilegedDocReader, queryKeyExtra: ['all'] });
  const ownDocsQ = useTenantQuery('documents', {
    constraints: user?.uid ? [where('ownerUid', '==', user.uid)] : [],
    enabled: !isPrivilegedDocReader && Boolean(user?.uid),
    queryKeyExtra: ['own', user?.uid],
  });
  const sharedDocsQ = useTenantQuery('documents', {
    constraints: [where('visibility', '==', 'tenant')],
    enabled: !isPrivilegedDocReader,
    queryKeyExtra: ['shared'],
  });
  const mergedDocs = useMemo(() => {
    if (isPrivilegedDocReader) return allDocsQ.data || [];
    const map = new Map();
    [...(ownDocsQ.data || []), ...(sharedDocsQ.data || [])].forEach((d) => map.set(d.id, d));
    return Array.from(map.values());
  }, [isPrivilegedDocReader, allDocsQ.data, ownDocsQ.data, sharedDocsQ.data]);
  const docsLoading = isPrivilegedDocReader ? allDocsQ.isLoading : ownDocsQ.isLoading || sharedDocsQ.isLoading;
  const docsError = isPrivilegedDocReader ? allDocsQ.error : ownDocsQ.error || sharedDocsQ.error;

  const studentsQ = useTenantQuery('students', { enabled: can(PERMISSIONS.DOCUMENTS_VERIFY) });
  const docCrud = useTenantCrud('documents', { label: 'Document' });

  const handleDeleteDocument = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.storagePath) {
        await deleteTenantStorageFile(deleteTarget.storagePath).catch(() => {});
      }
      await docCrud.deleteMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      toast({ variant: 'error', title: 'Delete failed', description: err.message });
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setUploading(true);
    try {
      if (uploadMode === 'link') {
        let parsedUrl;
        try {
          parsedUrl = new URL(externalUrl.trim());
        } catch {
          throw new Error('Enter a valid HTTPS document URL.');
        }
        if (parsedUrl.protocol !== 'https:') {
          throw new Error('Only secure https:// document links are allowed.');
        }
        await docCrud.createMutation.mutateAsync({
          data: {
            title: title.trim(),
            category,
            visibility,
            ownerUid: user.uid,
            verified: false,
            downloadUrl: parsedUrl.toString(),
            fileName: parsedUrl.hostname,
            sizeBytes: 0,
            storageType: 'external_link',
          },
        });
      } else {
        if (!file) throw new Error('Please select a file to upload.');
        const uploaded = await uploadTenantDocument({
          tenantId: activeTenantId,
          folder: visibility === 'tenant' ? 'knowledge' : 'documents',
          file,
          ownerUid: user.uid,
        });
        await docCrud.createMutation.mutateAsync({
          data: {
            title: title.trim(),
            category,
            visibility,
            ownerUid: user.uid,
            verified: false,
            storageType: 'firebase_storage',
            ...uploaded,
          },
        });
      }
      setFile(null);
      setExternalUrl('');
      setTitle('');
      setUploadOpen(false);
    } catch (err) {
      toast({ variant: 'error', title: 'Document save rejected', description: err.message });
    } finally {
      setUploading(false);
    }
  };

  const selectedStudent = (studentsQ.data || []).find((s) => s.id === certStudentId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents &amp; Certificates"
        description="Tenant-scoped Firebase Storage uploads (PDF/JPG/PNG/WEBP, 5 MB max), verification workflow, and official certificates."
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Documents' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            {can(PERMISSIONS.DOCUMENTS_VERIFY) && (
              <Button variant="secondary" onClick={() => setCertOpen(true)}>
                <FileText className="h-4 w-4" /> Generate Certificate
              </Button>
            )}
            {can(PERMISSIONS.DOCUMENTS_WRITE) && (
              <Button onClick={() => setUploadOpen(true)}>
                <Upload className="h-4 w-4" /> Upload Document
              </Button>
            )}
          </div>
        }
      />

      <DataTable
        columns={[
          { key: 'title', header: 'Document Title', render: (d) => <div><p className="font-medium text-slate-900">{d.title}</p><p className="text-xs text-slate-500">{d.fileName} • {Math.round((d.sizeBytes || 0) / 1024)} KB</p></div> },
          { key: 'category', header: 'Category', render: (d) => <Badge variant="neutral">{d.category}</Badge> },
          { key: 'visibility', header: 'Scope', render: (d) => <Badge variant="indigo">{d.visibility || 'private'}</Badge> },
          { key: 'verified', header: 'Verification', render: (d) => <Badge variant={d.verified ? 'success' : 'warning'}>{d.verified ? 'Verified' : 'Pending'}</Badge> },
          { key: 'createdAt', header: 'Uploaded', render: (d) => formatDate(d.createdAt) },
          {
            key: 'actions',
            header: 'Actions',
            render: (d) => (
              <div className="flex items-center gap-2">
                {d.downloadUrl && (
                  <a
                    href={d.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:underline"
                  >
                    Open <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {can(PERMISSIONS.DOCUMENTS_VERIFY) && !d.verified && (
                  <Button size="sm" variant="success" onClick={() => docCrud.updateMutation.mutate({ id: d.id, data: { verified: true } })}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Verify
                  </Button>
                )}
                {can(PERMISSIONS.TENANT_SETTINGS) && (
                  <Button size="sm" variant="ghost" aria-label={`Delete ${d.title}`} onClick={() => setDeleteTarget(d)}>
                    <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                  </Button>
                )}
              </div>
            ),
          },
        ]}
        data={mergedDocs}
        loading={docsLoading}
        error={docsError}
        searchKeys={['title', 'fileName', 'category']}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteDocument}
        loading={docCrud.deleteMutation.isPending}
        title="Delete Document"
        description={`Permanently delete "${deleteTarget?.title || ''}" and remove its Storage file?`}
        confirmLabel="Delete Permanently"
      />

      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} title="Add Verified / Secure Document">
        <form onSubmit={handleUpload} className="space-y-3.5">
          <div>
            <Label htmlFor="doc-mode">Document Source</Label>
            <Select id="doc-mode" value={uploadMode} onChange={(e) => setUploadMode(e.target.value)}>
              <option value="file">Upload File (Firebase Storage — requires Storage enabled)</option>
              <option value="link">Register External HTTPS Document Link (Works on Spark Free)</option>
            </Select>
          </div>
          <div><Label htmlFor="doc-title" required>Document Title</Label><Input id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="doc-cat">Category</Label>
              <Select id="doc-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="academic_record">Academic Marksheet / Transcript</option>
                <option value="identity">Identity / Admission Proof</option>
                <option value="handbook">College Handbook / Policy</option>
                <option value="certificate">Certificate</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="doc-vis">Visibility</Label>
              <Select id="doc-vis" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
                <option value="private">Private (Owner + Authorized Staff)</option>
                <option value="tenant">College-wide Verified Resource</option>
              </Select>
            </div>
          </div>
          {uploadMode === 'file' ? (
            <div>
              <Label htmlFor="doc-file" required>Select File (PDF, JPG, PNG, WEBP up to 5 MB)</Label>
              <input
                id="doc-file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
                required
              />
            </div>
          ) : (
            <div>
              <Label htmlFor="doc-url" required>HTTPS Document URL</Label>
              <Input
                id="doc-url"
                type="url"
                placeholder="https://drive.google.com/file/..."
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                required
              />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button type="submit" loading={uploading}>Upload to Storage</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={certOpen} onClose={() => setCertOpen(false)} title="Authorized Certificate Generator" maxWidth="max-w-xl">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 no-print">
            <div>
              <Label htmlFor="cert-stu">Student</Label>
              <Select id="cert-stu" value={certStudentId} onChange={(e) => setCertStudentId(e.target.value)}>
                <option value="">Select student</option>
                {(studentsQ.data || []).map((s) => (
                  <option key={s.id} value={s.id}>{s.fullName} ({s.enrollmentNumber})</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="cert-type">Template</Label>
              <Select id="cert-type" value={certType} onChange={(e) => setCertType(e.target.value)}>
                <option value="Bonafide Certificate">Bonafide Certificate</option>
                <option value="Enrollment Verification">Enrollment Verification</option>
                <option value="Course Completion Certificate">Course Completion Certificate</option>
              </Select>
            </div>
          </div>

          {selectedStudent && (
            <div className="rounded-xl border-2 border-slate-300 bg-white p-6 space-y-4">
              <div className="text-center border-b border-slate-200 pb-3">
                <p className="font-heading text-lg font-bold text-indigo-900">{activeTenant?.name || 'CampusOS Institution'}</p>
                <p className="text-xs uppercase tracking-widest text-slate-500 mt-1">{certType}</p>
              </div>
              <p className="text-sm leading-relaxed text-slate-700">
                This is to certify that <strong>{selectedStudent.fullName}</strong>, bearing enrollment number{' '}
                <strong className="font-mono">{selectedStudent.enrollmentNumber}</strong>, is a{' '}
                <strong>{selectedStudent.status}</strong> student in semester <strong>{selectedStudent.semesterId}</strong> at{' '}
                {activeTenant?.name}.
              </p>
              <div className="flex justify-between pt-6 text-xs text-slate-500">
                <span>Date Issued: {todayIsoDate()}</span>
                <span className="font-semibold text-slate-800">Registrar / Principal Signature</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 no-print">
            <Button variant="secondary" onClick={() => setCertOpen(false)}>Close</Button>
            <Button disabled={!selectedStudent} onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print / Save PDF
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
