import { ExportData } from './export';
import { 
  priorityLabel,
  testCaseTypeLabel,
  executionStatusLabel,
} from '@/lib/labels';

export type TransformFormat = 'csv' | 'excel' | 'json';

export interface TransformContext {
  cases?: Array<any>;
  plans?: Array<any>;
  executions?: Array<any>;
  userMap?: Record<string, string>;
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleString('pt-BR');
};

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('pt-BR');
};

const getCaseTitle = (id: string | null | undefined, ctx?: TransformContext) => {
  if (!id) return '';
  const title = ctx?.cases?.find((c) => c.id === id)?.title;
  return title || `Caso ${String(id).slice(0, 8)}`;
};

const getPlanTitle = (id: string | null | undefined, ctx?: TransformContext) => {
  if (!id) return '';
  const title = ctx?.plans?.find((p) => p.id === id)?.title;
  return title || `Plano ${String(id).slice(0, 8)}`;
};

const mapUser = (id?: string | null, ctx?: TransformContext) => {
  if (!id) return '';
  const name = ctx?.userMap?.[id];
  // Retornar apenas o nome; se não houver mapeamento, vazio (não exibir ID nem prefixo)
  return name || '';
};

// Conversor genérico para formato tabular (CSV/Excel)
const toTabular = (data: any, title: string = 'Exportação', ctx?: TransformContext): ExportData => {
  // Tradução de chaves para cabeçalhos PT-BR
  const keyMap: Record<string, string> = {
    id: 'ID',
    title: 'Título',
    priority: 'Prioridade',
    type: 'Tipo',
    status: 'Status',
    created_at: 'Criado em',
    updated_at: 'Atualizado em',
    executed_at: 'Executado em',
    executed_by: 'Executado por',
    notes: 'Observações',
    plan_id: 'Plano',
    case_id: 'Caso',
    user_id: 'Usuário',
    severity: 'Severidade',
    description: 'Descrição',
    generated_by_ai: 'Gerado por IA',
    granularity: 'Granularidade',
    passed: 'Aprovadas',
    failed: 'Reprovadas',
    blocked: 'Bloqueadas',
    not_tested: 'Não testadas',
    total: 'Total',
  };

  const translateKey = (k: string) => keyMap[k] || k;

  const formatValueByKey = (k: string, v: any) => {
    if (v === null || v === undefined) return '';
    // Mapeamentos específicos
    if (k === 'case_id') return getCaseTitle(v, ctx);
    if (k === 'plan_id') return getPlanTitle(v, ctx);
    if (k === 'user_id' || k === 'executed_by') return mapUser(v, ctx);
    if (k === 'priority') return priorityLabel(v);
    if (k === 'type') return testCaseTypeLabel(v);
    if (k === 'status') return executionStatusLabel(v);
    if (k === 'executed_at') return formatDateTime(v);
    if (k === 'created_at' || k === 'updated_at') return formatDate(v);
    if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
    if (typeof v === 'object') return JSON.stringify(v);
    return v;
  };

  // Caso seja uma tabela já pronta
  if (data && Array.isArray(data.headers) && Array.isArray(data.rows)) {
    return { headers: data.headers, rows: data.rows, title: data.title || title } as ExportData;
  }

  // Array (objetos/valores) -> unifica chaves e insere coluna sequencial
  if (Array.isArray(data)) {
    const allKeys = Array.from(
      data.reduce<Set<string>>((set, item) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          Object.keys(item).forEach((k) => set.add(k));
        } else {
          set.add('valor');
        }
        return set;
      }, new Set())
    );

    // Preferência: remover ID técnico e usar coluna '#'
    const keys = allKeys.filter((k) => k !== 'id');

    // Cabeçalhos traduzidos com coluna '#'
    const headers = ['#', ...(keys.length ? keys.map(translateKey) : ['Valor'])];

    const rows = data.map((item, idx) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const rowValues = keys.length
          ? keys.map((k) => formatValueByKey(k, (item as any)[k]))
          : [item as any];
        return [idx + 1, ...rowValues];
      }
      return [idx + 1, item];
    });
    return { headers, rows, title };
  }

  // Objeto simples -> chave/valor (traduz chave e formata valor)
  if (data && typeof data === 'object') {
    const headers = ['Propriedade', 'Valor'];
    const rows = Object.entries(data).map(([k, v]) => [translateKey(k), formatValueByKey(k, v)]);
    return { headers, rows, title };
  }

  // Primitivo
  return { headers: ['Valor'], rows: [[data]], title };
};

