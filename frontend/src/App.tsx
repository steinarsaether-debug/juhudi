import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CustomerList from './pages/customers/CustomerList';
import CustomerOnboarding from './pages/customers/CustomerOnboarding';
import CustomerProfile from './pages/customers/CustomerProfile';
import CustomerEdit from './pages/customers/CustomerEdit';
import LoanApplications from './pages/loans/LoanApplications';
import LoanApplicationDetail from './pages/loans/LoanApplicationDetail';
import LoanDetail from './pages/loans/LoanDetail';
import LoanApplicationForm from './pages/loans/LoanApplicationForm';
import CreditScoring from './pages/scoring/CreditScoring';
import ChangePassword from './pages/ChangePassword';
import Benchmarks from './pages/benchmarks/Benchmarks';
import FieldHub from './pages/field/FieldHub';
import OfflineIndicator from './components/common/OfflineIndicator';
import BccList from './pages/bcc/BccList';
import BccDetail from './pages/bcc/BccDetail';
import BccMeetingDetail from './pages/bcc/BccMeetingDetail';
import BccAnalytics from './pages/admin/BccAnalytics';
import Collections from './pages/collections/Collections';
import QualityDashboard from './pages/quality/QualityDashboard';
import CustomerInterviewPage from './pages/interviews/CustomerInterview';
import InterviewList from './pages/interviews/InterviewList';
import AdminUsers from './pages/admin/AdminUsers';
import AdminBranches from './pages/admin/AdminBranches';
import AdminActivity from './pages/admin/AdminActivity';
import AdminLocations from './pages/admin/AdminLocations';
import MpesaMonitor from './pages/admin/MpesaMonitor';
import GroupList from './pages/groups/GroupList';
import GroupForm from './pages/groups/GroupForm';
import GroupProfile from './pages/groups/GroupProfile';
import ILPInterviewForm from './pages/interviews/ILPInterviewForm';
import ILPApplicationForm from './pages/loans/ILPApplicationForm';
import ILPFollowUp from './pages/loans/ILPFollowUp';
import AdminILPEligibility from './pages/admin/AdminILPEligibility';
import SystemConfigPage from './pages/admin/SystemConfigPage';
import LOWorklist from './pages/loans/LOWorklist';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.mustChangePass) return <Navigate to="/change-password" replace />;
  return <>{children}</>;
}

/** Redirects to dashboard if the logged-in user's role is not in the allowed list. */
function RoleRoute({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { user } = useAuthStore();
  if (!user || !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/change-password" element={<ChangePassword />} />

        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />

          {/* Customer Lifecycle */}
          <Route path="customers"               element={<CustomerList />} />
          <Route path="customers/new"           element={<CustomerOnboarding />} />
          <Route path="customers/:id"           element={<CustomerProfile />} />
          <Route path="customers/:id/edit"      element={<CustomerEdit />} />
          <Route path="customers/:id/score"     element={<CreditScoring />} />
          <Route path="customers/:id/apply"     element={<LoanApplicationForm />} />
          <Route path="customers/:customerId/interview" element={<CustomerInterviewPage />} />
          <Route path="customers/:id/ilp-interview/:segment" element={<ILPInterviewForm />} />
          <Route path="customers/:id/ilp-apply"          element={<ILPApplicationForm />} />

          {/* Field Interviews global list */}
          <Route path="interviews"              element={<InterviewList />} />

          {/* Lending */}
          <Route path="loans"                       element={<LoanApplications />} />
          <Route path="loans/applications/:id"      element={<LoanApplicationDetail />} />
          <Route path="loans/:id"                   element={<LoanDetail />} />
          <Route path="loans/:id/follow-up"     element={<ILPFollowUp />} />
          <Route path="bcc"                     element={<BccList />} />
          <Route path="bcc/:id"                 element={<BccDetail />} />
          <Route path="bcc/meetings/:id"        element={<BccMeetingDetail />} />

          {/* Groups */}
          <Route path="groups"                  element={<GroupList />} />
          <Route path="groups/new"              element={<GroupForm />} />
          <Route path="groups/:id"              element={<GroupProfile />} />
          <Route path="groups/:id/edit"         element={<GroupForm />} />

          {/* Portfolio */}
          <Route path="worklist"                element={<LOWorklist />} />
          <Route path="collections"             element={<Collections />} />
          <Route path="benchmarks"              element={<Benchmarks />} />
          <Route path="field" element={
            <RoleRoute roles={['LOAN_OFFICER', 'SUPERVISOR']}>
              <FieldHub />
            </RoleRoute>
          } />
          <Route path="field/:id" element={
            <RoleRoute roles={['LOAN_OFFICER', 'SUPERVISOR']}>
              <FieldHub />
            </RoleRoute>
          } />

          {/* Oversight — SUP / BM / ADMIN */}
          <Route path="quality" element={
            <RoleRoute roles={['ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR']}>
              <QualityDashboard />
            </RoleRoute>
          } />

          <Route path="admin/bcc-analytics" element={
            <RoleRoute roles={['ADMIN', 'BRANCH_MANAGER']}>
              <BccAnalytics />
            </RoleRoute>
          } />

          {/* Administration — BM / ADMIN */}
          <Route path="admin/activity" element={
            <RoleRoute roles={['ADMIN', 'BRANCH_MANAGER']}>
              <AdminActivity />
            </RoleRoute>
          } />
          <Route path="admin/locations" element={
            <RoleRoute roles={['ADMIN', 'BRANCH_MANAGER']}>
              <AdminLocations />
            </RoleRoute>
          } />

          {/* Administration — ADMIN only */}
          <Route path="admin/users" element={
            <RoleRoute roles={['ADMIN']}>
              <AdminUsers />
            </RoleRoute>
          } />
          <Route path="admin/branches" element={
            <RoleRoute roles={['ADMIN']}>
              <AdminBranches />
            </RoleRoute>
          } />
          <Route path="admin/mpesa" element={
            <RoleRoute roles={['ADMIN']}>
              <MpesaMonitor />
            </RoleRoute>
          } />
          <Route path="admin/ilp-eligibility" element={
            <RoleRoute roles={['ADMIN']}>
              <AdminILPEligibility />
            </RoleRoute>
          } />
          <Route path="admin/config" element={
            <RoleRoute roles={['ADMIN']}>
              <SystemConfigPage />
            </RoleRoute>
          } />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <OfflineIndicator />
    </BrowserRouter>
  );
}
