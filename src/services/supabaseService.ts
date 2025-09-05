import { supabase } from '@/integrations/supabase/client';
import { TestPlan, TestCase, TestExecution, TestStep, Requirement, Defect } from '@/types';

// Funções para Planos de Teste
export const getTestPlans = async (userId: string, projectId?: string): Promise<TestPlan[]> => {
  let query = supabase
    .from('test_plans')
    .select('*')
    .eq('user_id', userId);

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query.order('updated_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar planos de teste:', error);
    throw error;
  }

  return data.map(plan => ({
    ...plan,
    created_at: new Date(plan.created_at),
    updated_at: new Date(plan.updated_at)
  }));
};

// Alias para buscar planos de um projeto específico
export const getTestPlansByProject = async (userId: string, projectId: string): Promise<TestPlan[]> => {
  return getTestPlans(userId, projectId);
};

export const createTestPlan = async (plan: Omit<TestPlan, 'id' | 'created_at' | 'updated_at'>): Promise<TestPlan> => {
  const { data, error } = await supabase
    .from('test_plans')
    .insert([plan])
    .select()
    .single();

  if (error) {
    console.error('Erro ao criar plano de teste:', error);
    throw error;
  }

  return {
    ...data,
    created_at: new Date(data.created_at),
    updated_at: new Date(data.updated_at)
  };
};

