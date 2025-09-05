import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Requirement, TestCase } from '@/types';
import {
  getRequirements,
  getTestCases,
  getCasesByRequirement,
  linkRequirementToCase,
  unlinkRequirementFromCase,
} from '@/services/supabaseService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { StandardButton } from '@/components/StandardButton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Link as LinkIcon, ExternalLink, Cog, Check, X, Search } from 'lucide-react';
import { 
  priorityLabel, 
  priorityBadgeClass, 
  requirementStatusLabel, 
  requirementStatusBadgeClass 
} from '@/lib/labels';

export const TraceabilityMatrix = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [allCases, setAllCases] = useState<TestCase[]>([]);
  const [linkedByReq, setLinkedByReq] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [manageReqId, setManageReqId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [availableQuery, setAvailableQuery] = useState('');
  const [linkedQuery, setLinkedQuery] = useState('');

  useEffect(() => {
    if (user) {
      bootstrap();
    }
  }, [user]);

  const bootstrap = async () => {
    try {
      setLoading(true);
      const [reqs, cases] = await Promise.all([
        getRequirements(user!.id),
        getTestCases(user!.id),
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <LinkIcon className="h-6 w-6" /> Matriz de Rastreabilidade
          </h2>
          <p className="text-gray-600 dark:text-gray-400">Vincule requisitos a casos de teste</p>
        </div>
      </div>

      {requirements.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Nenhum requisito disponível para rastreabilidade.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {requirements.map(req => {
            const linkedCount = (linkedByReq[req.id] || []).length;
            return (
              <Card key={req.id} className="h-full flex flex-col hover:shadow-md transition-shadow">
                <CardHeader className="p-4 pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    {req.title}
                    <Badge className={priorityBadgeClass(req.priority)}>{priorityLabel(req.priority)}</Badge>
                    <Badge className={requirementStatusBadgeClass(req.status)}>{requirementStatusLabel(req.status)}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                    {req.description}
                  </div>
                  <div className="mt-auto flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      {linkedCount} caso(s) vinculado(s)
                    </div>
                    <StandardButton size="sm" icon={Cog} onClick={() => openManage(req.id)}>
                      Gerenciar Vínculos
                    </StandardButton>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
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
                          disabled={saving}
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
