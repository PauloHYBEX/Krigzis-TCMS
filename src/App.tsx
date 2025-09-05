import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { Layout } from '@/components/Layout';
import { AuthGuard } from '@/components/AuthGuard';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { PermissionGuard } from '@/components/PermissionGuard';
import { ThemeProvider } from '@/hooks/useTheme';
import { ProjectProvider } from '@/contexts/ProjectContext';
import Index from '@/pages/Index';
import { TestPlans } from '@/pages/TestPlans';
import { TestCases } from '@/pages/TestCases';
import { TestExecutions } from '@/pages/TestExecutions';
import { AIGenerator } from '@/pages/AIGenerator';
import { History } from '@/pages/History';
import { Reports } from '@/pages/Reports';
import { ModelControlPanel } from '@/pages/ModelControlPanel';
import { UserManagement } from '@/pages/UserManagement';
import { About } from '@/pages/About';
import NotFound from '@/pages/NotFound';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ResetPassword from '@/pages/ResetPassword';
import { Requirements } from '@/pages/Requirements';
import { Defects } from '@/pages/Defects';
import { TraceabilityMatrix } from '@/pages/TraceabilityMatrix';
import './App.css';
import { Profiles } from '@/pages/Profiles';

const queryClient = new QueryClient();

// Componente para gerenciar redirecionamentos
function AppRouter() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Rotas públicas */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      
      {/* Rotas protegidas */}
      <Route element={<AuthGuard><Layout /></AuthGuard>}>
        <Route path="/" element={<Index />} />
        <Route path="/plans" element={<PermissionGuard requiredPermission="can_manage_plans"><TestPlans /></PermissionGuard>} />
        <Route path="/cases" element={<PermissionGuard requiredPermission="can_manage_cases"><TestCases /></PermissionGuard>} />
        <Route path="/executions" element={<PermissionGuard requiredPermission="can_manage_executions"><TestExecutions /></PermissionGuard>} />
        <Route path="/requirements" element={<PermissionGuard requiredPermission="can_manage_cases"><Requirements /></PermissionGuard>} />
        <Route path="/defects" element={<PermissionGuard requiredPermission="can_manage_executions"><Defects /></PermissionGuard>} />
        <Route path="/traceability" element={<PermissionGuard requiredPermission="can_manage_cases"><TraceabilityMatrix /></PermissionGuard>} />
        <Route path="/ai-generator" element={<PermissionGuard requiredPermission="can_use_ai"><AIGenerator /></PermissionGuard>} />
        <Route path="/history" element={<PermissionGuard><History /></PermissionGuard>} />
        <Route path="/reports" element={<PermissionGuard requiredPermission="can_view_reports"><Reports /></PermissionGuard>} />
        <Route path="/model-control" element={<PermissionGuard requiredRole="admin" redirect="/"><ModelControlPanel /></PermissionGuard>} />
        <Route path="/user-management" element={<PermissionGuard requiredPermission="can_manage_users" redirect="/"><UserManagement /></PermissionGuard>} />
        <Route path="/profiles" element={<PermissionGuard requiredPermission="can_manage_users" redirect="/"><Profiles /></PermissionGuard>} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ProjectProvider>
            <Router>
              <AppRouter />
              <Toaster />
            </Router>
          </ProjectProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
