import { useState } from 'react';
import { Sparkles, Send, BookOpen, ShieldAlert, CheckCircle2, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { where } from '@/firebase/firestore';
import { useTenantCrud, useTenantQuery, useTrustedFunction } from '@/hooks/useTenantCollection';
import { PERMISSIONS, ROLES } from '@/schemas/roles';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Label, Select, Textarea } from '@/components/ui/Input';
import { StatusBanner } from '@/components/feedback/StatusBanner';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/hooks/useToast';

const AI_TASKS = [
  { id: 'knowledge_assistant', label: 'College Knowledge Assistant (RAG)', staffOnly: false },
  { id: 'report_assistant', label: 'Natural-Language Report Assistant', staffOnly: false },
  { id: 'attendance_insights', label: 'Attendance Trend Insights', staffOnly: false },
  { id: 'academic_summary', label: 'Academic Performance Summary', staffOnly: false },
  { id: 'document_summarize', label: 'College Document Summarization', staffOnly: false },
  { id: 'notice_draft', label: 'Notice Drafting (Human Review Required)', staffOnly: true },
  { id: 'timetable_suggestion', label: 'Timetable Clash-Aware Suggestion', staffOnly: true },
  { id: 'ticket_categorize', label: 'Helpdesk Ticket Categorization', staffOnly: true },
];

