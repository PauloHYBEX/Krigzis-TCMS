import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Requirement, TestCase } from '@/types';
import {
  getRequirements,
  getRequirementsByProject,
  getTestCases,
  getTestCasesByProject,
  getCasesByRequirement,
  linkRequirementToCase,
  unlinkRequirementFromCase,
  getDefects,
  getDefectsByProject,
} from '@/services/supabaseService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { StandardButton } from '@/components/StandardButton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Link as LinkIcon, Bug as BugIcon, ExternalLink, Cog, Check, X, Search } from 'lucide-react';
import { 
  priorityLabel, 
  priorityBadgeClass, 
  requirementStatusLabel, 
  requirementStatusBadgeClass,
  severityBadgeClass,
  severityLabel,
} from '@/lib/labels';
import { ViewModeToggle } from '@/components/ViewModeToggle';
import { useProject } from '@/contexts/ProjectContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useNavigate } from 'react-router-dom';
import { InfoPill } from '@/components/InfoPill';

export const TraceabilityMatrix = ({ embedded = false, preferredViewMode, onPreferredViewModeChange }: { embedded?: boolean; preferredViewMode?: 'cards'|'list'; onPreferredViewModeChange?: (m: 'cards'|'list') => void; }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { currentProject } = useProject();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [allCases, setAllCases] = useState<TestCase[]>([]);
  const [linkedByReq, setLinkedByReq] = useState<Record<string, string[]>>({});
  const [defectsByReq, setDefectsByReq] = useState<Record<string, { openCount: number; maxSeverity: 'low'|'medium'|'high'|'critical'|null }>>({});
  const [loading, setLoading] = useState(true);
  const [manageReqId, setManageReqId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [availableQuery, setAvailableQuery] = useState('');
  const [linkedQuery, setLinkedQuery] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>(() => {
    if (preferredViewMode) return preferredViewMode;
    const saved = localStorage.getItem('traceability_viewMode');
    return (saved as 'cards' | 'list') || 'list';
  });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (user) {
      bootstrap();
    }
  }, [user, currentProject?.id]);

  useEffect(() => {
    localStorage.setItem('traceability_viewMode', viewMode);
    onPreferredViewModeChange?.(viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (preferredViewMode && preferredViewMode !== viewMode) {
      setViewMode(preferredViewMode);
    }
  }, [preferredViewMode]);

  const bootstrap = async () => {
    try {
      setLoading(true);
      const [reqs, cases, defects] = await Promise.all([
        currentProject?.id ? getRequirementsByProject(user!.id, currentProject.id) : getRequirements(user!.id),
        currentProject?.id ? getTestCasesByProject(user!.id, currentProject.id) : getTestCases(user!.id),
        currentProject?.id ? getDefectsByProject(user!.id, currentProject.id) : getDefects(user!.id),
      ]);
      setRequirements(reqs);
      setAllCases(cases);

      // Carrega vínculos por requisito em paralelo
      const results = await Promise.all(
        reqs.map(r =>
          getCasesByRequirement(user!.id, r.id).then(rCases => ({
            reqId: r.id,
            caseIds: rCases.map(c => c.id)
          }))
        )
      );
      const map: Record<string, string[]> = {};
      for (const res of results) {
        map[res.reqId] = res.caseIds;
      }
      setLinkedByReq(map);

      // Calcular defeitos abertos por requisito (baseado nos cases vinculados)
      const rank: Record<'low'|'medium'|'high'|'critical', number> = { low: 1, medium: 2, high: 3, critical: 4 };
      const dMap: Record<string, { openCount: number; maxSeverity: 'low'|'medium'|'high'|'critical'|null }> = {};
      for (const r of reqs) {
        const caseSet = new Set(map[r.id] || []);
        let openCount = 0;
        let maxSeverity: 'low'|'medium'|'high'|'critical'|null = null;
        for (const d of defects) {
          if (d.case_id && caseSet.has(d.case_id) && d.status !== 'closed') {
            openCount += 1;
            if (!maxSeverity || rank[d.severity as 'low'|'medium'|'high'|'critical'] > rank[maxSeverity]) {
              maxSeverity = d.severity as 'low'|'medium'|'high'|'critical';
            }
          }
        }
        dMap[r.id] = { openCount, maxSeverity };
      }
      setDefectsByReq(dMap);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message || 'Falha ao carregar matriz', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const openManage = (reqId: string) => {
    setManageReqId(reqId);
  };

  const closeManage = () => {
    setManageReqId(null);
  };

  const isLinked = (reqId: string, caseId: string) => {
    return (linkedByReq[reqId] || []).includes(caseId);
  };

  const toggleLink = async (reqId: string, caseId: string) => {
    if (!user) return;
    try {
      setSaving(true);
      if (isLinked(reqId, caseId)) {
        await unlinkRequirementFromCase(reqId, caseId);
        setLinkedByReq(prev => ({
          ...prev,
          [reqId]: (prev[reqId] || []).filter(id => id !== caseId)
        }));
        toast({ title: 'Desvinculado', description: 'Requisito desvinculado do caso.' });
      } else {
        await linkRequirementToCase(reqId, caseId, user.id);
        setLinkedByReq(prev => ({
          ...prev,
          [reqId]: [...(prev[reqId] || []), caseId]
        }));
        toast({ title: 'Vinculado', description: 'Requisito vinculado ao caso.' });
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message || 'Falha ao atualizar vínculo', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const managedRequirement = useMemo(
    () => requirements.find(r => r.id === manageReqId) || null,
    [manageReqId, requirements]
  );

  const filteredRequirements = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return requirements;
    return requirements.filter(r =>
      (r.title || '').toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q) ||
      (r.id || '').toLowerCase().includes(q)
    );
  }, [requirements, searchTerm]);

  const filteredAllCases = useMemo(() => {
    const q = availableQuery.trim().toLowerCase();
    if (!q) return allCases;
    return allCases.filter(c =>
      (c.title || '').toLowerCase().includes(q) ||
      (c.description || '').toLowerCase().includes(q) ||
      String(c.sequence ?? '').toLowerCase().includes(q)
    );
  }, [allCases, availableQuery]);

  const filteredLinkedCases = useMemo(() => {
    if (!managedRequirement) return [] as TestCase[];
    const base = allCases.filter(c => isLinked(managedRequirement.id, c.id));
    const q = linkedQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter(c =>
      (c.title || '').toLowerCase().includes(q) ||
      (c.description || '').toLowerCase().includes(q) ||
      String(c.sequence ?? '').toLowerCase().includes(q)
    );
  }, [allCases, linkedQuery, managedRequirement, linkedByReq]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!embedded && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <LinkIcon className="h-6 w-6" /> Matriz de Rastreabilidade
            </h2>
            <p className="text-gray-600 dark:text-gray-400">Vincule requisitos a casos de teste</p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por ID ou Título"
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {!embedded && (
          <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
        )}
      </div>

      {filteredRequirements.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Nenhum requisito disponível para rastreabilidade.</div>
      ) : (
        <>
          {viewMode === 'cards' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRequirements.map(req => {
                const linkedCount = (linkedByReq[req.id] || []).filter(id => allCases.some(c => c.id === id)).length;
                const dInfo = defectsByReq[req.id] || { openCount: 0, maxSeverity: null };
                return (
                  <Card key={req.id} className="h-full flex flex-col border border-border/50 hover:border-brand/50 hover:shadow-lg transition-all duration-200 overflow-hidden">
                    <CardHeader className="p-4 pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded flex-shrink-0">{`REQ-${(req.id || '').slice(0,4)}`}</span>
                          <CardTitle className="text-base line-clamp-2 leading-tight min-w-0">{req.title}</CardTitle>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 flex flex-col h-full">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex gap-2">
                          <Badge className={priorityBadgeClass(req.priority)}>{priorityLabel(req.priority)}</Badge>
                          <Badge className={requirementStatusBadgeClass(req.status)}>{requirementStatusLabel(req.status)}</Badge>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground mb-2 line-clamp-2">{req.description}</div>
                      <div className="mt-auto flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <InfoPill
                            icon={LinkIcon}
                            value={linkedCount}
                            title="Casos vinculados ao requisito"
                          />
                          <InfoPill
                            icon={BugIcon}
                            value={dInfo.openCount}
                            title={dInfo.openCount > 0 ? `Defeitos abertos • severidade: ${severityLabel(dInfo.maxSeverity!)}` : 'Nenhum defeito aberto para os casos vinculados'}
                            variant={dInfo.openCount > 0 ? 'attention' : 'default'}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          {linkedCount > 0 && (
                            <StandardButton
                              variant="outline"
                              size="sm"
                              icon={ExternalLink}
                              iconOnly
                              ariaLabel="Ver defeitos"
                              onClick={() => {
                                const caseIds = linkedByReq[req.id] || [];
                                if (caseIds.length) {
                                  navigate(`/management?tab=defects&cases=${caseIds.join(',')}`);
                                }
                              }}
                              className="h-8 w-8 rounded-full"
                              title="Ver defeitos deste requisito (filtrados pelos casos vinculados)"
                            />
                          )}
                          {hasPermission('can_manage_cases') && (
                            <StandardButton
                              variant="brand"
                              size="sm"
                              icon={Cog}
                              iconOnly
                              ariaLabel="Gerenciar vínculos"
                              className="h-8 w-8 rounded-full"
                              onClick={() => openManage(req.id)}
                            />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[80px_1fr_120px_120px_220px] items-start gap-4 px-4 py-3 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <div className="pt-px">ID</div>
                <div className="text-center pt-px">Título</div>
                <div className="text-center pt-px">Prioridade</div>
                <div className="text-center pt-px">Status</div>
                <div className="flex justify-end">Vínculos / Ações</div>
              </div>
              {/* Rows */}
              <div className="divide-y divide-border">
              {filteredRequirements.map((req) => {
                const linkedCount = (linkedByReq[req.id] || []).length;
                const dInfo = defectsByReq[req.id] || { openCount: 0, maxSeverity: null };
                return (
                  <div key={req.id} className="grid grid-cols-[80px_1fr_120px_120px_220px] items-start gap-4 px-4 py-3 hover:bg-muted/30 transition-colors min-h-[56px]">
                    <div className="flex items-center"><span className="text-xs font-mono bg-brand/10 text-brand px-2 py-1 rounded">{`REQ-${(req.id || '').slice(0,4)}`}</span></div>
                    <div className="text-sm font-medium leading-tight text-center flex items-center justify-center min-w-0"><span className="truncate">{req.title}</span></div>
                    <div className="flex items-center justify-center"><Badge className={priorityBadgeClass(req.priority)}>{priorityLabel(req.priority)}</Badge></div>
                    <div className="flex items-center justify-center"><Badge className={requirementStatusBadgeClass(req.status)}>{requirementStatusLabel(req.status)}</Badge></div>
                    <div className="flex items-center justify-end gap-2">
                      <InfoPill
                        icon={LinkIcon}
                        value={linkedCount}
                        title="Casos vinculados ao requisito"
                      />
                      <InfoPill
                        icon={BugIcon}
                        value={dInfo.openCount}
                        title={dInfo.openCount > 0 ? `Defeitos abertos • severidade: ${severityLabel(dInfo.maxSeverity!)}` : 'Nenhum defeito aberto para os casos vinculados'}
                        variant={dInfo.openCount > 0 ? 'attention' : 'default'}
                      />
                      {linkedCount > 0 && (
                        <StandardButton
                          variant="outline"
                          size="sm"
                          icon={ExternalLink}
                          iconOnly
                          ariaLabel="Ver defeitos"
                          onClick={() => {
                            const caseIds = linkedByReq[req.id] || [];
                            if (caseIds.length) {
                              navigate(`/management?tab=defects&cases=${caseIds.join(',')}`);
                            }
                          }}
                          className="h-8 w-8 p-0 rounded-full"
                          title="Ver defeitos deste requisito (filtrados pelos casos vinculados)"
                        />
                      )}
                      {hasPermission('can_manage_cases') && (
                        <StandardButton
                          variant="brand"
                          size="sm"
                          icon={Cog}
                          iconOnly
                          ariaLabel="Gerenciar vínculos"
                          onClick={() => openManage(req.id)}
                          className="h-8 w-8 p-0 rounded-full"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={!!manageReqId} onOpenChange={(open) => !open && closeManage()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar vínculos</DialogTitle>
            <DialogDescription>
              {managedRequirement ? `Requisito: ${managedRequirement.title}` : 'Selecione um requisito'}
            </DialogDescription>
          </DialogHeader>
          {managedRequirement && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2">Todos os Casos</h4>
                <div className="mb-2 relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Pesquisar casos..."
                    className="pl-9"
                    value={availableQuery}
                    onChange={(e) => setAvailableQuery(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  {filteredAllCases.map(c => {
                    const linked = isLinked(managedRequirement.id, c.id);
                    return (
                      <div key={c.id} className="flex items-center justify-between p-2 border rounded-md">
                        <div className="text-sm">
                          <div className="font-medium flex items-center gap-2">
                            <span className="text-xs text-gray-500">#{c.sequence ?? c.id.slice(0, 8)}</span>
                            {c.title}
                          </div>
                          <div className="text-gray-500 text-xs line-clamp-1">{c.description}</div>
                        </div>
                        <StandardButton
                          size="sm"
                          variant={linked ? 'secondary' : 'outline'}
                          icon={linked ? X : Check}
                          disabled={saving || !hasPermission('can_manage_cases')}
                          onClick={() => toggleLink(managedRequirement.id, c.id)}
                        >
                          {linked ? 'Desvincular' : 'Vincular'}
                        </StandardButton>
                      </div>
                    );
                  })}
                  {filteredAllCases.length === 0 && (
                    <div className="text-sm text-gray-500 py-2">Nenhum caso encontrado.</div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Casos Vinculados</h4>
                <div className="mb-2 relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Pesquisar vinculados..."
                    className="pl-9"
                    value={linkedQuery}
                    onChange={(e) => setLinkedQuery(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  {filteredLinkedCases
                    .map(c => (
                      <div key={c.id} className="flex items-center justify-between p-2 border rounded-md">
                        <div className="text-sm">
                          <div className="font-medium flex items-center gap-2">
                            <span className="text-xs text-gray-500">#{c.sequence ?? c.id.slice(0, 8)}</span>
                            {c.title}
                          </div>
                          <div className="text-gray-500 text-xs line-clamp-1">{c.description}</div>
                        </div>
                        <StandardButton size="sm" variant="outline" icon={ExternalLink} onClick={() => {
                          window.open(`/cases?id=${c.id}`, '_blank');
                        }}>Ver Caso</StandardButton>
                      </div>
                    ))}
                  {filteredLinkedCases.length === 0 && (
                    <div className="text-sm text-gray-500 py-2">Nenhum caso vinculado encontrado.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TraceabilityMatrix;
