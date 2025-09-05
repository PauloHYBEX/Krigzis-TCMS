import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { usePermissions, UserRole } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, Plus, Edit, Loader2, Search } from 'lucide-react';

// Flag single-tenant: mantém consistência com UserManagement
const SINGLE_TENANT = String((import.meta as any).env?.VITE_SINGLE_TENANT ?? 'true') === 'true';

type Profile = Database['public']['Tables']['profiles']['Row'];

const roleLabels: Record<UserRole, string> = {
  master: 'Master',
  admin: 'Administrador',
  manager: 'Gerente',
  tester: 'Testador',
  viewer: 'Visualizador',
};

export const Profiles: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();

  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | UserRole>('all');

  // Modais (placeholders)
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);

  const fetchProfiles = useCallback(async () => {
    try {
      setLoading(true);

      if (SINGLE_TENANT) {
        const { data: authData } = await supabase.auth.getUser();
        const current = authData?.user;
        if (current) {
          const local: Profile = {
            id: current.id,
            display_name: (current.user_metadata as any)?.full_name || 'Master',
            email: current.email || `user_${current.id.slice(0, 8)}@sistema.local`,
            role: 'master',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            organization_id: null,
          };
          setProfiles([local]);
        } else {
          setProfiles([]);
        }
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, email, role, created_at, updated_at, organization_id')
        .order('display_name');

      if (error) {
        console.error('Erro ao buscar perfis:', error);
        toast({ title: 'Erro', description: 'Não foi possível carregar os perfis.', variant: 'destructive' });
        setProfiles([]);
        return;
      }
      setProfiles((data || []) as Profile[]);
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro', description: 'Falha ao carregar os perfis.', variant: 'destructive' });
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = profiles;
    if (activeTab !== 'all') {
      list = list.filter(p => p.role === activeTab);
    }
    if (!q) return list;
    return list.filter(p =>
      (p.display_name || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q)
    );
  }, [profiles, search, activeTab]);

  const handleOpenCreate = () => {
    if (SINGLE_TENANT) {
      toast({ title: 'Ação indisponível', description: 'Criação de perfis desabilitada no modo single-tenant.' });
      return;
    }
    setOpenCreate(true);
  };

  const handleOpenEdit = (profile: Profile) => {
    if (SINGLE_TENANT) {
      toast({ title: 'Ação indisponível', description: 'Edição de perfis desabilitada no modo single-tenant.' });
      return;
    }
    setEditing(profile);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-8 w-8" />
            Perfis de Usuário
          </h1>
          <p className="text-muted-foreground">Gerencie perfis e papéis de acesso</p>
        </div>
        {hasPermission('can_manage_users') && (
          <Button onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Perfil
          </Button>
        )}
      </div>

      <Card className="h-full flex flex-col">
        <CardHeader className="p-4 pb-3">
          <CardTitle className="text-base">Lista de Perfis</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative w-full max-w-sm">
              <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar por nome ou email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList>
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="master">Masters</TabsTrigger>
              <TabsTrigger value="admin">Administradores</TabsTrigger>
              <TabsTrigger value="manager">Gerentes</TabsTrigger>
              <TabsTrigger value="tester">Testadores</TabsTrigger>
              <TabsTrigger value="viewer">Visualizadores</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="p-0">
              <Card className="h-full flex flex-col">
                <CardContent className="p-0">
                  {loading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      Carregando perfis...
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">Nenhum perfil encontrado</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Papel</TableHead>
                          <TableHead className="w-[100px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>{p.display_name || '—'}</TableCell>
                            <TableCell className="text-muted-foreground">{p.email || '—'}</TableCell>
                            <TableCell>
                              <span className="text-sm font-medium">{roleLabels[(p.role || 'viewer') as UserRole]}</span>
                            </TableCell>
                            <TableCell>
                              {hasPermission('can_manage_users') && (
                                <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(p)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Modal: Criar Perfil (placeholder) */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Perfil</DialogTitle>
            <DialogDescription>
              Placeholder de criação de perfil. Implementação backend não inclusa nesta etapa.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Perfil (placeholder) */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Perfil</DialogTitle>
            <DialogDescription>
              Placeholder de edição de perfil para {editing?.display_name || '—'}. Implementação backend não inclusa nesta etapa.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profiles;
