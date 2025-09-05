import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plus, Calendar, Eye, Download, PlayCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getTestExecutions, deleteTestExecution } from '@/services/supabaseService';
import { TestExecution } from '@/types';
import { TestExecutionForm } from '@/components/forms/TestExecutionForm';
import { DetailModal } from '@/components/DetailModal';
import { StandardButton } from '@/components/StandardButton';
import { ViewModeToggle } from '@/components/ViewModeToggle';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VirtualList } from '@/components/VirtualList';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { executionStatusBadgeClass, executionStatusLabel } from '@/lib/labels';
import { SearchableCombobox } from '@/components/SearchableCombobox';

export const TestExecutions = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [executions, setExecutions] = useState<TestExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<TestExecution | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [showEditForm, setShowEditForm] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterStatus, setFilterStatus] = useState<'all' | 'passed' | 'failed' | 'blocked' | 'not_tested'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'executed_at' | 'sequence' | 'status'>('executed_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  // Pagination
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(9);

  // Tipagem e guarda para status
  const allowedStatuses = ['all', 'passed', 'failed', 'blocked', 'not_tested'] as const;
  type ExecStatus = typeof allowedStatuses[number];
  const isExecStatus = (s: string): s is ExecStatus => (allowedStatuses as readonly string[]).includes(s);

  useEffect(() => {
    if (user) {
      loadExecutions();
    }
  }, [user]);

  // Abrir modal automaticamente se houver ?id=
  useEffect(() => {
    const id = searchParams.get('id');
    if (!id) return;
    if (executions.length === 0) return;
    const found = executions.find(e => e.id === id);
    if (found) {
      setSelectedExecution(found);
      setShowDetailModal(true);
    }
  }, [executions, searchParams]);

  // Restaurar filtros via URL (?status=&q=)
  useEffect(() => {
    const status = searchParams.get('status');
    const q = searchParams.get('q');
    if (status && isExecStatus(status)) {
      setFilterStatus(status);
    }
    if (q !== null) {
      setSearchTerm(q);
    }
  }, [searchParams]);

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
      const data = await getTestExecutions(user!.id);
      setExecutions(data);
    } catch (error) {
      console.error('Erro ao carregar execuções:', error);
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
    <div className="space-y-0 min-h-screen flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Execuções de Teste</h2>
          <p className="text-gray-600 dark:text-gray-400">Acompanhe suas execuções de teste</p>
        </div>
        <div className="flex gap-2 items-center">
          <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
          <div className="hidden md:flex items-center gap-2">
            <Input
              value={searchTerm}
              onChange={(e) => handleSearchTermChange(e.target.value)}
              placeholder="Buscar por número (#12), executor ou notas"
              className="w-64"
            />
            <SearchableCombobox
              items={[
                { value: 'all', label: 'Todos os status' },
                { value: 'passed', label: 'Aprovado' },
                { value: 'failed', label: 'Reprovado' },
                { value: 'blocked', label: 'Bloqueado' },
                { value: 'not_tested', label: 'Não Testado' },
              ]}
              value={filterStatus}
              onChange={(v) => { if (!v) return; handleFilterStatusChange(v as ExecStatus); }}
              placeholder="Status"
              triggerClassName="w-40"
            />
            <Select value={`${sortBy}:${sortDir}`} onValueChange={handleSortChange}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="executed_at:desc">Data (mais recentes)</SelectItem>
                <SelectItem value="executed_at:asc">Data (mais antigas)</SelectItem>
                <SelectItem value="sequence:desc">Número (maior primeiro)</SelectItem>
                <SelectItem value="sequence:asc">Número (menor primeiro)</SelectItem>
                <SelectItem value="status:asc">Status (A→Z)</SelectItem>
                <SelectItem value="status:desc">Status (Z→A)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {executions.length > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon">
                        <Download className="h-4 w-4" />
                        <span className="sr-only">Exportar</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleExport('csv')}>
                        📁 Exportar CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport('excel')}>
                        📊 Exportar Excel
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport('json')}>
                        📄 Exportar JSON
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleCopy('txt')}>
                        📋 Copiar como Texto
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleCopy('md')}>
                        📝 Copiar como Markdown
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TooltipTrigger>
                <TooltipContent>Exportar</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DialogTrigger asChild>
                    <StandardButton icon={Plus} iconOnly ariaLabel="Nova Execução" />
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent>Nova Execução</TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
        </div>
      </div>

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 items-stretch">
            {sortedExecutions.length > 0 ? (
              paginatedExecutions.map((execution) => (
                <Card key={execution.id} className="hover:shadow-md transition-shadow h-full flex flex-col h-[240px]">
                  <CardHeader className="p-4 pb-3 flex-shrink-0">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base line-clamp-2 leading-tight flex items-center gap-2 overflow-hidden">
                        <span className="text-xs text-gray-500">#{execution.sequence ?? execution.id.slice(0, 8)}</span>
                        Execução
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
                        <StandardButton 
                          variant="outline" 
                          size="sm"
                          icon={Eye}
                          onClick={() => handleViewDetails(execution)}
                        >
                          Ver Detalhes
                        </StandardButton>
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
          <div>
            {sortedExecutions.length > 0 ? (
              <VirtualList
                items={paginatedExecutions}
                itemKey={(execution) => execution.id}
                estimateSize={150}
                overscan={8}
                useWindow
                className="space-y-2"
                renderItem={(execution) => (
                  <Card className="hover:shadow-md transition-shadow h-full flex flex-col h-[140px]">
                    <CardContent className="p-3 flex-1 flex flex-col justify-between text-left overflow-hidden">
                      <div className="flex-1">
                        <div className="flex items-center gap-1 mb-1">
                          <h3 className="text-base leading-tight font-medium flex items-center gap-2 overflow-hidden">
                            <span className="text-xs text-gray-500">#{execution.sequence ?? execution.id.slice(0, 8)}</span>
                            Execução
                            <Badge className={`${executionStatusBadgeClass(execution.status as any)} flex-shrink-0`}>
                              {executionStatusLabel(execution.status as any)}
                            </Badge>
                          </h3>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          <span className="font-medium">Executado por:</span> {execution.executed_by}
                        </p>
                        {execution.notes && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 line-clamp-2">
                            {execution.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Calendar className="h-3 w-3" />
                          {new Date(execution.executed_at).toLocaleDateString('pt-BR')}
                        </div>
                        <StandardButton 
                          variant="outline" 
                          size="sm"
                          compact
                          icon={Eye}
                          onClick={() => handleViewDetails(execution)}
                          className="flex-shrink-0 px-2 py-1 text-xs"
                        >
                          Ver Detalhes
                        </StandardButton>
                      </div>
                    </CardContent>
                  </Card>
                )}
              />
            ) : (
              <div className="text-sm text-gray-500 px-2">Nenhum resultado encontrado com os filtros atuais.</div>
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
    </div>
  );
};