// Execução - Status
const transformExecutionStatus = (data: any[], ctx?: TransformContext): ExportData => {
  // Removida coluna "Observações" e garantido nome do usuário sem prefixos/IDs
  const headers = ['#', 'Caso', 'Plano', 'Status', 'Executado em', 'Executado por'];
  const rows = data.map((exec, idx) => [
    idx + 1,
    getCaseTitle(exec.case_id, ctx),
    getPlanTitle(exec.plan_id, ctx),
    executionStatusLabel(exec.status),
    formatDateTime(exec.executed_at),
    mapUser(exec.executed_by, ctx),
  ]);
  return { headers, rows, title: 'Status de Execuções' };
};

// Casos - Prioridade
const transformTestPriority = (data: any[], ctx?: TransformContext): ExportData => {
  const headers = ['#', 'Título', 'Prioridade', 'Tipo', 'Criado em', 'Atualizado em', 'Autor'];
  const rows = data.map((tc, idx) => [
    idx + 1,
    tc.title || '',
    priorityLabel(tc.priority),
    testCaseTypeLabel(tc.type),
    formatDate(tc.created_at),
    formatDate(tc.updated_at),
    mapUser(tc.user_id, ctx),
  ]);
  return { headers, rows, title: 'Distribuição por Prioridade' };
};

// Análise de Tendências
const transformTrendAnalysisCSV = (data: any): ExportData => {
  const headers = ['Período', 'Aprovadas', 'Reprovadas', 'Bloqueadas', 'Não testadas', 'Total'];
  const series: Array<any> = data?.series || [];
  const rows = series.map((s) => [
    s.bucket,
    s.passed,
    s.failed,
    s.blocked,
    s.not_tested,
    s.total,
  ]);
  return { headers, rows, title: 'Análise de Tendências' };
};

const transformTrendAnalysisJSON = (data: any) => {
  return {
    tipo: 'analise-de-tendencias',
    geradoEm: new Date().toISOString(),
    dados: {
      series: (data?.series || []).map((s: any) => ({
        periodo: s.bucket,
        aprovadas: s.passed,
        reprovadas: s.failed,
        bloqueadas: s.blocked,
        nao_testadas: s.not_tested,
        total: s.total,
      })),
      totais: {
        aprovadas: data?.totals?.passed ?? 0,
        reprovadas: data?.totals?.failed ?? 0,
        bloqueadas: data?.totals?.blocked ?? 0,
        nao_testadas: data?.totals?.not_tested ?? 0,
        total: data?.totals?.total ?? 0,
      },
      granularidade: data?.granularity,
    },
  };
};

// Análise de Falhas
const transformFailureAnalysisCSV = (data: any, ctx?: TransformContext): ExportData => {
  const headers = ['#', 'Caso', 'Falhas'];
  const topCases: Array<{ id: string; title: string; count: number }> = data?.topCases || [];
  const rows = topCases.map((c, idx) => [
    idx + 1,
    c.title || getCaseTitle(c.id, ctx),
    c.count ?? 0,
  ]);
  return { headers, rows, title: 'Análise de Falhas - Top Casos' };
};

const transformFailureAnalysisJSON = (data: any, ctx?: TransformContext) => {
  return {
    tipo: 'analise-de-falhas',
    geradoEm: new Date().toISOString(),
    dados: {
      totais: {
        total_execucoes: data?.totals?.totalExecutions ?? 0,
        execucoes_reprovadas: data?.totals?.failedExecutions ?? 0,
        taxa_falhas: data?.totals?.failureRate ?? 0,
        ultima_reprovada_em: data?.totals?.lastFailedAt || null,
      },
      top_casos: (data?.topCases || []).map((c: any) => ({
        id: c.id,
        titulo: c.title || getCaseTitle(c.id, ctx),
        falhas: c.count ?? 0,
      })),
      top_planos: (data?.topPlans || []).map((p: any) => ({
        id: p.id,
        titulo: p.title || getPlanTitle(p.id, ctx),
        falhas: p.count ?? 0,
      })),
    },
  };
};