export const updateTestPlan = async (id: string, updates: Partial<TestPlan>): Promise<TestPlan> => {
  // Remove created_at and updated_at from updates, convert Date to string
  const { created_at, updated_at, ...cleanUpdates } = updates;
  
  const { data, error } = await supabase
    .from('test_plans')
    .update({ ...cleanUpdates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Erro ao atualizar plano de teste:', error);
    throw error;
  }

  return {
    ...data,
    created_at: new Date(data.created_at),
    updated_at: new Date(data.updated_at)
  };
};

export const deleteTestPlan = async (id: string) => {
  const { error } = await supabase
    .from('test_plans')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Erro ao excluir plano de teste: ${error.message}`);
  }
};

// Contadores de vínculos de um plano
export const countTestCasesByPlan = async (userId: string, planId: string): Promise<number> => {
  const { count, error } = await supabase
    .from('test_cases')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('plan_id', planId);
  if (error) {
    console.error('Erro ao contar casos por plano:', error);
    throw error;
  }
  return count || 0;
};

export const countExecutionsByPlan = async (userId: string, planId: string): Promise<number> => {
  const { count, error } = await supabase
    .from('test_executions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('plan_id', planId);
  if (error) {
    console.error('Erro ao contar execuções por plano:', error);
    throw error;
  }
  return count || 0;
};

export const getPlanLinkedCounts = async (
  userId: string,
  planId: string
): Promise<{ testCaseCount: number; executionCount: number }> => {
  const [testCaseCount, executionCount] = await Promise.all([
    countTestCasesByPlan(userId, planId),
    countExecutionsByPlan(userId, planId),
  ]);
  return { testCaseCount, executionCount };
};

// Funções para Casos de Teste
export const getTestCases = async (userId: string, planId?: string): Promise<TestCase[]> => {
  let query = supabase
    .from('test_cases')
    .select('*')
    .eq('user_id', userId);

  if (planId) {
    query = query.eq('plan_id', planId);
  }

  const { data, error } = await query.order('updated_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar casos de teste:', error);
    throw error;
  }

  return data.map(testCase => ({
    ...testCase,
    steps: Array.isArray(testCase.steps) ? (testCase.steps as unknown as TestStep[]) : [],
    priority: testCase.priority as 'low' | 'medium' | 'high' | 'critical',
    type: testCase.type as 'functional' | 'integration' | 'performance' | 'security' | 'usability',
    created_at: new Date(testCase.created_at),
    updated_at: new Date(testCase.updated_at)
  }));
};

// Busca casos de teste por projeto atual via planos associados
export const getTestCasesByProject = async (userId: string, projectId: string): Promise<TestCase[]> => {
  // 1) Buscar IDs de planos do usuário no projeto
  const { data: plans, error: planErr } = await supabase
    .from('test_plans')
    .select('id')
    .eq('user_id', userId)
    .eq('project_id', projectId);

  if (planErr) {
    console.error('Erro ao buscar planos para o projeto em getTestCasesByProject:', planErr);
    throw planErr;
  }

  const planIds = (plans || []).map(p => p.id);
  if (planIds.length === 0) return [];

  // 2) Buscar casos vinculados a esses planos
  const { data, error } = await supabase
    .from('test_cases')
    .select('*')
    .eq('user_id', userId)
    .in('plan_id', planIds)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar casos de teste por projeto:', error);
    throw error;
  }

  return (data || []).map((testCase: any) => ({
    ...testCase,
    steps: Array.isArray(testCase.steps) ? (testCase.steps as unknown as TestStep[]) : [],
    priority: testCase.priority as 'low' | 'medium' | 'high' | 'critical',
    type: testCase.type as 'functional' | 'integration' | 'performance' | 'security' | 'usability',
    created_at: new Date(testCase.created_at),
    updated_at: new Date(testCase.updated_at)
  }));
};

export const createTestCase = async (testCase: Omit<TestCase, 'id' | 'created_at' | 'updated_at'>): Promise<TestCase> => {
  // Ensure user_id is present (fallback to current authenticated user)
  const payload: any = {
    ...testCase,
    steps: Array.isArray(testCase.steps) ? (testCase.steps as any) : [] // Convert TestStep[] to Json and default to []
  };

  // Normalize empty UUIDs to null
  if (payload.plan_id === '' || typeof payload.plan_id === 'undefined') {
    payload.plan_id = null;
  }

  if (!payload.user_id) {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      console.error('Erro ao obter usuário autenticado para criar caso de teste:', authError);
      throw new Error('Não foi possível obter usuário autenticado para criar caso de teste.');
    }
    payload.user_id = authData.user.id;
  }

  const { data, error } = await supabase
    .from('test_cases')
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error('Erro ao criar caso de teste:', error);
    throw error;
  }

  return {
    ...data,
    steps: Array.isArray(data.steps) ? (data.steps as unknown as TestStep[]) : [],
    priority: data.priority as 'low' | 'medium' | 'high' | 'critical',
    type: data.type as 'functional' | 'integration' | 'performance' | 'security' | 'usability',
    created_at: new Date(data.created_at),
    updated_at: new Date(data.updated_at)
  };
};

export const updateTestCase = async (id: string, updates: Partial<TestCase>): Promise<TestCase> => {
  // Remove created_at and updated_at from updates, convert Date to string and TestStep[] to Json
  const { created_at, updated_at, steps, ...cleanUpdates } = updates;
  
  const updateData: any = {
    ...cleanUpdates,
    updated_at: new Date().toISOString()
  };

  if (steps) {
    updateData.steps = steps; // Convert TestStep[] to Json
  }

  // Normalize empty UUIDs to null when updating
  if ('plan_id' in cleanUpdates) {
    const p: any = (cleanUpdates as any).plan_id;
    updateData.plan_id = p && String(p).trim() !== '' ? p : null;
  }

  const { data, error } = await supabase
    .from('test_cases')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Erro ao atualizar caso de teste:', error);
    throw error;
  }

  return {
    ...data,
    steps: Array.isArray(data.steps) ? (data.steps as unknown as TestStep[]) : [],
    priority: data.priority as 'low' | 'medium' | 'high' | 'critical',
    type: data.type as 'functional' | 'integration' | 'performance' | 'security' | 'usability',
    created_at: new Date(data.created_at),
    updated_at: new Date(data.updated_at)
  };
};

export const deleteTestCase = async (id: string) => {
  const { error } = await supabase
    .from('test_cases')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Erro ao excluir caso de teste: ${error.message}`);
  }
};

// Funções para Execuções de Teste
export const getTestExecutions = async (userId: string, planId?: string, caseId?: string): Promise<TestExecution[]> => {
  let query = supabase
    .from('test_executions')
    .select('*')
    .eq('user_id', userId);

  if (planId) {
    query = query.eq('plan_id', planId);
  }

  if (caseId) {
    query = query.eq('case_id', caseId);
  }

  const { data, error } = await query.order('executed_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar execuções de teste:', error);
    throw error;
  }

  return data.map(execution => ({
    ...execution,
    status: execution.status as 'passed' | 'failed' | 'blocked' | 'not_tested',
    executed_at: new Date(execution.executed_at)
  }));
};

