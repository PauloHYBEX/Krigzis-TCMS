export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type RequirementStatus = 'open' | 'in_progress' | 'approved' | 'deprecated';
export type DefectStatus = 'open' | 'in_analysis' | 'fixed' | 'validated' | 'closed';
export type ExecutionStatus = 'passed' | 'failed' | 'blocked' | 'not_tested';
export type TestCaseType = 'functional' | 'integration' | 'performance' | 'security' | 'usability';

export const priorityLabel = (p: Priority) => ({
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
}[p] || p);

export const priorityBadgeClass = (p: Priority) => ({
  low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}[p] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200');

export const severityLabel = priorityLabel;
export const severityBadgeClass = priorityBadgeClass;

export const requirementStatusLabel = (s: RequirementStatus) => ({
  open: 'Aberto',
  in_progress: 'Em andamento',
  approved: 'Aprovado',
  deprecated: 'Obsoleto',
}[s] || s);

export const requirementStatusBadgeClass = (s: RequirementStatus) => ({
  open: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  deprecated: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
}[s] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200');

export const defectStatusLabel = (s: DefectStatus) => ({
  open: 'Aberto',
  in_analysis: 'Em análise',
  fixed: 'Corrigido',
  validated: 'Validado',
  closed: 'Fechado',
}[s] || s);

export const defectStatusBadgeClass = (s: DefectStatus) => ({
  open: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  in_analysis: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  fixed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  validated: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  closed: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
}[s] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200');

export const testCaseTypeLabel = (t: TestCaseType) => ({
  functional: 'Funcional',
  integration: 'Integração',
  performance: 'Desempenho',
  security: 'Segurança',
  usability: 'Usabilidade',
}[t] || (t as string));

export const testCaseTypeBadgeClass = (t: TestCaseType) => ({
  functional: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  integration: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  performance: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  security: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  usability: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
}[t] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200');

// Execuções de Teste
export const executionStatusLabel = (s: ExecutionStatus) => ({
  passed: 'Aprovado',
  failed: 'Reprovado',
  blocked: 'Bloqueado',
  not_tested: 'Não Testado',
}[s] || (s as string));

export const executionStatusBadgeClass = (s: ExecutionStatus) => ({
  passed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  blocked: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  not_tested: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
}[s] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200');