// Requisitos e Defeitos
const transformRequirementsDefectsCSV = (data: any): ExportData => {
  const headers = ['Categoria', 'Chave', 'Valor'];
  const rows: (string | number | boolean | null)[][] = [];

  const pushGroup = (categoria: string, obj: Record<string, number> | undefined | null) => {
    if (!obj) return;
    Object.entries(obj).forEach(([chave, valor]) => {
      rows.push([categoria, chave, valor]);
    });
  };

  pushGroup('Requisitos por Status', data?.requirementsByStatus);
  pushGroup('Requisitos por Prioridade', data?.requirementsByPriority);
  pushGroup('Defeitos por Severidade', data?.defectsBySeverity);
  pushGroup('Defeitos por Status', data?.defectsByStatus);

  return { headers, rows, title: 'Requisitos e Defeitos' };
};

const transformRequirementsDefectsJSON = (data: any) => {
  return {
    tipo: 'requisitos-e-defeitos',
    geradoEm: new Date().toISOString(),
    dados: {
      totais: {
        requisitos: data?.totals?.requirements ?? 0,
        defeitos: data?.totals?.defects ?? 0,
      },
      requisitos_por_status: data?.requirementsByStatus || {},
      requisitos_por_prioridade: data?.requirementsByPriority || {},
      defeitos_por_severidade: data?.defectsBySeverity || {},
      defeitos_por_status: data?.defectsByStatus || {},
    },
  };
};

export function transformReportForExport(
  reportType: string,
  reportData: any,
  format: TransformFormat,
  ctx?: TransformContext,
): ExportData | any | null {
  switch (reportType) {
    case 'execution-status':
      if (format === 'json') {
        // JSON: exporta lista de execuções com campos traduzidos
        const table = transformExecutionStatus(reportData || [], ctx);
        const [h, ...r] = [table.headers, ...table.rows];
        return { tipo: 'status-de-execucoes', geradoEm: new Date().toISOString(), cabecalhos: h, linhas: r };
      }
      return transformExecutionStatus(reportData || [], ctx);

    case 'test-priority':
      if (format === 'json') {
        const table = transformTestPriority(reportData || [], ctx);
        const [h, ...r] = [table.headers, ...table.rows];
        return { tipo: 'prioridade-de-testes', geradoEm: new Date().toISOString(), cabecalhos: h, linhas: r };
      }
      return transformTestPriority(reportData || [], ctx);

    case 'trend-analysis':
      if (format === 'json') return transformTrendAnalysisJSON(reportData);
      return transformTrendAnalysisCSV(reportData);

    case 'failure-analysis':
      if (format === 'json') return transformFailureAnalysisJSON(reportData, ctx);
      return transformFailureAnalysisCSV(reportData, ctx);

    case 'requirements-defects':
      if (format === 'json') return transformRequirementsDefectsJSON(reportData);
      return transformRequirementsDefectsCSV(reportData);

    // Relatórios adicionais: usar transformação genérica
    case 'ai-generation': {
      if (format === 'json') {
        return {
          tipo: 'geracao-ia',
          geradoEm: new Date().toISOString(),
          dados: reportData,
        };
      }
      return toTabular(reportData, 'Geração por IA', ctx);
    }

    case 'raw-data-export': {
      if (format === 'json') {
        return {
          tipo: 'dados-brutos',
          geradoEm: new Date().toISOString(),
          dados: reportData,
        };
      }
      return toTabular(reportData, 'Dados Brutos', ctx);
    }

    case 'performance-metrics':
    case 'quality-metrics':
    case 'execution-details': {
      if (format === 'json') {
        return {
          tipo: reportType,
          geradoEm: new Date().toISOString(),
          dados: reportData,
        };
      }
      return toTabular(reportData, 'Relatório', ctx);
    }

    default:
      // Fallback seguro para formatos não mapeados
      if (format === 'json') {
        return {
          tipo: reportType,
          geradoEm: new Date().toISOString(),
          dados: reportData,
        };
      }
      return toTabular(reportData, 'Relatório', ctx);
  }
}
