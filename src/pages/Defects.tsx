import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Defect } from '@/types';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  getDefects,
  createDefect,
  updateDefect,
  deleteDefect,
} from '@/services/supabaseService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { StandardButton } from '@/components/StandardButton';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Bug as BugIcon } from 'lucide-react';
import { 
  severityLabel, 
  severityBadgeClass, 
  defectStatusLabel, 
  defectStatusBadgeClass 
} from '@/lib/labels';
import SearchableCombobox from '@/components/SearchableCombobox';

export const Defects = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [defects, setDefects] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Defect | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<Defect['severity']>('medium');
  const [status, setStatus] = useState<Defect['status']>('open');

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  // Deep-link: abrir modal ao detectar ?id=
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    if (id && defects.length > 0) {
      const d = defects.find(x => x.id === id);
      if (d) openEdit(d);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, defects]);

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
      const data = await getDefects(user!.id);
      setDefects(data);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message || 'Falha ao carregar defeitos', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setDescription('');
    setSeverity('medium');
    setStatus('open');
    setShowForm(true);
    clearIdParam();
  };

  const openEdit = (d: Defect) => {
    setEditing(d);
    setTitle(d.title);
    setDescription(d.description);
    setSeverity(d.severity);
    setStatus(d.status);
    setShowForm(true);
    const params = new URLSearchParams(location.search);
    params.set('id', d.id);
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: false });
  };

  const submit = async () => {
    try {
      if (!user) return;
      if (editing) {
        const updated = await updateDefect(editing.id, { title, description, severity, status });
        setDefects(prev => prev.map(r => r.id === updated.id ? updated : r));
        toast({ title: 'Atualizado', description: 'Defeito atualizado com sucesso.' });
      } else {
        const created = await createDefect({ user_id: user.id, title, description, severity, status } as any);
        setDefects(prev => [created, ...prev]);
        toast({ title: 'Criado', description: 'Defeito criado com sucesso.' });
      }
      closeForm();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message || 'Falha ao salvar defeito', variant: 'destructive' });
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteDefect(id);
      setDefects(prev => prev.filter(r => r.id !== id));
      toast({ title: 'Excluído', description: 'Defeito excluído.' });
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
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BugIcon className="h-6 w-6" /> Defeitos
          </h2>
          <p className="text-gray-600 dark:text-gray-400">Gerencie seus defeitos/incidentes</p>
        </div>
        <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) closeForm(); }}>
          <DialogTrigger asChild>
            <StandardButton icon={Plus} onClick={openCreate}>Novo Defeito</StandardButton>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Defeito' : 'Novo Defeito'}</DialogTitle>
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
                  <label className="block text-sm mb-1">Severidade</label>
                  <SearchableCombobox
                    items={[
                      { value: 'low', label: 'Baixa' },
                      { value: 'medium', label: 'Média' },
                      { value: 'high', label: 'Alta' },
                      { value: 'critical', label: 'Crítica' },
                    ]}
                    value={severity}
                    onChange={(value) => { if (value) setSeverity(value as Defect['severity']); }}
                    placeholder="Selecione a severidade"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Status</label>
                  <SearchableCombobox
                    items={[
                      { value: 'open', label: 'Aberto' },
                      { value: 'in_analysis', label: 'Em análise' },
                      { value: 'fixed', label: 'Corrigido' },
                      { value: 'validated', label: 'Validado' },
                      { value: 'closed', label: 'Fechado' },
                    ]}
                    value={status}
                    onChange={(value) => { if (value) setStatus(value as Defect['status']); }}
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

      {defects.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Nenhum defeito cadastrado.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {defects.map(d => (
            <Card key={d.id} className="h-full flex flex-col hover:shadow-md transition-shadow">
              <CardHeader className="p-4 pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {d.title}
                  <Badge className={severityBadgeClass(d.severity)}>{severityLabel(d.severity)}</Badge>
                  <Badge className={defectStatusBadgeClass(d.status)}>{defectStatusLabel(d.status)}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">{d.description}</p>
                <div className="mt-auto flex items-center justify-between">
                  <div className="text-xs text-gray-500">#{d.id.slice(0, 8)}</div>
                  <div className="flex gap-2">
                    <StandardButton size="sm" variant="outline" icon={Pencil} onClick={() => openEdit(d)}>Editar</StandardButton>
                    <StandardButton size="sm" variant="outline" icon={Trash2} onClick={() => remove(d.id)}>Excluir</StandardButton>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Defects;