export const createTestExecution = async (execution: Omit<TestExecution, 'id' | 'executed_at'>): Promise<TestExecution> => {
  const { data, error } = await supabase
    .from('test_executions')
    .insert([execution])
    .select()
    .single();

  if (error) {
    console.error('Erro ao criar execução de teste:', error);
    throw error;
  }

  return {
    ...data,
    status: data.status as 'passed' | 'failed' | 'blocked' | 'not_tested',
    executed_at: new Date(data.executed_at)
  };
};

export const updateTestExecution = async (id: string, updates: Partial<TestExecution>): Promise<TestExecution> => {
  // Remove executed_at from updates, convert Date to string
  const { executed_at, ...cleanUpdates } = updates;
  
  const { data, error } = await supabase
    .from('test_executions')
    .update(cleanUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Erro ao atualizar execução de teste:', error);
    throw error;
  }

  return {
    ...data,
    status: data.status as 'passed' | 'failed' | 'blocked' | 'not_tested',
    executed_at: new Date(data.executed_at)
  };
};

export const deleteTestExecution = async (id: string) => {
  const { error } = await supabase
    .from('test_executions')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Erro ao excluir execução de teste: ${error.message}`);
  }
};

// =====================
// Fase 1: Requisitos
// =====================

export const getRequirements = async (userId: string): Promise<Requirement[]> => {
  const { data, error } = await supabase
    .from('requirements')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar requisitos:', error);
    throw error;
  }

  return (data || []).map((r: any) => ({
    ...r,
    created_at: new Date(r.created_at),
    updated_at: new Date(r.updated_at),
    priority: r.priority as Requirement['priority'],
    status: r.status as Requirement['status']
  }));
};

export const createRequirement = async (req: Omit<Requirement, 'id' | 'created_at' | 'updated_at'>): Promise<Requirement> => {
  const { data, error } = await supabase
    .from('requirements')
    .insert([req])
    .select()
    .single();

  if (error) {
    console.error('Erro ao criar requisito:', error);
    throw error;
  }

  return {
    ...data,
    created_at: new Date(data.created_at),
    updated_at: new Date(data.updated_at),
    priority: data.priority as Requirement['priority'],
    status: data.status as Requirement['status']
  } as Requirement;
};

export const updateRequirement = async (id: string, updates: Partial<Requirement>): Promise<Requirement> => {
  const { created_at, updated_at, ...clean } = updates;
  const { data, error } = await supabase
    .from('requirements')
    .update({ ...clean, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Erro ao atualizar requisito:', error);
    throw error;
  }

  return {
    ...data,
    created_at: new Date(data.created_at),
    updated_at: new Date(data.updated_at),
    priority: data.priority as Requirement['priority'],
    status: data.status as Requirement['status']
  } as Requirement;
};

export const deleteRequirement = async (id: string) => {
  const { error } = await supabase
    .from('requirements')
    .delete()
    .eq('id', id);
  if (error) {
    throw new Error(`Erro ao excluir requisito: ${error.message}`);
  }
};

// Vínculos requisito ↔ caso
export const linkRequirementToCase = async (requirementId: string, caseId: string, userId: string) => {
  const { error } = await supabase
    .from('requirements_cases')
    .insert([{ requirement_id: requirementId, case_id: caseId, user_id: userId }]);
  if (error) {
    throw new Error(`Erro ao vincular requisito ao caso: ${error.message}`);
  }
};

export const unlinkRequirementFromCase = async (requirementId: string, caseId: string) => {
  const { error } = await supabase
    .from('requirements_cases')
    .delete()
    .match({ requirement_id: requirementId, case_id: caseId });
  if (error) {
    throw new Error(`Erro ao desvincular requisito do caso: ${error.message}`);
  }
};

export const getRequirementsByCase = async (userId: string, caseId: string): Promise<Requirement[]> => {
  // Estratégia em duas etapas para evitar dependência de embeddeds
  const { data: links, error: linkErr } = await supabase
    .from('requirements_cases')
    .select('requirement_id')
    .eq('user_id', userId)
    .eq('case_id', caseId);
  if (linkErr) {
    console.error('Erro ao buscar vínculos requisito↔caso:', linkErr);
    throw linkErr;
  }
  const ids = (links || []).map(l => l.requirement_id);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('requirements')
    .select('*')
    .eq('user_id', userId)
    .in('id', ids);
  if (error) {
    console.error('Erro ao buscar requisitos por IDs:', error);
    throw error;
  }
  return (data || []).map((r: any) => ({
    ...r,
    created_at: new Date(r.created_at),
    updated_at: new Date(r.updated_at),
    priority: r.priority as Requirement['priority'],
    status: r.status as Requirement['status']
  }));
};

export const getCasesByRequirement = async (userId: string, requirementId: string): Promise<TestCase[]> => {
  const { data: links, error: linkErr } = await supabase
    .from('requirements_cases')
    .select('case_id')
    .eq('user_id', userId)
    .eq('requirement_id', requirementId);
  if (linkErr) {
    console.error('Erro ao buscar vínculos requisito↔caso:', linkErr);
    throw linkErr;
  }
  const ids = (links || []).map(l => l.case_id);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('test_cases')
    .select('*')
    .eq('user_id', userId)
    .in('id', ids);
  if (error) {
    console.error('Erro ao buscar casos por IDs:', error);
    throw error;
  }
  return (data || []).map((testCase: any) => ({
    ...testCase,
    steps: Array.isArray(testCase.steps) ? (testCase.steps as unknown as TestStep[]) : [],
    priority: testCase.priority as 'low' | 'medium' | 'high' | 'critical',
    type: testCase.type as 'functional' | 'integration' | 'performance' | 'security' | 'usability',
    created_at: new Date(testCase.created_at),
    updated_at: new Date(testCase.updated_at)
  }));
};

// =====================
// Fase 1: Defeitos
// =====================

export const getDefects = async (userId: string, caseId?: string, executionId?: string): Promise<Defect[]> => {
  let query = supabase
    .from('defects')
    .select('*')
    .eq('user_id', userId);
  if (caseId) query = query.eq('case_id', caseId);
  if (executionId) query = query.eq('execution_id', executionId);
  const { data, error } = await query.order('updated_at', { ascending: false });
  if (error) {
    console.error('Erro ao buscar defeitos:', error);
    throw error;
  }
  return (data || []).map((d: any) => ({
    ...d,
    created_at: new Date(d.created_at),
    updated_at: new Date(d.updated_at),
    status: d.status as Defect['status'],
    severity: d.severity as Defect['severity']
  }));
};

export const createDefect = async (defect: Omit<Defect, 'id' | 'created_at' | 'updated_at'>): Promise<Defect> => {
  const { data, error } = await supabase
    .from('defects')
    .insert([defect])
    .select()
    .single();
  if (error) {
    console.error('Erro ao criar defeito:', error);
    throw error;
  }
  return {
    ...data,
    created_at: new Date(data.created_at),
    updated_at: new Date(data.updated_at),
    status: data.status as Defect['status'],
    severity: data.severity as Defect['severity']
  } as Defect;
};

export const updateDefect = async (id: string, updates: Partial<Defect>): Promise<Defect> => {
  const { created_at, updated_at, ...clean } = updates;
  const { data, error } = await supabase
    .from('defects')
    .update({ ...clean, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    console.error('Erro ao atualizar defeito:', error);
    throw error;
  }
  return {
    ...data,
    created_at: new Date(data.created_at),
    updated_at: new Date(data.updated_at),
    status: data.status as Defect['status'],
    severity: data.severity as Defect['severity']
  } as Defect;
};

export const deleteDefect = async (id: string) => {
  const { error } = await supabase
    .from('defects')
    .delete()
    .eq('id', id);
  if (error) {
    throw new Error(`Erro ao excluir defeito: ${error.message}`);
  }
};
