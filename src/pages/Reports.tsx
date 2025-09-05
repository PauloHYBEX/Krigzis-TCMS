import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3, 
  FileText, 
  TestTube, 
  PlayCircle, 
  Calendar, 
  Download, 
  Filter, 
  Eye, 
  PieChart,
  LineChart,
  Sparkles,
  Check,
  X as XIcon,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getTestPlans, getTestCases, getTestExecutions, getRequirements, getDefects } from '@/services/supabaseService';
import { TestPlan, TestCase, TestExecution, Requirement, Defect } from '@/types';
import { StandardButton } from '@/components/StandardButton';
import { useToast } from '@/hooks/use-toast';
import { 
  priorityLabel,
  priorityBadgeClass,
  requirementStatusLabel,
  requirementStatusBadgeClass,
  severityLabel,
  severityBadgeClass,
  defectStatusLabel,
  defectStatusBadgeClass,
  executionStatusLabel
} from '@/lib/labels';
import { 
  getTrendAnalysis, 
  getFailureAnalysis, 
  getRequirementsDefects, 
  type TrendAnalysisResponse, 
  type FailureAnalysisResponse, 
  type RequirementsDefectsResponse 
} from '@/services/reportsService';

import { supabase } from '@/integrations/supabase/client';
const SINGLE_TENANT = String((import.meta as any).env?.VITE_SINGLE_TENANT ?? 'true') === 'true';

// Estilos CSS personalizados para line-clamp e animações
const reportCardStyles = `
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  
  .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  
  .report-card-hover:hover {
    transform: translateY(-4px);
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }
  
  .report-icon-bg-purple-50 { background-color: rgb(250 245 255); }
  .report-icon-bg-orange-50 { background-color: rgb(255 251 235); }
  .report-icon-bg-blue-50 { background-color: rgb(239 246 255); }
  .report-icon-bg-green-50 { background-color: rgb(240 253 244); }
  .report-icon-bg-teal-50 { background-color: rgb(240 253 250); }
  .report-icon-bg-indigo-50 { background-color: rgb(238 242 255); }
  .report-icon-bg-emerald-50 { background-color: rgb(236 253 245); }
  .report-icon-bg-gray-50 { background-color: rgb(249 250 251); }
  .report-icon-bg-amber-50 { background-color: rgb(255 251 235); }
  .report-icon-bg-red-50 { background-color: rgb(254 242 242); }
  
  .report-icon-bg-purple-100 { background-color: rgb(237 233 254); }
  .report-icon-bg-orange-100 { background-color: rgb(254 215 170); }
  .report-icon-bg-blue-100 { background-color: rgb(219 234 254); }
  .report-icon-bg-green-100 { background-color: rgb(220 252 231); }
  .report-icon-bg-teal-100 { background-color: rgb(204 251 241); }
  .report-icon-bg-indigo-100 { background-color: rgb(224 231 255); }
  .report-icon-bg-emerald-100 { background-color: rgb(209 250 229); }
  .report-icon-bg-gray-100 { background-color: rgb(243 244 246); }
  .report-icon-bg-amber-100 { background-color: rgb(254 215 170); }
  .report-icon-bg-red-100 { background-color: rgb(254 226 226); }
`;

// Adicionar estilos ao head do documento
if (typeof document !== 'undefined') {
  const existingStyle = document.getElementById('report-card-styles');
  if (!existingStyle) {
    const style = document.createElement('style');
    style.id = 'report-card-styles';
    style.textContent = reportCardStyles;
    document.head.appendChild(style);
  }
}

// Definição dos tipos de relatório
const reportTypes = [
  {
    id: 'execution-status',
    title: 'Status de Execuções',
    description: 'Visão geral dos status de todas as execuções de teste',
    icon: PlayCircle,
    color: 'text-purple-600'
  },
  {
    id: 'test-priority',
    title: 'Distribuição por Prioridade',
    description: 'Análise da distribuição de casos de teste por prioridade',
    icon: AlertTriangle,
    color: 'text-orange-600'
  },
  {
    id: 'ai-generation',
    title: 'Geração por IA',
    description: 'Comparativo entre itens gerados por IA e manualmente',
    icon: Sparkles,
    color: 'text-blue-600'
  },
  {
    id: 'test-coverage',
    title: 'Cobertura de Testes',
    description: 'Análise da cobertura de testes por áreas do sistema',
    icon: Check,
    color: 'text-green-600'
  },
  {
    id: 'trend-analysis',
    title: 'Análise de Tendências',
    description: 'Evolução dos testes ao longo do tempo',
    icon: LineChart,
    color: 'text-teal-600'
  },
  {
    id: 'performance-metrics',
    title: 'Métricas de Performance',
    description: 'Análise detalhada de tempo de execução e performance',
    icon: BarChart3,
    color: 'text-indigo-600'
  },
  {
    id: 'quality-metrics',
    title: 'Métricas de Qualidade',
    description: 'Indicadores de qualidade e eficiência dos testes',
    icon: PieChart,
    color: 'text-emerald-600'
  },
  {
    id: 'raw-data-export',
    title: 'Dados Brutos',
    description: 'Exportação completa de todos os dados para análise externa',
    icon: FileText,
    color: 'text-gray-600'
  },
  {
    id: 'execution-details',
    title: 'Detalhamento de Execuções',
    description: 'Relatório detalhado com histórico completo de execuções',
    icon: Clock,
    color: 'text-amber-600'
  },
  {
    id: 'failure-analysis',
    title: 'Análise de Falhas',
    description: 'Investigação profunda de casos que falharam',
    icon: XIcon,
    color: 'text-red-600'
  },
  {
    id: 'requirements-defects',
    title: 'Requisitos e Defeitos',
    description: 'Rastreamento e situação de requisitos e defeitos',
    icon: AlertTriangle,
    color: 'text-orange-700'
  }
];

