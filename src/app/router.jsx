import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthLayout } from '@/layouts/AuthLayout';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LoginPage, RegisterPage, ForgotPasswordPage, ProfilePage } from '@/modules/auth/AuthPages';
import { DashboardPage } from '@/modules/dashboard/DashboardPage';
import { PERMISSIONS } from '@/schemas/roles';
import { Skeleton } from '@/components/ui/Skeleton';

const PlatformAdminPage = lazy(() => import('@/modules/administration/PlatformAdminPage'));
const CollegeSetupPage = lazy(() => import('@/modules/administration/CollegeSetupPage'));
const AuditLogsPage = lazy(() => import('@/modules/administration/AuditLogsPage'));
const AdmissionsPage = lazy(() => import('@/modules/admissions/AdmissionsPage'));
const StudentsPage = lazy(() => import('@/modules/students/StudentsPage'));
const FacultyPage = lazy(() => import('@/modules/faculty/FacultyPage'));
const AcademicsPage = lazy(() => import('@/modules/academics/AcademicsPage'));
const AttendancePage = lazy(() => import('@/modules/attendance/AttendancePage'));
const ExaminationsPage = lazy(() => import('@/modules/examinations/ExaminationsPage'));
const FinancePage = lazy(() => import('@/modules/finance/FinancePage'));
const LibraryPage = lazy(() => import('@/modules/library/LibraryPage'));
const PlacementsPage = lazy(() => import('@/modules/placements/PlacementsPage'));
const CommunicationPage = lazy(() => import('@/modules/communication/CommunicationPage'));
const DocumentsPage = lazy(() => import('@/modules/documents/DocumentsPage'));
const ReportsPage = lazy(() => import('@/modules/reports/ReportsPage'));
const AiAssistantPage = lazy(() => import('@/modules/ai/AiAssistantPage'));

function PageLoader() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

function Guard({ permissions = [], requireTenant = true, children }) {
  return (
    <ProtectedRoute permissions={permissions} requireTenant={requireTenant}>
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </ProtectedRoute>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />

          <Route
            path="/platform"
            element={
              <Guard permissions={[PERMISSIONS.PLATFORM_MANAGE]} requireTenant={false}>
                <PlatformAdminPage />
              </Guard>
            }
          />
          <Route
            path="/administration"
            element={
              <Guard permissions={[PERMISSIONS.TENANT_SETTINGS, PERMISSIONS.USERS_MANAGE]}>
                <CollegeSetupPage />
              </Guard>
            }
          />
          <Route
            path="/admissions"
            element={
              <Guard permissions={[PERMISSIONS.ADMISSIONS_READ]}>
                <AdmissionsPage />
              </Guard>
            }
          />
          <Route
            path="/students"
            element={
              <Guard permissions={[PERMISSIONS.STUDENTS_READ]}>
                <StudentsPage />
              </Guard>
            }
          />
          <Route
            path="/faculty"
            element={
              <Guard permissions={[PERMISSIONS.FACULTY_READ]}>
                <FacultyPage />
              </Guard>
            }
          />
          <Route
            path="/academics"
            element={
              <Guard permissions={[PERMISSIONS.ACADEMICS_READ]}>
                <AcademicsPage />
              </Guard>
            }
          />
          <Route
            path="/attendance"
            element={
              <Guard permissions={[PERMISSIONS.ATTENDANCE_READ]}>
                <AttendancePage />
              </Guard>
            }
          />
          <Route
            path="/examinations"
            element={
              <Guard permissions={[PERMISSIONS.EXAMS_READ]}>
                <ExaminationsPage />
              </Guard>
            }
          />
          <Route
            path="/finance"
            element={
              <Guard permissions={[PERMISSIONS.FINANCE_READ]}>
                <FinancePage />
              </Guard>
            }
          />
          <Route
            path="/library"
            element={
              <Guard permissions={[PERMISSIONS.LIBRARY_READ]}>
                <LibraryPage />
              </Guard>
            }
          />
          <Route
            path="/placements"
            element={
              <Guard permissions={[PERMISSIONS.PLACEMENTS_READ]}>
                <PlacementsPage />
              </Guard>
            }
          />
          <Route
            path="/communication"
            element={
              <Guard permissions={[PERMISSIONS.COMMUNICATION_READ]}>
                <CommunicationPage />
              </Guard>
            }
          />
          <Route
            path="/documents"
            element={
              <Guard permissions={[PERMISSIONS.DOCUMENTS_READ]}>
                <DocumentsPage />
              </Guard>
            }
          />
          <Route
            path="/reports"
            element={
              <Guard permissions={[PERMISSIONS.REPORTS_READ]}>
                <ReportsPage />
              </Guard>
            }
          />
          <Route
            path="/ai-assistant"
            element={
              <Guard permissions={[PERMISSIONS.AI_USE]}>
                <AiAssistantPage />
              </Guard>
            }
          />
          <Route
            path="/audit-logs"
            element={
              <Guard permissions={[PERMISSIONS.AUDIT_READ]}>
                <AuditLogsPage />
              </Guard>
            }
          />
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