export default function AiAssistantPage() {
  const { activeTenantId, backendStatus, user, profile, role, can } = useAuth();
  const { toast } = useToast();

  const [task, setTask] = useState('knowledge_assistant');
  const [prompt, setPrompt] = useState('');
  const [selectedDocId, setSelectedDocId] = useState('');
  const [response, setResponse] = useState(null);
  const [kbOpen, setKbOpen] = useState(false);
  const [kbTitle, setKbTitle] = useState('');
  const [kbCategory, setKbCategory] = useState('Policy');
  const [kbContent, setKbContent] = useState('');

  const isPrivilegedDocReader =
    role === ROLES.PLATFORM_SUPER_ADMIN ||
    role === ROLES.COLLEGE_ADMIN ||
    role === ROLES.PRINCIPAL ||
    role === ROLES.ADMISSION_OFFICER ||
    role === ROLES.HOD ||
    role === ROLES.AUDITOR;

  const kbQ = useTenantQuery('knowledgeDocuments');
  const docsQ = useTenantQuery('documents', {
    constraints: isPrivilegedDocReader ? [] : user?.uid ? [where('ownerUid', '==', user.uid)] : [],
    enabled: isPrivilegedDocReader || Boolean(user?.uid),
    queryKeyExtra: [isPrivilegedDocReader ? 'all' : user?.uid],
  });
  const kbCrud = useTenantCrud('knowledgeDocuments', { label: 'Knowledge document' });
  const noticeCrud = useTenantCrud('notices', { label: 'Approved notice' });
  const runAiFn = useTrustedFunction('runCampusAi', { successTitle: 'AI response ready' });

  const availableTasks = AI_TASKS.filter((t) => !t.staffOnly || can(PERMISSIONS.AI_STAFF_DRAFT));

  const handleRunAi = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    const res = await runAiFn.mutateAsync({
      tenantId: activeTenantId,
      task,
      prompt: prompt.trim(),
      ...(selectedDocId ? { documentId: selectedDocId } : {}),
    });
    setResponse(res);
  };

  const handleApproveNoticeDraft = async () => {
    if (!response?.output) return;
    await noticeCrud.createMutation.mutateAsync({
      data: {
        title: `Notice: ${prompt.slice(0, 60)}`,
        audience: 'all',
        body: response.output,
        authorName: `${profile?.displayName || user?.email} (AI-assisted, Human Approved)`,
      },
    });
    toast({ variant: 'success', title: 'Notice approved & published to campus feed' });
  };

  const handleAddKbDoc = async (e) => {
    e.preventDefault();
    if (!kbTitle.trim() || !kbContent.trim()) return;
    await kbCrud.createMutation.mutateAsync({
      data: { title: kbTitle.trim(), category: kbCategory, content: kbContent.trim() },
    });
    setKbTitle('');
    setKbContent('');
    setKbOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="CampusOS Gemini AI Workspace"
        description="Server-side Gemini integration via Cloud Functions with tenant isolation, PII minimization, and human approval."
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'AI Assistant' }]}
        actions={
          can(PERMISSIONS.TENANT_SETTINGS) && (
            <Button variant="secondary" onClick={() => setKbOpen(true)}>
              <Plus className="h-4 w-4" /> Add Handbook / Policy Doc
            </Button>
          )
        }
      />

      {!backendStatus.geminiConfigured && (
        <StatusBanner
          tone="warning"
          title="Gemini AI Disabled — Server Secret Required"
          description="GEMINI_API_KEY is not configured in Firebase Cloud Functions secrets (or functions/.secret.local in emulator mode). Client code never holds Gemini keys. Configure the server secret and restart functions to enable live inference."
        />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              <div>
                <CardTitle>Run Governed AI Workflow</CardTitle>
                <CardDescription>Rate-limited to 12 requests/min per user • Authenticated server boundary</CardDescription>
              </div>
            </div>
            <Badge variant={backendStatus.geminiConfigured ? 'success' : 'neutral'}>
              {backendStatus.geminiConfigured ? 'Gemini Ready' : 'Not Configured'}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleRunAi} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="ai-task">AI Capability</Label>
                  <Select id="ai-task" value={task} onChange={(e) => setTask(e.target.value)}>
                    {availableTasks.map((t) => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </Select>
                </div>
                {task === 'document_summarize' && (
                  <div>
                    <Label htmlFor="ai-doc">Target Document (Optional)</Label>
                    <Select id="ai-doc" value={selectedDocId} onChange={(e) => setSelectedDocId(e.target.value)}>
                      <option value="">All college knowledge docs</option>
                      {(docsQ.data || []).map((d) => (
                        <option key={d.id} value={d.id}>{d.title}</option>
                      ))}
                    </Select>
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="ai-prompt" required>Question or Instruction</Label>
                <Textarea
                  id="ai-prompt"
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., What is the minimum attendance policy for semester exams?"
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-500">
                  AI output is advisory only; never makes admission, grading, or financial decisions.
                </span>
                <Button
                  type="submit"
                  loading={runAiFn.isPending}
                  disabled={!backendStatus.geminiConfigured || !prompt.trim()}
                >
                  <Send className="h-4 w-4" /> Ask Gemini
                </Button>
              </div>
            </form>

            {response && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="indigo">AI Generated</Badge>
                    <span className="text-xs text-slate-500">{response.model} • {response.latencyMs}ms</span>
                  </div>
                  {response.requiresHumanApproval && (
                    <Badge variant="warning">Human Review Required</Badge>
                  )}
                </div>

                <div className="whitespace-pre-wrap text-sm text-slate-800 leading-relaxed">
                  {response.output}
                </div>

                {Array.isArray(response.sources) && response.sources.length > 0 && (
                  <div className="border-t border-indigo-100 pt-2">
                    <p className="text-[11px] font-semibold text-slate-600 uppercase">Grounded Sources</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {response.sources.map((src) => (
                        <Badge key={src.id} variant="neutral">{src.title}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {response.task === 'notice_draft' && can(PERMISSIONS.COMMUNICATION_WRITE) && (
                  <div className="pt-2 flex justify-end">
                    <Button size="sm" variant="success" onClick={handleApproveNoticeDraft}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve &amp; Publish as Campus Notice
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-indigo-600" />
              <div>
                <CardTitle>College RAG Knowledge Base</CardTitle>
                <CardDescription>{(kbQ.data || []).length} approved policy documents</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {(kbQ.data || []).length === 0 ? (
              <p className="text-xs text-slate-500">
                No handbook documents indexed yet. Admins can add college policies, exam rules, and calendar FAQs here.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 text-xs">
                {(kbQ.data || []).map((doc) => (
                  <li key={doc.id} className="py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">{doc.title}</span>
                      <Badge variant="neutral">{doc.category}</Badge>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-slate-500">{doc.content}</p>
                  </li>
                ))}
              </ul>
            )}

            <div className="rounded-lg bg-slate-50 p-3 text-[11px] text-slate-600 flex gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 text-indigo-600" />
              <span>
                Retrieved documents are wrapped as untrusted context and emails/phone numbers are redacted before leaving Firebase.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={kbOpen} onClose={() => setKbOpen(false)} title="Add College Handbook / Policy Document">
        <form onSubmit={handleAddKbDoc} className="space-y-3.5">
          <div><Label htmlFor="kb-title" required>Document Title</Label><Input id="kb-title" value={kbTitle} onChange={(e) => setKbTitle(e.target.value)} required /></div>
          <div>
            <Label htmlFor="kb-cat">Category</Label>
            <Select id="kb-cat" value={kbCategory} onChange={(e) => setKbCategory(e.target.value)}>
              <option value="Policy">Academic Policy</option>
              <option value="Handbook">Student Handbook</option>
              <option value="Calendar">Academic Calendar / FAQ</option>
              <option value="Finance">Scholarship &amp; Fee Rules</option>
            </Select>
          </div>
          <div><Label htmlFor="kb-content" required>Approved Policy Text</Label><Textarea id="kb-content" rows={5} value={kbContent} onChange={(e) => setKbContent(e.target.value)} required /></div>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setKbOpen(false)}>Cancel</Button><Button type="submit" loading={kbCrud.createMutation.isPending}>Save Knowledge Doc</Button></div>
        </form>
      </Dialog>
    </div>
  );
}