export const Reports = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<TestPlan[]>([]);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [executions, setExecutions] = useState<TestExecution[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  
  // Filtros
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'plans' | 'cases' | 'executions'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'passed' | 'failed' | 'blocked' | 'not_tested'>('all');
  const [selectedPriority, setSelectedPriority] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all');
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('week');

  // Dados agregados (Edge Function)
  const [trendAgg, setTrendAgg] = useState<TrendAnalysisResponse | null>(null);
  const [failureAgg, setFailureAgg] = useState<FailureAnalysisResponse | null>(null);
  const [reqDefAgg, setReqDefAgg] = useState<RequirementsDefectsResponse | null>(null);
  const [loadingAgg, setLoadingAgg] = useState(false);

  useEffect(() => {
    if (user) {
      loadAllData();
    }
  }, [user]);

  const loadAllData = async () => {
    try {
      const [plansData, casesData, executionsData, reqsData, defectsData] = await Promise.all([
        getTestPlans(user!.id),
        getTestCases(user!.id),
        getTestExecutions(user!.id),
        getRequirements(user!.id),
        getDefects(user!.id)
      ]);
      
      setPlans(plansData);
      setCases(casesData);
      setExecutions(executionsData);
      setRequirements(reqsData);
      setDefects(defectsData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };
 
  // Buscar agregações quando o relatório selecionado ou filtros mudarem
  useEffect(() => {
    if (!user) return;
    const fetchAgg = async () => {
      try {
        setLoadingAgg(true);
        if (selectedReport === 'trend-analysis') {
          const res = await getTrendAnalysis({
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            granularity,
          });
          setTrendAgg(res);
        } else if (selectedReport === 'failure-analysis') {
          const res = await getFailureAnalysis({
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
          });
          setFailureAgg(res);
        } else if (selectedReport === 'requirements-defects') {
          const res = await getRequirementsDefects({
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
          });
          setReqDefAgg(res);
        }
      } catch (err) {
        console.error('Erro ao obter agregações:', err);
      } finally {
        setLoadingAgg(false);
      }
    };
    fetchAgg();
  }, [user, selectedReport, dateFrom, dateTo, granularity]);

  // Métricas gerais
  const totalPlans = plans.length;
  const totalCases = cases.length;
  const totalExecutions = executions.length;
  const aiGeneratedPlans = plans.filter(p => p.generated_by_ai).length;
  const aiGeneratedCases = cases.filter(c => c.generated_by_ai).length;

  // Métricas de execução
  const passedExecutions = executions.filter(e => e.status === 'passed').length;
  const failedExecutions = executions.filter(e => e.status === 'failed').length;
  const blockedExecutions = executions.filter(e => e.status === 'blocked').length;
  const notTestedExecutions = executions.filter(e => e.status === 'not_tested').length;

  // Métricas de prioridade
  const criticalCases = cases.filter(c => c.priority === 'critical').length;
  const highCases = cases.filter(c => c.priority === 'high').length;
  const mediumCases = cases.filter(c => c.priority === 'medium').length;
  const lowCases = cases.filter(c => c.priority === 'low').length;

  // Coleta IDs de usuários referenciados nos dados do relatório
  const collectUserIds = (data: any): Set<string> => {
    const ids = new Set<string>();
    const visit = (node: any) => {
      if (!node) return;
      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }
      if (typeof node === 'object') {
        const obj = node as Record<string, any>;
        // Chaves mais comuns de autoria/execução
        ['user_id', 'executed_by', 'created_by', 'updated_by', 'owner_id', 'author_id'].forEach((k) => {
          const v = obj[k];
          if (typeof v === 'string' && v.trim()) ids.add(v);
        });
        Object.values(obj).forEach(visit);
      }
    };
    visit(data);
    return ids;
  };

  // Busca perfis no Supabase e constrói o mapa id -> nome exibível
  const fetchUserMap = async (ids: Set<string>): Promise<Record<string, string>> => {
    const map: Record<string, string> = {};

    // Modo single-tenant: apenas o usuário atual existe
    if (SINGLE_TENANT) {
      if (user?.id) {
        map[user.id] = (user as any)?.user_metadata?.full_name || (user as any)?.email || '';
      }
      return map;
    }

    const list = Array.from(ids).filter(Boolean);
    if (list.length === 0) {
      if (user?.id) {
        map[user.id] = (user as any)?.user_metadata?.full_name || (user as any)?.email || '';
      }
      return map;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, email')
        .in('id', list);
      if (error) throw error;
      (data || []).forEach((p: any) => {
        map[p.id] = p.display_name || p.email || '';
      });
    } catch (e) {
      console.error('Falha ao montar userMap para exportação:', e);
      // Fallback: apenas usuário atual
      if (user?.id) {
        map[user.id] = (user as any)?.user_metadata?.full_name || (user as any)?.email || '';
      }
    }

    return map;
  };

  const exportReport = async (format: 'pdf' | 'excel' | 'csv' | 'json') => {
    try {
      // Importar dinamicamente as funções de exportação
      const { exportToCSV, exportToExcel, exportToJSON, exportToPDF } = await import('../utils/export');
      const { transformReportForExport } = await import('../utils/reportTransformers');
      
      // Obter dados específicos baseados no tipo de relatório
      let reportData: any = null;
      let reportTitle = '';
      
      switch (selectedReport) {
        case 'execution-status':
          reportTitle = 'Status de Execução';
          reportData = executions.filter(exec => {
            if (selectedStatus !== 'all' && exec.status !== selectedStatus) return false;
            if (dateFrom && new Date(exec.executed_at) < new Date(dateFrom)) return false;
            if (dateTo && new Date(exec.executed_at) > new Date(dateTo)) return false;
            return true;
          });
          break;
        
        case 'test-priority':
          reportTitle = 'Prioridade de Testes';
          reportData = cases.filter(testCase => {
            if (selectedPriority !== 'all' && testCase.priority !== selectedPriority) return false;
            if (dateFrom && new Date(testCase.created_at) < new Date(dateFrom)) return false;
            if (dateTo && new Date(testCase.created_at) > new Date(dateTo)) return false;
            return true;
          });
          break;
        
        case 'ai-generation':
          reportTitle = 'Geração por IA';
          reportData = {
            planos: plans.filter(plan => plan.generated_by_ai),
            casos: cases.filter(testCase => testCase.generated_by_ai),
            estatisticas: {
              totalPlanos: plans.length,
              planosIA: plans.filter(plan => plan.generated_by_ai).length,
              totalCasos: cases.length,
              casosIA: cases.filter(testCase => testCase.generated_by_ai).length
            }
          };
          break;
        
        case 'raw-data-export':
          reportTitle = 'Dados Brutos';
          switch (selectedType) {
            case 'plans':
              reportData = plans;
              break;
            case 'cases':
              reportData = cases;
              break;
            case 'executions':
              reportData = executions;
              break;
            default:
              reportData = { plans, cases, executions };
          }
          break;
        
        case 'trend-analysis':
          reportTitle = 'Análise de Tendências';
          reportData = trendAgg?.data ?? {
            totals: {
              passed: executions.filter(e => e.status === 'passed').length,
              failed: executions.filter(e => e.status === 'failed').length,
              blocked: executions.filter(e => e.status === 'blocked').length,
              not_tested: executions.filter(e => e.status === 'not_tested').length,
              total: executions.length,
            },
            series: [],
            granularity,
          };
          break;

        case 'requirements-defects':
          reportTitle = 'Requisitos e Defeitos';
          reportData = reqDefAgg?.data ?? { requirements, defects };
          break;
        
        case 'failure-analysis':
          reportTitle = 'Análise de Falhas';
          if (failureAgg?.data) {
            reportData = failureAgg.data;
          } else {
            const failed = executions.filter(e => e.status === 'failed');
            const totals = {
              totalExecutions: executions.length,
              failedExecutions: failed.length,
              failureRate: executions.length ? failed.length / executions.length : 0,
              lastFailedAt: failed.length ? failed.sort((a,b) => new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime())[0].executed_at : null,
            };
            const failuresByCase = failed.reduce<Record<string, number>>((acc, e) => {
              acc[e.case_id] = (acc[e.case_id] || 0) + 1;
              return acc;
            }, {});
            const topCases = Object.entries(failuresByCase)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10)
              .map(([id, count]) => ({ id, title: cases.find(c => c.id === id)?.title || '', count }));
            reportData = { totals, topCases, topPlans: [] };
          }
          break;
        
        default:
          reportData = { plans, cases, executions };
          reportTitle = 'Relatório Completo';
      }
      
      if (format === 'pdf') {
        // Exporta apenas o conteúdo envolvido por [data-export-content]
        exportToPDF(reportTitle);
      } else {
        // Aplicar transformações para PT-BR, IDs sequenciais e mapeamentos
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `relatorio_${selectedReport}_${timestamp}`;
        // Construir userMap com todos os usuários referenciados no relatório
        const ids = collectUserIds(reportData);
        // Sempre incluir o usuário atual
        if (user?.id) ids.add(user.id);
        const userMap: Record<string, string> = await fetchUserMap(ids);
        const ctx = { cases, plans, executions, userMap };

        const transformed = transformReportForExport(
          selectedReport!,
          reportData,
          (format === 'csv' || format === 'excel' ? format : 'json') as 'csv' | 'excel' | 'json',
          ctx
        );

        if (format === 'json') {
          exportToJSON(transformed, filename);
        } else if (format === 'csv') {
          exportToCSV(transformed, filename);
        } else if (format === 'excel') {
          exportToExcel(transformed, filename);
        }
      }
      
      // Mostrar toast de sucesso
      toast({
        title: "Exportação realizada",
        description: `Relatório exportado em formato ${format.toUpperCase()}`,
      });
      
    } catch (error: any) {
      console.error('Erro na exportação:', error);
      toast({
        title: "Erro na exportação",
        description: error.message || `Erro ao exportar relatório em formato ${format}`,
        variant: "destructive",
      });
    }
  };

  // Renderiza os filtros específicos para cada tipo de relatório
  const renderFilters = () => {
    switch (selectedReport) {
      case 'execution-status':
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="dateFrom">Data inicial</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dateTo">Data final</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={selectedStatus} onValueChange={(value: any) => setSelectedStatus(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="passed">Aprovado</SelectItem>
                  <SelectItem value="failed">Reprovado</SelectItem>
                  <SelectItem value="blocked">Bloqueado</SelectItem>
                  <SelectItem value="not_tested">Não Testado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      
      case 'trend-analysis':
        return (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="dateFrom">Data inicial</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dateTo">Data final</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div>
              <Label>Granularidade</Label>
              <Select value={granularity} onValueChange={(v: any) => setGranularity(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a granularidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Dia</SelectItem>
                  <SelectItem value="week">Semana</SelectItem>
                  <SelectItem value="month">Mês</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      
      case 'test-priority':
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="dateFrom">Data inicial</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dateTo">Data final</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={selectedPriority} onValueChange={(value: any) => setSelectedPriority(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="critical">Crítica</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="low">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      
      case 'ai-generation':
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="dateFrom">Data inicial</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dateTo">Data final</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={selectedType} onValueChange={(value: any) => setSelectedType(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="plans">Planos</SelectItem>
                  <SelectItem value="cases">Casos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
        
      // Filtros para novos tipos de relatório
      case 'performance-metrics':
      case 'quality-metrics':
      case 'execution-details':
      case 'failure-analysis':
        return (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="dateFrom">Data inicial</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dateTo">Data final</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={selectedType} onValueChange={(value: any) => setSelectedType(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="plans">Planos</SelectItem>
                  <SelectItem value="cases">Casos</SelectItem>
                  <SelectItem value="executions">Execuções</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={selectedStatus} onValueChange={(value: any) => setSelectedStatus(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="passed">Aprovado</SelectItem>
                  <SelectItem value="failed">Reprovado</SelectItem>
                  <SelectItem value="blocked">Bloqueado</SelectItem>
                  <SelectItem value="not_tested">Não Testado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
        
      case 'raw-data-export':
        return (
          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
            <div>
              <Label>Tipo de Dados</Label>
              <Select value={selectedType} onValueChange={(value: any) => setSelectedType(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de dados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Dados</SelectItem>
                  <SelectItem value="plans">Apenas Planos</SelectItem>
                  <SelectItem value="cases">Apenas Casos</SelectItem>
                  <SelectItem value="executions">Apenas Execuções</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Renderiza o conteúdo do relatório selecionado
  const renderReportContent = () => {
    if (loadingAgg && (selectedReport === 'trend-analysis' || selectedReport === 'failure-analysis' || selectedReport === 'requirements-defects')) {
      return (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Carregando agregações...</CardTitle>
              <CardDescription>Aguarde enquanto processamos os dados do relatório selecionado.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mb-2" />
              <div className="h-4 w-1/3 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
            </CardContent>
          </Card>
        </div>
      );
    }
    switch (selectedReport) {
      case 'execution-status':
        return (
          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PlayCircle className="h-5 w-5 text-purple-600" />
                  Status das Execuções
                </CardTitle>
                <CardDescription>Resumo de execuções por status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
                    <div className="text-sm text-gray-500">Aprovadas</div>
                    <div className="text-2xl font-semibold text-green-700 dark:text-green-400">{passedExecutions}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30">
                    <div className="text-sm text-gray-500">Reprovadas</div>
                    <div className="text-2xl font-semibold text-red-700 dark:text-red-400">{failedExecutions}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                    <div className="text-sm text-gray-500">Bloqueadas</div>
                    <div className="text-2xl font-semibold text-amber-700 dark:text-amber-400">{blockedExecutions}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
                    <div className="text-sm text-gray-500">Não testadas</div>
                    <div className="text-2xl font-semibold text-gray-700 dark:text-gray-300">{notTestedExecutions}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Execuções recentes</CardTitle>
                <CardDescription>Filtradas conforme os filtros acima</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg divide-y">
                  {executions
                    .filter(exec => {
                      if (selectedStatus !== 'all' && exec.status !== selectedStatus) return false;
                      if (dateFrom && new Date(exec.executed_at) < new Date(dateFrom)) return false;
                      if (dateTo) {
                        const to = new Date(dateTo);
                        to.setHours(23, 59, 59, 999);
                        if (new Date(exec.executed_at) > to) return false;
                      }
                      return true;
                    })
                    .slice(0, 20)
                    .map(exec => (
                      <div key={exec.id} className="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800">
                        <div>
                          <div className="font-medium">
                            {cases.find(c => c.id === exec.case_id)?.title || `Execução #${exec.sequence ?? exec.id.slice(0, 8)}`}
                          </div>
                          <div className="text-xs text-gray-500">{new Date(exec.executed_at).toLocaleString()}</div>
                        </div>
                        <Badge className={
                          exec.status === 'passed' ? 'bg-green-100 text-green-800' :
                          exec.status === 'failed' ? 'bg-red-100 text-red-800' :
                          exec.status === 'blocked' ? 'bg-amber-100 text-amber-800' :
                          'bg-gray-100 text-gray-800'
                        }>
                          {executionStatusLabel(exec.status)}
                        </Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'trend-analysis': {
        // Mostrar dados agregados da Edge Function quando disponíveis
        const series = trendAgg?.data?.series ?? [];
        const totals = trendAgg?.data?.totals ?? {
          passed: executions.filter(e => e.status === 'passed').length,
          failed: executions.filter(e => e.status === 'failed').length,
          blocked: executions.filter(e => e.status === 'blocked').length,
          not_tested: executions.filter(e => e.status === 'not_tested').length,
          total: executions.length,
        };

        return (
          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="h-5 w-5 text-teal-600" />
                  Análise de Tendências
                </CardTitle>
                <CardDescription>
                  {trendAgg ? `Granularidade: ${trendAgg.data.granularity}` : 'Resumo geral (fallback local)'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
                    <div className="text-sm text-gray-500">Aprovadas</div>
                    <div className="text-2xl font-semibold text-green-700 dark:text-green-400">{totals.passed}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30">
                    <div className="text-sm text-gray-500">Reprovadas</div>
                    <div className="text-2xl font-semibold text-red-700 dark:text-red-400">{totals.failed}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                    <div className="text-sm text-gray-500">Bloqueadas</div>
                    <div className="text-2xl font-semibold text-amber-700 dark:text-amber-400">{totals.blocked}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
                    <div className="text-sm text-gray-500">Não testadas</div>
                    <div className="text-2xl font-semibold text-gray-700 dark:text-gray-300">{totals.not_tested}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                    <div className="text-sm text-gray-500">Total</div>
                    <div className="text-2xl font-semibold text-blue-700 dark:text-blue-400">{totals.total}</div>
                  </div>
                </div>

                <div className="mt-6 border rounded-lg overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="text-left p-2">Período</th>
                        <th className="text-left p-2">Aprovadas</th>
                        <th className="text-left p-2">Reprovadas</th>
                        <th className="text-left p-2">Bloqueadas</th>
                        <th className="text-left p-2">Não testadas</th>
                        <th className="text-left p-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {series.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-3 text-gray-500">Sem dados agregados para os filtros selecionados.</td>
                        </tr>
                      )}
                      {series.map((s) => (
                        <tr key={s.bucket} className="border-t">
                          <td className="p-2 font-medium">{s.bucket}</td>
                          <td className="p-2">{s.passed}</td>
                          <td className="p-2">{s.failed}</td>
                          <td className="p-2">{s.blocked}</td>
                          <td className="p-2">{s.not_tested}</td>
                          <td className="p-2">{s.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      }

      case 'ai-generation':
        return (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                    Gerados por IA
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span>Planos de Teste</span>
                      <Badge className="bg-purple-100 text-purple-800">{aiGeneratedPlans} de {totalPlans}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Casos de Teste</span>
                      <Badge className="bg-purple-100 text-purple-800">{aiGeneratedCases} de {totalCases}</Badge>
                    </div>
                    <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-purple-600 rounded-full" 
                        style={{ width: `${totalPlans + totalCases > 0 ? ((aiGeneratedPlans + aiGeneratedCases) / (totalPlans + totalCases)) * 100 : 0}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-500 text-center">
                      {totalPlans + totalCases > 0 
                        ? Math.round(((aiGeneratedPlans + aiGeneratedCases) / (totalPlans + totalCases)) * 100) 
                        : 0}% gerados por IA
                    </p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TestTube className="h-5 w-5 text-blue-600" />
                    Gerados Manualmente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span>Planos de Teste</span>
                      <Badge>{totalPlans - aiGeneratedPlans} de {totalPlans}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Casos de Teste</span>
                      <Badge>{totalCases - aiGeneratedCases} de {totalCases}</Badge>
                    </div>
                    <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 rounded-full" 
                        style={{ width: `${totalPlans + totalCases > 0 ? ((totalPlans + totalCases - aiGeneratedPlans - aiGeneratedCases) / (totalPlans + totalCases)) * 100 : 0}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-500 text-center">
                      {totalPlans + totalCases > 0 
                        ? Math.round(((totalPlans + totalCases - aiGeneratedPlans - aiGeneratedCases) / (totalPlans + totalCases)) * 100) 
                        : 0}% gerados manualmente
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Itens Gerados por IA</CardTitle>
                <CardDescription>Lista de planos e casos de teste gerados com IA</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg divide-y">
                  {selectedType !== 'cases' && plans
                    .filter(plan => plan.generated_by_ai)
                    .filter(plan => {
                      if (!dateFrom && !dateTo) return true;
                      const planDate = new Date(plan.updated_at);
                      const fromDate = dateFrom ? new Date(dateFrom) : null;
                      const toDate = dateTo ? new Date(dateTo) : null;
                      
                      if (fromDate && toDate) {
                        toDate.setHours(23, 59, 59, 999);
                        return planDate >= fromDate && planDate <= toDate;
                      }
                      if (fromDate) return planDate >= fromDate;
                      if (toDate) {
                        toDate.setHours(23, 59, 59, 999);
                        return planDate <= toDate;
                      }
                      return true;
                    })
                    .map(plan => (
                      <div key={plan.id} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                        <div className="flex justify-between">
                          <h4 className="font-medium flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-600" />
                            {plan.title}
                          </h4>
                          <span className="text-sm text-gray-500">
                            {new Date(plan.updated_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">
                          {plan.description}
                        </p>
                        <Badge className="mt-1 bg-purple-100 text-purple-800">Plano</Badge>
                      </div>
                    ))}
                    
                  {selectedType !== 'plans' && cases
                    .filter(testCase => testCase.generated_by_ai)
                    .filter(testCase => {
                      if (!dateFrom && !dateTo) return true;
                      const caseDate = new Date(testCase.updated_at);
                      const fromDate = dateFrom ? new Date(dateFrom) : null;
                      const toDate = dateTo ? new Date(dateTo) : null;
                      
                      if (fromDate && toDate) {
                        toDate.setHours(23, 59, 59, 999);
                        return caseDate >= fromDate && caseDate <= toDate;
                      }
                      if (fromDate) return caseDate >= fromDate;
                      if (toDate) {
                        toDate.setHours(23, 59, 59, 999);
                        return caseDate <= toDate;
                      }
                      return true;
                    })
                    .map(testCase => (
                      <div key={testCase.id} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                        <div className="flex justify-between">
                          <h4 className="font-medium flex items-center gap-2">
                            <TestTube className="h-4 w-4 text-green-600" />
                            {testCase.title}
                          </h4>
                          <span className="text-sm text-gray-500">
                            {new Date(testCase.updated_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">
                          {testCase.description}
                        </p>
                        <div className="flex gap-2 mt-1">
                          <Badge className="bg-purple-100 text-purple-800">Caso</Badge>
                          <Badge className={
                            testCase.priority === 'critical' ? 'bg-red-100 text-red-800' :
                            testCase.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                            testCase.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }>
                            {testCase.priority}
                          </Badge>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'test-coverage':
        return (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-600" />
                    Cobertura por Planos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {plans.slice(0, 5).map(plan => {
                      // Calcular número de casos associados a este plano
                      const planCases = cases.filter(c => c.plan_id === plan.id);
                      const planExecutions = executions.filter(e => 
                        planCases.some(c => c.id === e.case_id)
                      );
                      const passedForPlan = planExecutions.filter(e => e.status === 'passed').length;
                      const coveragePercent = planCases.length > 0 
                        ? Math.round((planExecutions.length / planCases.length) * 100) 
                        : 0;
                      const successPercent = planExecutions.length > 0 
                        ? Math.round((passedForPlan / planExecutions.length) * 100) 
                        : 0;
                      
                      return (
                        <div key={plan.id} className="border p-3 rounded-lg">
                          <h4 className="font-medium">{plan.title}</h4>
                          <div className="flex justify-between text-sm mt-1">
                            <span>Casos: {planCases.length}</span>
                            <span>Executados: {planExecutions.length}</span>
                          </div>
                          
                          <div className="mt-2">
                            <div className="flex justify-between text-xs">
                              <span>Cobertura</span>
                              <span>{coveragePercent}%</span>
                            </div>
                            <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden mt-1">
                              <div 
                                className="h-full bg-blue-600 rounded-full" 
                                style={{ width: `${coveragePercent}%` }}
                              ></div>
                            </div>
                          </div>
                          
                          <div className="mt-2">
                            <div className="flex justify-between text-xs">
                              <span>Sucesso</span>
                              <span>{successPercent}%</span>
                            </div>
                            <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden mt-1">
                              <div 
                                className={`h-full rounded-full ${
                                  successPercent > 75 ? 'bg-green-600' : 
                                  successPercent > 50 ? 'bg-yellow-600' : 
                                  'bg-red-600'
                                }`}
                                style={{ width: `${successPercent}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-blue-600" />
                    Estatísticas de Cobertura
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-medium mb-2">Casos x Execuções</h4>
                      <div className="flex items-center gap-4">
                        <div className="h-24 w-24 rounded-full border-8 border-blue-500 flex items-center justify-center">
                          <span className="text-lg font-bold">
                            {totalCases > 0 ? Math.round((totalExecutions / totalCases) * 100) : 0}%
                          </span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span>Total de Casos</span>
                            <span className="font-medium">{totalCases}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Total de Execuções</span>
                            <span className="font-medium">{totalExecutions}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Casos sem Execução</span>
                            <span className="font-medium">{totalCases - cases.filter(c => 
                              executions.some(e => e.case_id === c.id)
                            ).length}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-2">Prioridades Testadas</h4>
                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between text-xs">
                            <span>Crítica</span>
                            <span>
                              {criticalCases > 0 
                                ? Math.round((cases.filter(c => 
                                    c.priority === 'critical' && 
                                    executions.some(e => e.case_id === c.id)
                                  ).length / criticalCases) * 100) 
                                : 0}%
                            </span>
                          </div>
                          <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden mt-1">
                            <div 
                              className="h-full bg-red-600 rounded-full" 
                              style={{ width: `${criticalCases > 0 
                                ? Math.round((cases.filter(c => 
                                    c.priority === 'critical' && 
                                    executions.some(e => e.case_id === c.id)
                                  ).length / criticalCases) * 100) 
                                : 0}%` }}
                            ></div>
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-xs">
                            <span>Alta</span>
                            <span>
                              {highCases > 0 
                                ? Math.round((cases.filter(c => 
                                    c.priority === 'high' && 
                                    executions.some(e => e.case_id === c.id)
                                  ).length / highCases) * 100) 
                                : 0}%
                            </span>
                          </div>
                          <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden mt-1">
                            <div 
                              className="h-full bg-orange-600 rounded-full" 
                              style={{ width: `${highCases > 0 
                                ? Math.round((cases.filter(c => 
                                    c.priority === 'high' && 
                                    executions.some(e => e.case_id === c.id)
                                  ).length / highCases) * 100) 
                                : 0}%` }}
                            ></div>
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-xs">
                            <span>Média</span>
                            <span>
                              {mediumCases > 0 
                                ? Math.round((cases.filter(c => 
                                    c.priority === 'medium' && 
                                    executions.some(e => e.case_id === c.id)
                                  ).length / mediumCases) * 100) 
                                : 0}%
                            </span>
                          </div>
                          <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden mt-1">
                            <div 
                              className="h-full bg-yellow-600 rounded-full" 
                              style={{ width: `${mediumCases > 0 
                                ? Math.round((cases.filter(c => 
                                    c.priority === 'medium' && 
                                    executions.some(e => e.case_id === c.id)
                                  ).length / mediumCases) * 100) 
                                : 0}%` }}
                            ></div>
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-xs">
                            <span>Baixa</span>
                            <span>
                              {lowCases > 0 
                                ? Math.round((cases.filter(c => 
                                    c.priority === 'low' && 
                                    executions.some(e => e.case_id === c.id)
                                  ).length / lowCases) * 100) 
                                : 0}%
                            </span>
                          </div>
                          <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden mt-1">
                            <div 
                              className="h-full bg-green-600 rounded-full" 
                              style={{ width: `${lowCases > 0 
                                ? Math.round((cases.filter(c => 
                                    c.priority === 'low' && 
                                    executions.some(e => e.case_id === c.id)
                                  ).length / lowCases) * 100) 
                                : 0}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Casos sem Execução</CardTitle>
                <CardDescription>Casos de teste que ainda não foram executados</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg divide-y">
                  {cases
                    .filter(c => !executions.some(e => e.case_id === c.id))
                    .filter(testCase => {
                      if (!dateFrom && !dateTo) return true;
                      const caseDate = new Date(testCase.updated_at);
                      const fromDate = dateFrom ? new Date(dateFrom) : null;
                      const toDate = dateTo ? new Date(dateTo) : null;
                      
                      if (fromDate && toDate) {
                        toDate.setHours(23, 59, 59, 999);
                        return caseDate >= fromDate && caseDate <= toDate;
                      }
                      if (fromDate) return caseDate >= fromDate;
                      if (toDate) {
                        toDate.setHours(23, 59, 59, 999);
                        return caseDate <= toDate;
                      }
                      return true;
                    })
                    .map(testCase => (
                      <div key={testCase.id} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                        <div className="flex justify-between">
                          <h4 className="font-medium flex items-center gap-2">
                            <TestTube className="h-4 w-4 text-green-600" />
                            {testCase.title}
                          </h4>
                          <div className="flex items-center gap-2">
                            <Badge className={
                              testCase.priority === 'critical' ? 'bg-red-100 text-red-800' :
                              testCase.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                              testCase.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }>
                              {testCase.priority}
                            </Badge>
                            <span className="text-sm text-gray-500">
                              {new Date(testCase.updated_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">
                          {testCase.description}
                        </p>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'test-priority':
        return (
          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  Distribuição por Prioridade
                </CardTitle>
                <CardDescription>Resumo de casos por prioridade</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span>Crítica</span>
                    <Badge className="bg-red-100 text-red-800">{criticalCases}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Alta</span>
                    <Badge className="bg-orange-100 text-orange-800">{highCases}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Média</span>
                    <Badge className="bg-yellow-100 text-yellow-800">{mediumCases}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Baixa</span>
                    <Badge className="bg-green-100 text-green-800">{lowCases}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'raw-data-export': {
        return (
          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Exportação de Dados Brutos</CardTitle>
                <CardDescription>Baixe todos os dados para análise externa</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="text-center">
                    <CardHeader className="pb-1">
                      <CardTitle className="text-xl font-bold text-blue-600">
                        {totalPlans}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-1">
                      <Badge className="bg-blue-100 text-blue-800 text-xs">Planos de Teste</Badge>
                      <p className="mt-1 text-xs text-gray-500">Registros disponíveis</p>
                    </CardContent>
                  </Card>
                  {/* ... */}
                </div>
              </CardContent>
            </Card>
          </div>
        );
      }

      case 'failure-analysis': {
        // Filtrar execuções por período/status (reaproveita filtros globais)
        const filteredExecutions = executions.filter(exec => {
          if (selectedStatus !== 'all' && exec.status !== selectedStatus) return false;
          if (dateFrom && new Date(exec.executed_at) < new Date(dateFrom)) return false;
          if (dateTo) {
            const to = new Date(dateTo);
            to.setHours(23, 59, 59, 999);
            if (new Date(exec.executed_at) > to) return false;
          }
          return true;
        });

        const failed = filteredExecutions.filter(e => e.status === 'failed');
        const blocked = filteredExecutions.filter(e => e.status === 'blocked');
        const passed = filteredExecutions.filter(e => e.status === 'passed');
        const failureRate = filteredExecutions.length > 0
          ? Math.round((failed.length / filteredExecutions.length) * 100)
          : 0;
        const failureRatePct = typeof failureAgg?.data?.totals?.failureRate === 'number'
          ? Math.round(failureAgg.data.totals.failureRate * 100)
          : failureRate;

        // Top casos com mais falhas
        const failuresByCase = failed.reduce<Record<string, number>>((acc, e) => {
          acc[e.case_id] = (acc[e.case_id] || 0) + 1;
          return acc;
        }, {});
        const topFailingCases = Object.entries(failuresByCase)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);

        return (
          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <XIcon className="h-5 w-5 text-red-600" />
                  Análise de Falhas
                </CardTitle>
                <CardDescription>Visão geral de falhas no período selecionado</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30">
                    <div className="text-sm text-gray-500">Falhas</div>
                    <div className="text-2xl font-semibold text-red-700 dark:text-red-400">{failed.length}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
                    <div className="text-sm text-gray-500">Aprovadas</div>
                    <div className="text-2xl font-semibold text-green-700 dark:text-green-400">{passed.length}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                    <div className="text-sm text-gray-500">Bloqueadas</div>
                    <div className="text-2xl font-semibold text-amber-700 dark:text-amber-400">{blocked.length}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
                    <div className="text-sm text-gray-500">Taxa de Falha</div>
                    <div className="text-2xl font-semibold text-gray-700 dark:text-gray-300">{failureRatePct}%</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Casos com Mais Falhas</CardTitle>
                <CardDescription>Ordenado por número de falhas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg divide-y">
                  {(failureAgg?.data?.topCases?.length ?? topFailingCases.length) === 0 && (
                    <div className="p-3 text-sm text-gray-500">Sem falhas no período.</div>
                  )}
                  {(failureAgg?.data?.topCases ?? []).map(tc => {
                    const caze = cases.find(c => c.id === tc.id);
                    return (
                      <div key={tc.id} className="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{tc.title || caze?.title || `Caso ${tc.id.slice(0, 8)}`}</div>
                          <div className="text-xs text-gray-500">Falhas: {tc.count}</div>
                        </div>
                        {caze && (
                          <Badge className={
                            caze.priority === 'critical' ? 'bg-red-100 text-red-800' :
                            caze.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                            caze.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }>
                            {caze.priority}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                  {(!failureAgg?.data?.topCases || failureAgg.data.topCases.length === 0) && topFailingCases.map(([caseId, count]) => {
                    const caze = cases.find(c => c.id === caseId);
                    return (
                      <div key={caseId} className="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{caze?.title || `Caso ${caseId.slice(0, 8)}`}</div>
                          <div className="text-xs text-gray-500">Falhas: {count}</div>
                        </div>
                        {caze && (
                          <Badge className={
                            caze.priority === 'critical' ? 'bg-red-100 text-red-800' :
                            caze.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                            caze.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }>
                            {caze.priority}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Falhas Recentes</CardTitle>
                <CardDescription>Últimas execuções reprovadas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg divide-y">
                  {failed
                    .slice(0, 20)
                    .map(exec => (
                      <div key={exec.id} className="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800">
                        <div>
                          <div className="font-medium">
                            {cases.find(c => c.id === exec.case_id)?.title || `Execução #${exec.sequence ?? exec.id.slice(0, 8)}`}
                          </div>
                          <div className="text-xs text-gray-500">{new Date(exec.executed_at).toLocaleString()}</div>
                        </div>
                        <Badge className="bg-red-100 text-red-800">failed</Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        );
      }

      case 'requirements-defects': {
        // Preferir dados agregados da Edge Function; fallback para cálculo local
        const filteredRequirements = requirements.filter(req => {
          if (dateFrom && new Date(req.updated_at) < new Date(dateFrom)) return false;
          if (dateTo) {
            const to = new Date(dateTo);
            to.setHours(23, 59, 59, 999);
            if (new Date(req.updated_at) > to) return false;
          }
          return true;
        });
        const filteredDefects = defects.filter(def => {
          if (dateFrom && new Date(def.updated_at) < new Date(dateFrom)) return false;
          if (dateTo) {
            const to = new Date(dateTo);
            to.setHours(23, 59, 59, 999);
            if (new Date(def.updated_at) > to) return false;
          }
          return true;
        });

        const reqByStatus: Record<string, number> = reqDefAgg?.data?.requirementsByStatus ?? {
          open: filteredRequirements.filter(r => r.status === 'open').length,
          in_progress: filteredRequirements.filter(r => r.status === 'in_progress').length,
          approved: filteredRequirements.filter(r => r.status === 'approved').length,
          deprecated: filteredRequirements.filter(r => r.status === 'deprecated').length,
        };
        const reqByPriority: Record<string, number> = reqDefAgg?.data?.requirementsByPriority ?? {
          critical: filteredRequirements.filter(r => r.priority === 'critical').length,
          high: filteredRequirements.filter(r => r.priority === 'high').length,
          medium: filteredRequirements.filter(r => r.priority === 'medium').length,
          low: filteredRequirements.filter(r => r.priority === 'low').length,
        };

        const defectsByStatus: Record<string, number> = reqDefAgg?.data?.defectsByStatus ?? {
          open: filteredDefects.filter(d => d.status === 'open').length,
          in_analysis: filteredDefects.filter(d => d.status === 'in_analysis').length,
          fixed: filteredDefects.filter(d => d.status === 'fixed').length,
          validated: filteredDefects.filter(d => d.status === 'validated').length,
          closed: filteredDefects.filter(d => d.status === 'closed').length,
        };
        const defectsBySeverity: Record<string, number> = reqDefAgg?.data?.defectsBySeverity ?? {
          critical: filteredDefects.filter(d => d.severity === 'critical').length,
          high: filteredDefects.filter(d => d.severity === 'high').length,
          medium: filteredDefects.filter(d => d.severity === 'medium').length,
          low: filteredDefects.filter(d => d.severity === 'low').length,
        };

        return (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Requisitos por Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(['open','in_progress','approved','deprecated'] as const).map(st => (
                      <div key={st} className="flex items-center justify-between">
                        <span>{requirementStatusLabel(st)}</span>
                        <Badge className={requirementStatusBadgeClass(st)}>{reqByStatus[st]}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Requisitos por Prioridade</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(['critical','high','medium','low'] as const).map(p => (
                      <div key={p} className="flex items-center justify-between">
                        <span className="capitalize">{p}</span>
                        <Badge className={
                          p === 'critical' ? 'bg-red-100 text-red-800' :
                          p === 'high' ? 'bg-orange-100 text-orange-800' :
                          p === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }>
                          {reqByPriority[p]}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Defeitos por Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(['open','in_analysis','fixed','validated','closed'] as const).map(st => (
                      <div key={st} className="flex items-center justify-between">
                        <span>{defectStatusLabel(st)}</span>
                        <Badge className={defectStatusBadgeClass(st)}>{defectsByStatus[st]}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Defeitos por Severidade</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(['critical','high','medium','low'] as const).map(sv => (
                      <div key={sv} className="flex items-center justify-between">
                        <span>{severityLabel(sv)}</span>
                        <Badge className={severityBadgeClass(sv)}>{defectsBySeverity[sv]}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Defeitos Recentes</CardTitle>
                <CardDescription>Lista de defeitos filtrados por período</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg divide-y">
                  {filteredDefects
                    .slice(0, 20)
                    .map(def => (
                      <div key={def.id} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                        <div className="flex justify-between">
                          <h4 className="font-medium">{def.title}</h4>
                          <div className="flex items-center gap-2">
                            <Badge className={defectStatusBadgeClass(def.status)}>{defectStatusLabel(def.status)}</Badge>
                            <Badge className={severityBadgeClass(def.severity)}>{severityLabel(def.severity)}</Badge>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">{def.description}</p>
                        <div className="text-xs text-gray-500 mt-1">
                          {def.case_id ? `Vinculado ao caso ${cases.find(c => c.id === def.case_id)?.title ?? def.case_id.slice(0,8)}` : 'Sem caso vinculado'}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        );
      }

      case 'performance-metrics':
      case 'quality-metrics':
      case 'execution-details':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Em breve</CardTitle>
              <CardDescription>Conteúdo para "{reportTypes.find(r => r.id === selectedReport)?.title}" será adicionado.</CardDescription>
            </CardHeader>
          </Card>
        );

      default:
        return null;
    }
  };

  

  

  return (
    <div className="space-y-8">
      {selectedReport && (
        <div className="no-print flex justify-end mb-6">
          <div className="flex flex-wrap gap-3">
            <StandardButton 
              variant="outline" 
              icon={Download} 
              onClick={() => exportReport('pdf')}
              className="transition-all duration-300 hover:scale-105"
            >
              Exportar PDF
            </StandardButton>
            <StandardButton 
              variant="outline" 
              icon={Download} 
              onClick={() => exportReport('excel')}
              className="transition-all duration-300 hover:scale-105"
            >
              Exportar Excel
            </StandardButton>
          </div>
        </div>
      )}

      {!selectedReport ? (
        <div>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Relatórios
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {reportTypes.map(report => (
              <Card 
                key={report.id} 
                className="group cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border border-gray-200 hover:border-blue-400 bg-white dark:bg-gray-800 dark:border-gray-700 dark:hover:border-blue-500"
                onClick={() => setSelectedReport(report.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 transition-colors group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20">
                      <report.icon className={`h-5 w-5 ${report.color} dark:text-gray-300`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight line-clamp-2 mb-1">
                        {report.title}
                      </h4>
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                        {report.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        ) : (
        // Visualização do relatório selecionado
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-medium flex items-center gap-2">
              {reportTypes.find(r => r.id === selectedReport)?.title}
              <Button variant="ghost" size="sm" className="no-print" onClick={() => setSelectedReport(null)}>
                Voltar à Lista
              </Button>
            </h3>
          </div>
          
          {/* Filtros específicos para o relatório */}
          <Card className="no-print">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderFilters()}
            </CardContent>
          </Card>
          
          {/* Conteúdo do relatório */}
          <div data-export-content>
            {renderReportContent()}
          </div>
        </div>
      )}
    </div>
  );
};
