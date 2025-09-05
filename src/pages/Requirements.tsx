import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Requirement } from '@/types';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  getRequirements,
  createRequirement,
  updateRequirement,
  deleteRequirement
} from '@/services/supabaseService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { StandardButton } from '@/components/StandardButton';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { 
  priorityLabel, 
  priorityBadgeClass, 
  requirementStatusLabel, 
  requirementStatusBadgeClass 
} from '@/lib/labels';
import SearchableCombobox from '@/components/SearchableCombobox';

export const Requirements = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Requirement | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Requirement['priority']>('medium');
  const [status, setStatus] = useState<Requirement['status']>('open');

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  // Deep-link: abre modal de edição quando ?id= estiver presente
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    if (id && requirements.length > 0) {
      const req = requirements.find(r => r.id === id);
      if (req) {
        openEdit(req);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, requirements]);

  const clearIdParam = () => {
    const params = new URLSearchParams(location.search);
    if (params.has('id')) {
      params.delete('id');
      navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    clearIdParam();
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getRequirements(user!.id);
      setRequirements(data);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message || 'Falha ao carregar requisitos', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setDescription('');
    setPriority('medium');
    setStatus('open');
    setShowForm(true);
    // Garantir que o parâmetro id não persista ao criar
    clearIdParam();
  };

  const openEdit = (req: Requirement) => {
    setEditing(req);
    setTitle(req.title);
    setDescription(req.description);
    setPriority(req.priority);
    setStatus(req.status);
    setShowForm(true);
    // Escreve o id na URL para deep-link
    const params = new URLSearchParams(location.search);
    params.set('id', req.id);
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: false });
  };

  const submit = async () => {
    try {
      if (!user) return;
      if (editing) {
        const updated = await updateRequirement(editing.id, { title, description, priority, status });
        setRequirements(prev => prev.map(r => r.id === updated.id ? updated : r));
        toast({ title: 'Atualizado', description: 'Requisito atualizado com sucesso.' });
      } else {
        const created = await createRequirement({ user_id: user.id, title, description, priority, status } as any);
        setRequirements(prev => [created, ...prev]);
        toast({ title: 'Criado', description: 'Requisito criado com sucesso.' });
      }
      closeForm();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message || 'Falha ao salvar requisito', variant: 'destructive' });
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteRequirement(id);
      setRequirements(prev => prev.filter(r => r.id !== id));
      toast({ title: 'Excluído', description: 'Requisito excluído.' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message || 'Falha ao excluir', variant: 'destructive' });
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Requisitos</h2>
          <p className="text-gray-600 dark:text-gray-400">Gerencie seus requisitos e vínculos com casos</p>
        </div>
        <Dialog open={showForm} onOpenChange={(open) => {
          setShowForm(open);
          if (!open) {
            closeForm();
          }
        }}>
          <DialogTrigger asChild>
            <StandardButton icon={Plus} onClick={openCreate}>Novo Requisito</StandardButton>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Requisito' : 'Novo Requisito'}</DialogTitle>
              <DialogDescription>Preencha os campos obrigatórios.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1">Título</label>
                <input className="w-full rounded-md border p-2 bg-background" value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm mb-1">Descrição</label>
                <textarea className="w-full rounded-md border p-2 bg-background" rows={4} value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1">Prioridade</label>
                  <SearchableCombobox
                    items={[
                      { value: 'low', label: 'Baixa' },
                      { value: 'medium', label: 'Média' },
                      { value: 'high', label: 'Alta' },
                      { value: 'critical', label: 'Crítica' },
                    ]}
                    value={priority}
                    onChange={(value) => { if (value) setPriority(value as Requirement['priority']); }}
                    placeholder="Selecione a prioridade"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Status</label>
                  <SearchableCombobox
                    items={[
                      { value: 'open', label: 'Aberto' },
                      { value: 'in_progress', label: 'Em andamento' },
                      { value: 'approved', label: 'Aprovado' },
                      { value: 'deprecated', label: 'Obsoleto' },
                    ]}
                    value={status}
                    onChange={(value) => { if (value) setStatus(value as Requirement['status']); }}
                    placeholder="Selecione o status"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <StandardButton variant="outline" onClick={closeForm}>Cancelar</StandardButton>
                <StandardButton onClick={submit}>{editing ? 'Salvar' : 'Criar'}</StandardButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {requirements.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Nenhum requisito cadastrado.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {requirements.map(req => (
            <Card key={req.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  {req.title}
                  <Badge className={priorityBadgeClass(req.priority)}>{priorityLabel(req.priority)}</Badge>
                  <Badge className={requirementStatusBadgeClass(req.status)}>{requirementStatusLabel(req.status)}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 mb-3">{req.description}</p>
                <div className="flex gap-2">
                  <StandardButton size="sm" variant="outline" icon={Pencil} onClick={() => openEdit(req)}>Editar</StandardButton>
                  <StandardButton size="sm" variant="outline" icon={Trash2} onClick={() => remove(req.id)}>Excluir</StandardButton>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Requirements;
