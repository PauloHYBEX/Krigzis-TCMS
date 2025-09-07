import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plus, Calendar, Download, PlayCircle, Edit, Trash2, Search, Filter, ArrowUpDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getTestExecutions, getTestExecutionsByProject, getTestPlansByIds, getTestCasesByIds, deleteTestExecution } from '@/services/supabaseService';
import { TestExecution } from '@/types';
import { TestExecutionForm } from '@/components/forms/TestExecutionForm';
import { DetailModal } from '@/components/DetailModal';
import { StandardButton } from '@/components/StandardButton';
import { ViewModeToggle } from '@/components/ViewModeToggle';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { executionStatusBadgeClass, executionStatusLabel } from '@/lib/labels';
import { useProject } from '@/contexts/ProjectContext';
import { ProjectSelectField } from '@/components/forms/ProjectSelectField';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

export const TestExecutions = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [executions, setExecutions] = useState<TestExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<TestExecution | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>(() => {
    const saved = localStorage.getItem('testExecutions_viewMode');
    return (saved as 'cards' | 'list') || 'list';
  });
  const [showEditForm, setShowEditForm] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterStatus, setFilterStatus] = useState<'all' | 'passed' | 'failed' | 'blocked' | 'not_tested'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'executed_at' | 'sequence' | 'status'>('executed_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  // Pagination
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(9);
  // Projeto atual e filtro por projeto
  const { currentProject } = useProject();
  const [filterProject, setFilterProject] = useState<string>(currentProject?.id || 'all');
  // Mapas para enriquecer colunas (plano/caso)
  const [planMap, setPlanMap] = useState<Record<string, { id: string; sequence?: number; project_id: string }>>({});
  const [caseMap, setCaseMap] = useState<Record<string, { id: string; sequence?: number }>>({});
  // Exclusão
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deletingExecutionId, setDeletingExecutionId] = useState<string | null>(null);

  // Tipagem e guarda para status
  const allowedStatuses = ['all', 'passed', 'failed', 'blocked', 'not_tested'] as const;
  type ExecStatus = typeof allowedStatuses[number];
  const isExecStatus = (s: string): s is ExecStatus => (allowedStatuses as readonly string[]).includes(s);

  useEffect(() => {
    if (user) {
      loadExecutions();
    }
  }, [user, filterProject]);

  // Persistir modo de visualização
  useEffect(() => {
    localStorage.setItem('testExecutions_viewMode', viewMode);
  }, [viewMode]);

  // Listener para troca de projeto global
  useEffect(() => {
    const handler = () => loadExecutions();
    window.addEventListener('krg:project-changed', handler as EventListener);
    return () => window.removeEventListener('krg:project-changed', handler as EventListener);
  }, []);

  // Abrir modal automaticamente se houver ?id=
  useEffect(() => {
    const id = searchParams.get('id');
    const modal = searchParams.get('modal');
    if (!id) return;
    // Não abrir visualização se estiver em modo de criação/edição
    if (modal === 'exec:new' || modal === 'exec:edit') return;
    if (executions.length === 0) return;
    const found = executions.find(e => e.id === id);
    if (found) {
      setSelectedExecution(found);
      setShowDetailModal(true);
    }
  }, [executions, searchParams]);

  // Restaurar filtros via URL (?status=&q=&project=)
  useEffect(() => {
    const status = searchParams.get('status');
    const q = searchParams.get('q');
    const p = searchParams.get('project');
    if (status && isExecStatus(status)) {
      setFilterStatus(status);
    }
    if (q !== null) {
      setSearchTerm(q);
    }
    if (p) setFilterProject(p);
    else if (currentProject?.id) setFilterProject(currentProject.id);
    else setFilterProject('all');
  }, [searchParams, currentProject?.id]);

  // Restaurar abertura de modais via URL (?modal=exec:new | exec:edit&id=...)
  useEffect(() => {
    const modal = searchParams.get('modal');
    if (modal === 'exec:new') {
      setShowForm(true);
    } else if (modal === 'exec:edit') {
      const id = searchParams.get('id');
      if (id && executions.length > 0) {
        const found = executions.find(e => e.id === id);
        if (found) {
          setSelectedExecution(found);
          setShowEditForm(true);
        }
      }
    }
  }, [searchParams, executions]);

  // Read pagination from URL
  useEffect(() => {
    const sp = searchParams.get('page');
    const ps = searchParams.get('pageSize');
    const p = sp ? Math.max(1, parseInt(sp, 10) || 1) : 1;
    const s = ps ? Math.max(1, parseInt(ps, 10) || 9) : 9;
    if (p !== page) setPage(p);
    if (s !== pageSize) setPageSize(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const filteredExecutions = useMemo(() => {
    const raw = searchTerm.trim();
    const term = raw.toLowerCase();
    const numMatch = raw.match(/^#?\s*(\d+)\s*$/);
    return executions.filter((e) => {
      const statusOk = filterStatus === 'all' || e.status === filterStatus;
      if (!statusOk) return false;
      if (!term) return true;
      // Se for consulta numérica, exigir correspondência exata do número de sequência
      if (numMatch) {
        const qn = Number(numMatch[1]);
        const seqValue = e.sequence ?? null;
        return seqValue != null && Number(seqValue) === qn;
      }
      // Busca textual padrão
      const seqStr = (e.sequence ?? e.id).toString().toLowerCase();
      const idShort = e.id.slice(0, 8);
      const executedBy = e.executed_by?.toLowerCase() ?? '';
      const notes = e.notes?.toLowerCase() ?? '';
      const label = e.status;
      return (
        seqStr.includes(term) ||
        idShort.includes(term) ||
        executedBy.includes(term) ||
        notes.includes(term) ||
        label.includes(term)
      );
    });
  }, [executions, filterStatus, searchTerm]);

  const sortedExecutions = useMemo(() => {
    const list = [...filteredExecutions];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'executed_at') {
        const aTime = a.executed_at ? new Date(a.executed_at).getTime() : 0;
        const bTime = b.executed_at ? new Date(b.executed_at).getTime() : 0;
        cmp = aTime - bTime;
      } else if (sortBy === 'sequence') {
        const aSeq = a.sequence ?? 0;
        const bSeq = b.sequence ?? 0;
        cmp = aSeq - bSeq;
      } else if (sortBy === 'status') {
        cmp = a.status.localeCompare(b.status);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [filteredExecutions, sortBy, sortDir]);

  // Derived pagination data
  const totalItems = sortedExecutions.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedExecutions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedExecutions.slice(start, start + pageSize);
  }, [sortedExecutions, currentPage, pageSize]);

  // Clamp page when data/pageSize changes
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  // Sync page & pageSize to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(currentPage));
    params.set('pageSize', String(pageSize));
    setSearchParams(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize]);

  // Scroll to top when page or pageSize changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage, pageSize]);

  const loadExecutions = async () => {
    try {
      setLoading(true);
      const projectParam = filterProject === 'all' ? undefined : filterProject;
      const data = projectParam
        ? await getTestExecutionsByProject(user!.id, projectParam)
        : await getTestExecutions(user!.id);
      setExecutions(data);
      // Enriquecer com mapas de plano e caso para exibição
      const uniquePlanIds = Array.from(new Set(data.map(e => e.plan_id).filter(Boolean)));
      const uniqueCaseIds = Array.from(new Set(data.map(e => e.case_id).filter(Boolean)));
      const [plans, cases] = await Promise.all([
        getTestPlansByIds(user!.id, uniquePlanIds as string[]),
        getTestCasesByIds(user!.id, uniqueCaseIds as string[]),
      ]);
      const pMap: Record<string, { id: string; sequence?: number; project_id: string }> = {};
      plans.forEach(p => { pMap[p.id] = { id: p.id, sequence: p.sequence, project_id: p.project_id }; });
      setPlanMap(pMap);
      const cMap: Record<string, { id: string; sequence?: number }> = {};
      cases.forEach(c => { cMap[c.id] = { id: c.id, sequence: c.sequence }; });
      setCaseMap(cMap);
    } catch (error) {
      console.error('Erro ao carregar execuções:', error);
      setExecutions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSortChange = (value: string) => {
    // value format: `${by}:${dir}`
    const [by, dir] = value.split(':') as ['executed_at' | 'sequence' | 'status', 'asc' | 'desc'];
    if (by) setSortBy(by);
    if (dir) setSortDir(dir);
  };

  // Atualiza URL ao mudar filtros
  const handleFilterStatusChange = (v: ExecStatus) => {
    setFilterStatus(v);
    setPage(1);
    const params = new URLSearchParams(searchParams);
    if (v === 'all') params.delete('status'); else params.set('status', v);
    setSearchParams(params);
  };

  const handleSearchTermChange = (val: string) => {
    setSearchTerm(val);
    setPage(1);
    const params = new URLSearchParams(searchParams);
    if (val) params.set('q', val); else params.delete('q');
    setSearchParams(params);
  };

  const handleProjectFilterChange = (projectId: string) => {
    setFilterProject(projectId);
    setPage(1);
    const params = new URLSearchParams(searchParams);
    if (projectId && projectId !== 'all') params.set('project', projectId);
    else params.set('project', 'all');
    setSearchParams(params);
  };

  // Labels helpers
  const exeLabel = (e: TestExecution) => {
    const n = e.sequence ?? null;
    if (n != null) return `EXE-${String(n).padStart(3, '0')}`;
    return `EXE-${e.id.slice(0, 4)}`;
  };
  const caseLabel = (caseId: string) => {
    const c = caseMap[caseId];
    if (!c) return '—';
    return c.sequence != null ? `CT-${String(c.sequence).padStart(3, '0')}` : `CT-${c.id.slice(0, 4)}`;
  };
  const planLabel = (planId: string) => {
    const p = planMap[planId];
    if (!p) return '—';
    return p.sequence != null ? `PT-${String(p.sequence).padStart(3, '0')}` : `PT-${p.id.slice(0, 4)}`;
  };

  const requestDelete = (id: string) => {
    setDeletingExecutionId(id);
    setConfirmDeleteOpen(true);
  };

  const performDelete = async () => {
    if (!deletingExecutionId) return;
    try {
      await deleteTestExecution(deletingExecutionId);
      setExecutions(prev => prev.filter(ex => ex.id !== deletingExecutionId));
      toast({ title: 'Execução excluída', description: 'A execução foi removida com sucesso.' });
    } catch (error: unknown) {
      toast({
        title: 'Erro ao excluir',
        description: (error instanceof Error ? error.message : 'Não foi possível excluir a execução.'),
        variant: 'destructive'
      });
    } finally {
      setConfirmDeleteOpen(false);
      setDeletingExecutionId(null);
    }
  };

  const handleExecutionCreated = (execution: TestExecution) => {
    setExecutions(prev => [execution, ...prev]);
    setShowForm(false);
    // Limpar modal da URL
    const params = new URLSearchParams(searchParams);
    params.delete('modal');
    setSearchParams(params);
  };

  const handleExecutionUpdated = (updated: TestExecution) => {
    setExecutions(prev => prev.map(ex => (ex.id === updated.id ? updated : ex)));
    setShowEditForm(false);
    setSelectedExecution(updated);
    // Limpar modal da URL
    const params = new URLSearchParams(searchParams);
    params.delete('modal');
    setSearchParams(params);
  };

  const handleViewDetails = (execution: TestExecution) => {
    setSelectedExecution(execution);
    setShowDetailModal(true);
    // Definir query param para deep-linking
    const params = new URLSearchParams(searchParams);
    params.set('id', execution.id);
    setSearchParams(params);
  };

  // cores/labels de status padronizados em src/lib/labels.ts

  const handleExport = async (format: 'csv' | 'excel' | 'json') => {
    try {
      if (sortedExecutions.length === 0) {
        toast({ title: 'Nada para exportar', description: 'A lista filtrada está vazia.', variant: 'destructive' });
        return;
      }
      const { exportSupabaseData } = await import('../utils/export');
      await exportSupabaseData('execucoes_teste', sortedExecutions, format, `execucoes_teste_${new Date().toISOString().split('T')[0]}`);
      toast({
        title: "Exportação realizada",
        description: `Execuções exportadas em formato ${format.toUpperCase()}`,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : `Erro ao exportar execuções em formato ${format}`;
      toast({
        title: "Erro na exportação",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleCopy = async (format: 'txt' | 'md') => {
    try {
      if (sortedExecutions.length === 0) {
        toast({ title: 'Nada para copiar', description: 'A lista filtrada está vazia.', variant: 'destructive' });
        return;
      }
      const { copyTableData } = await import('../utils/export');
      
      // Converter dados das execuções para formato de exportação
      const headers = ['Número', 'Status', 'Executado por', 'Notas', 'Data de Execução'];
      const rows = sortedExecutions.map(execution => [
        (execution.sequence ?? execution.id.slice(0, 8)),
        executionStatusLabel(execution.status as any),
        execution.executed_by,
        execution.notes || 'Sem notas',
        new Date(execution.executed_at).toLocaleDateString('pt-BR')
      ]);

      const success = await copyTableData({ headers, rows }, format, 'Execuções de Teste');
      
      if (success) {
        toast({
          title: "Conteúdo copiado",
          description: `Execuções copiadas em formato ${format.toUpperCase()} para a área de transferência`,
        });
      } else {
        throw new Error('Falha ao copiar conteúdo');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : `Erro ao copiar execuções em formato ${format}`;
      toast({
        title: "Erro ao copiar",
        description: message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="pl-24">
          <h1 className="text-2xl font-bold text-foreground">Execuções</h1>
          <p className="text-sm text-muted-foreground">Acompanhe e gerencie as execuções de teste</p>
        </div>
        {/* Nova Execução */}
        <Dialog open={showForm} onOpenChange={(open) => {
          setShowForm(open);
          const params = new URLSearchParams(searchParams);
          if (open) {
            params.set('modal', 'exec:new');
            params.delete('id');
          } else {
            params.delete('modal');
          }
          setSearchParams(params);
        }}>
          <DialogTrigger asChild>
            <StandardButton 
              onClick={() => {}}
              className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white border-0"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Execução
            </StandardButton>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova Execução</DialogTitle>
              <DialogDescription>Preencha os dados da execução de teste</DialogDescription>
            </DialogHeader>
            <TestExecutionForm 
              onSuccess={handleExecutionCreated}
              onCancel={() => setShowForm(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => handleSearchTermChange(e.target.value)}
            placeholder="Buscar por número (#12), executor ou notas"
            className="pl-10 h-10"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Project Filter */}
          <div className="w-56">
            <ProjectSelectField
              value={filterProject}
              onValueChange={handleProjectFilterChange}
              includeAllOption
              allLabel="Todos os projetos"
              placeholder="Filtrar por projeto"
            />
          </div>

          {/* View Mode Toggle */}
          <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />

          {/* Sort Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                Ordenar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleSortChange('executed_at:desc')}>Mais recentes</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSortChange('executed_at:asc')}>Mais antigas</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSortChange('sequence:desc')}>Número (maior primeiro)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSortChange('sequence:asc')}>Número (menor primeiro)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSortChange('status:asc')}>Status (A→Z)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSortChange('status:desc')}>Status (Z→A)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                {filterStatus === 'all' ? 'Todos' : `Status: ${executionStatusLabel(filterStatus as any)}`}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleFilterStatusChange('all' as any)}>Todos</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleFilterStatusChange('passed' as any)}>Aprovado</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleFilterStatusChange('failed' as any)}>Reprovado</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleFilterStatusChange('blocked' as any)}>Bloqueado</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleFilterStatusChange('not_tested' as any)}>Não Testado</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Export Dropdown */}
          {executions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('csv')}>📁 CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('excel')}>📊 Excel</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('json')}>📄 JSON</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleCopy('txt')}>📋 Texto</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleCopy('md')}>📝 Markdown</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={showEditForm} onOpenChange={(open) => {
        setShowEditForm(open);
        const params = new URLSearchParams(searchParams);
        if (open) {
          params.set('modal', 'exec:edit');
          if (selectedExecution) params.set('id', selectedExecution.id);
        } else {
          params.delete('modal');
        }
        setSearchParams(params);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedExecution ? `Editar Execução #${selectedExecution.sequence ?? selectedExecution.id.slice(0, 8)}` : 'Editar Execução'}
            </DialogTitle>
            <DialogDescription>Atualize os dados da execução de teste</DialogDescription>
          </DialogHeader>
          {selectedExecution && (
            <TestExecutionForm
              execution={selectedExecution}
              planId={selectedExecution.plan_id}
              caseId={selectedExecution.case_id}
              onSuccess={handleExecutionUpdated}
              onCancel={() => setShowEditForm(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <div className="flex-1">
        {executions.length === 0 ? (
          <div className="text-center py-12">
            <PlayCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Nenhuma execução encontrada
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Comece executando seus primeiros testes
            </p>
            <StandardButton
              onClick={() => {
                setShowForm(true);
                const params = new URLSearchParams(searchParams);
                params.set('modal', 'exec:new');
                params.delete('id');
                setSearchParams(params);
              }}
            >
              Criar Primeira Execução
            </StandardButton>
          </div>
        ) : viewMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
            {sortedExecutions.length > 0 ? (
              paginatedExecutions.map((execution) => (
                <Card
                  key={execution.id}
                  className="hover:shadow-lg transition-all duration-200 border border-border/50 hover:border-brand/50 h-full flex flex-col cursor-pointer"
                  onClick={() => handleViewDetails(execution)}
                >
                  <CardHeader className="p-4 pb-3 flex-shrink-0">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base line-clamp-2 leading-tight flex items-center gap-2 overflow-hidden min-w-0">
                        <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded flex-shrink-0">
                          {exeLabel(execution)}
                        </span>
                        <span className="truncate">Execução</span>
                        <Badge className={`${executionStatusBadgeClass(execution.status as any)} flex-shrink-0`}>
                          {executionStatusLabel(execution.status as any)}
                        </Badge>
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-hidden">
                      <p className="text-sm">
                        <span className="font-medium">Executado por:</span> {execution.executed_by}
                      </p>
                      {execution.notes && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-4 mb-2">
                          {execution.notes}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2 flex-shrink-0 mt-auto">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Calendar className="h-3 w-3" />
                          {new Date(execution.executed_at).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-full text-sm text-gray-500 px-2">Nenhum resultado encontrado com os filtros atuais.</div>
            )}
          </div>
        ) : (
          // Lista em formato tabela (alinhada a Planos/Casos)
          <div className="space-y-2">
            {sortedExecutions.length > 0 ? (
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                {/* Header da tabela */}
                <div className="grid grid-cols-[80px_80px_1fr_120px_160px_140px_100px] gap-4 px-4 py-3 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <div>ID da Execução</div>
                  <div>ID do Caso</div>
                  <div>Plano de Teste</div>
                  <div>Status</div>
                  <div>Executado por</div>
                  <div>Data da Execução</div>
                  <div>Ações</div>
                </div>
                {/* Linhas */}
                <div className="divide-y divide-border">
                  {paginatedExecutions.map((execution) => (
                    <div
                      key={execution.id}
                      className="grid grid-cols-[80px_80px_1fr_120px_160px_140px_100px] gap-4 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => handleViewDetails(execution)}
                    >
                      {/* ID Execução */}
                      <div className="flex items-center">
                        <span className="text-xs font-mono bg-brand/10 text-brand px-2 py-1 rounded">
                          {exeLabel(execution)}
                        </span>
                      </div>
                      {/* ID Caso */}
                      <div className="flex items-center">
                        <span className="text-xs font-mono bg-brand/10 text-brand px-2 py-1 rounded">{caseLabel(execution.case_id)}</span>
                      </div>
                      {/* Plano de Teste (TAG do plano) */}
                      <div className="flex items-center min-w-0">
                        <span className="text-xs font-mono bg-brand/10 text-brand px-2 py-1 rounded">
                          {planLabel(execution.plan_id)}
                        </span>
                      </div>
                      {/* Status */}
                      <div className="flex items-center">
                        <Badge variant="outline" className={executionStatusBadgeClass(execution.status as any)}>
                          {executionStatusLabel(execution.status as any)}
                        </Badge>
                      </div>
                      {/* Executado por */}
                      <div className="flex items-center text-sm text-muted-foreground truncate">
                        <span className="truncate max-w-[150px]">{execution.executed_by || '—'}</span>
                      </div>
                      {/* Data */}
                      <div className="flex items-center text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(execution.executed_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                      {/* Ações */}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); setSelectedExecution(execution); setShowEditForm(true); }}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); requestDelete(execution.id); }}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive/80"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        {/* Removido o botão de visualizar (Eye) para manter padrão: clique na linha abre detalhes */}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Nenhum resultado encontrado com os filtros atuais.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pagination controls */}
      {sortedExecutions.length > 0 && (
        <div className="flex items-center justify-between gap-3 pt-2">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {(() => {
              const start = (currentPage - 1) * pageSize + 1;
              const end = Math.min(currentPage * pageSize, totalItems);
              return `Mostrando ${start}–${end} de ${totalItems}`;
            })()}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">Itens por página:</label>
            <select
              className="border rounded-md px-2 py-1 bg-background"
              value={pageSize}
              onChange={(e) => {
                const next = parseInt(e.target.value, 10) || 9;
                setPageSize(next);
                setPage(1);
              }}
            >
              <option value={5}>5</option>
              <option value={9}>9</option>
              <option value={12}>12</option>
              <option value={24}>24</option>
            </select>
            <StandardButton
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
            >
              Anterior
            </StandardButton>
            <StandardButton
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
            >
              Próxima
            </StandardButton>
          </div>
        </div>
      )}

      <DetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedExecution(null);
          if (searchParams.get('id')) {
            const params = new URLSearchParams(searchParams);
            params.delete('id');
            setSearchParams(params);
          }
        }}
        item={selectedExecution}
        type="execution"
        onEdit={(item) => {
          // Open edit dialog with selected execution
          setSelectedExecution(item as TestExecution);
          setShowDetailModal(false);
          setShowEditForm(true);
          const params = new URLSearchParams(searchParams);
          params.set('modal', 'exec:edit');
          params.set('id', (item as TestExecution).id);
          setSearchParams(params);
        }}
        onDelete={async (id: string) => {
          try {
            await deleteTestExecution(id);
            setExecutions(prev => prev.filter(ex => ex.id !== id));
            toast({
              title: 'Execução excluída',
              description: 'A execução foi removida com sucesso.'
            });
          } catch (error: unknown) {
            toast({
              title: 'Erro ao excluir',
              description: (error instanceof Error ? error.message : 'Não foi possível excluir a execução.'),
              variant: 'destructive'
            });
          } finally {
            setShowDetailModal(false);
          }
        }}
      />

      {/* Confirm Delete Modal */}
      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir execução?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A execução será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingExecutionId(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={performDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
