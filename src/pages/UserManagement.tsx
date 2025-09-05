import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions, UserRole } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { UserCog, Shield, Users, Loader2, Search, UserPlus, Trash2, ChevronDown, ChevronUp, Sparkles, FileText, ClipboardCheck, Play, BarChart3, Download, Eye, Home, Clock, Zap, Settings, CheckCircle, Crown } from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { PermissionGuard } from '@/components/PermissionGuard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Single-tenant flag: when true, bypass remote permissions/profiles and operate locally as master
// Default to true if env is missing (safer default for uso particular)
const SINGLE_TENANT = String((import.meta as any).env?.VITE_SINGLE_TENANT ?? 'true') === 'true';

interface UserData extends User {
  profile?: {
    display_name: string | null;
    role: UserRole;
    organization_id: string | null;
  };
  permissions?: {
    can_manage_users: boolean;
    can_manage_plans: boolean;
    can_manage_cases: boolean;
    can_manage_executions: boolean;
    can_view_reports: boolean;
    can_use_ai: boolean;
    can_access_model_control: boolean;
    can_configure_ai_models: boolean;
    can_test_ai_connections: boolean;
    can_manage_ai_templates: boolean;
    can_select_ai_models: boolean;
  };
}

const roleLabels = {
  master: 'Master',
  admin: 'Administrador',
  manager: 'Gerente',
  tester: 'Testador',
  viewer: 'Visualizador'
};

const roleColors = {
  master: 'bg-purple-100 text-purple-800 border-purple-300',
  admin: 'bg-red-100 text-red-800 border-red-300',
  manager: 'bg-blue-100 text-blue-800 border-blue-300',
  tester: 'bg-green-100 text-green-800 border-green-300',
  viewer: 'bg-gray-100 text-gray-800 border-gray-300'
};

export const UserManagement = () => {
  const { role, isMaster, updateUserToMaster, getDefaultPermissions } = usePermissions();
  const { user } = useAuth();
  const { toast } = useToast();
  const [hasError, setHasError] = useState(false);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserData | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('viewer');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [fixingMaster, setFixingMaster] = useState(false);
  
  // Recovery link modal state
  const [recoveryLink, setRecoveryLink] = useState<string | null>(null);
  const [recoveryLinkType, setRecoveryLinkType] = useState<'recovery' | 'magiclink' | null>(null);
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);
  
  // Helpers para o modal de link gerado (fora da interface)
  const handleCopyRecoveryLink = async () => {
    if (!recoveryLink) return;
    try {
      await navigator.clipboard.writeText(recoveryLink);
      toast({ title: 'Link copiado', description: 'O link foi copiado para a área de transferência.' });
    } catch {
      toast({ title: 'Falha ao copiar', description: 'Não foi possível copiar automaticamente. Selecione e copie manualmente.' });
    }
  };

  const handleOpenRecoveryLink = () => {
    if (recoveryLink) window.open(recoveryLink, '_blank', 'noopener,noreferrer');
  };
  
  // Form state for editing user
  const [editForm, setEditForm] = useState({
    role: 'viewer' as UserRole,
    display_name: '',
    can_manage_users: false,
    can_manage_plans: false,
    can_manage_cases: false,
    can_manage_executions: false,
    can_view_reports: false,
    can_use_ai: false,
    can_access_model_control: false,
    can_configure_ai_models: false,
    can_test_ai_connections: false,
    can_manage_ai_templates: false,
    can_select_ai_models: false,
  });

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      
      if (SINGLE_TENANT) {
        // No modo single-tenant, não buscamos no banco. Montamos um usuário local master.
        const { data: authData } = await supabase.auth.getUser();
        const current = authData?.user;
        if (current) {
          const masterPerms = getDefaultPermissions('master');
          const localUser: UserData = {
            id: current.id,
            email: current.email || `user_${current.id.slice(0, 8)}@sistema.local`,
            app_metadata: current.app_metadata as any,
            user_metadata: current.user_metadata as any,
            aud: 'authenticated',
            created_at: current.created_at as any,
            profile: {
              display_name: (current.user_metadata as any)?.full_name || 'Master',
              role: 'master',
              organization_id: null
            },
            permissions: masterPerms
          };
          setUsers([localUser]);
        } else {
          setUsers([]);
        }
        return;
      }
      
      // Modo multi-tenant (padrão antigo): buscar perfis e permissões
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, role')
        .order('display_name');
      
      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        setUsers([]);
        return;
      }
      
      const usersWithDetails = await Promise.all(
        profiles.map(async (profile) => {
          const { data: permissionsData } = await supabase
            .from('user_permissions')
            .select('can_manage_users, can_manage_plans, can_manage_cases, can_manage_executions, can_view_reports, can_use_ai, can_access_model_control, can_configure_ai_models, can_test_ai_connections, can_manage_ai_templates, can_select_ai_models')
            .eq('user_id', profile.id)
            .single();
            
          return {
            id: profile.id,
            email: `user_${profile.id.slice(0, 8)}@sistema.local`,
            profile: {
              display_name: profile.display_name,
              role: profile.role as UserRole,
              organization_id: (profile as any).organization_id || null
            },
            permissions: permissionsData || {
              can_manage_users: false,
              can_manage_plans: true,
              can_manage_cases: true,
              can_manage_executions: true,
              can_view_reports: true,
              can_use_ai: true,
              can_access_model_control: false,
              can_configure_ai_models: false,
              can_test_ai_connections: false,
              can_manage_ai_templates: false,
              can_select_ai_models: true,
            }
          } as UserData;
        })
      );
      
      setUsers(usersWithDetails);
    } catch (error) {
      console.error('Error fetching users:', error);
      setHasError(true);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os usuários. Funcionalidade limitada disponível.',
        variant: 'destructive'
      });
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [toast, getDefaultPermissions]);

  // Load users
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleEditUser = (user: UserData) => {
    setSelectedUser(user);
    setEditForm({
      role: user.profile?.role || 'tester',
      display_name: user.profile?.display_name || '',
      can_manage_users: user.permissions?.can_manage_users || false,
      can_manage_plans: user.permissions?.can_manage_plans || true,
      can_manage_cases: user.permissions?.can_manage_cases || true,
      can_manage_executions: user.permissions?.can_manage_executions || true,
      can_view_reports: user.permissions?.can_view_reports || true,
      can_use_ai: user.permissions?.can_use_ai || true,
      can_access_model_control: user.permissions?.can_access_model_control || false,
      can_configure_ai_models: user.permissions?.can_configure_ai_models || false,
      can_test_ai_connections: user.permissions?.can_test_ai_connections || false,
      can_manage_ai_templates: user.permissions?.can_manage_ai_templates || false,
      can_select_ai_models: user.permissions?.can_select_ai_models || true,
    });
    setIsEditModalOpen(true);
  };

  // Restaurar usuário atual como master (local)
  const handleFixUserToMaster = async () => {
    try {
      setFixingMaster(true);
      if (!user?.id) {
        toast({ title: 'Usuário não autenticado', variant: 'destructive' });
        return;
      }
      await updateUserToMaster(user.id);
      toast({ title: 'Permissões atualizadas', description: 'Seu usuário foi restaurado como Master.' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Falha ao restaurar Master', variant: 'destructive' });
    } finally {
      setFixingMaster(false);
    }
  };

  // Envio de convite (desabilitado no single-tenant)
  const handleInviteUser = async () => {
    if (SINGLE_TENANT) {
      toast({ title: 'Convites desabilitados', description: 'Modo single-tenant: convites estão desativados.' });
      return;
    }
    if (role !== 'master') {
      toast({ title: 'Acesso negado', description: 'Apenas usuários Master podem convidar.', variant: 'destructive' });
      return;
    }
    if (!inviteEmail || !inviteEmail.includes('@')) {
      toast({ title: 'Email inválido', description: 'Informe um email válido.', variant: 'destructive' });
      return;
    }
    try {
      setInviteLoading(true);
      const orgId = users.find(u => u.id === user?.id)?.profile?.organization_id || null;
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { email: inviteEmail, role: inviteRole, organization_id: orgId },
        headers: { 'X-Debug': (import.meta as any).env?.DEV ? '1' : '0' }
      });
      if (error) {
        console.error('invite-user error:', error);
        toast({ title: 'Falha ao enviar convite', description: (error as any)?.message || 'Erro desconhecido.', variant: 'destructive' });
        return;
      }
      if ((data as any)?.email_sent_via === 'password_reset') {
        // Email enviado para usuário já existente
        toast({ title: 'E-mail enviado', description: 'Usuário já existia. Enviamos um e-mail de recuperação de senha.' });
      } else if ((data as any)?.success) {
        // Convite padrão enviado por e-mail
        toast({ title: 'Convite enviado', description: 'Usuário convidado com sucesso (papel inicial viewer).' });
      } else if ((data as any)?.recovery_link) {
        // Não exibir links na UI por segurança; orientar ajuste de configuração
        console.warn('invite-user fallback link (não exibido). Ajuste Auth → URL Configuration (site_url e Redirect URLs).');
        toast({ title: 'Ação necessária', description: 'Atualize Auth → URL Configuration (site_url e Redirect URLs) para permitir envio de e-mails. Não exibimos links na tela.', variant: 'destructive' });
      } else if ((data as any)?.success === false) {
        // Modo debug da Edge Function retornou sucesso=false com detalhes
        console.error('invite-user debug_info:', (data as any)?.debug_info);
        toast({ title: 'Falha ao enviar convite', description: (data as any)?.error || 'Erro desconhecido.', variant: 'destructive' });
      } else {
        toast({ title: 'Aviso', description: 'Resposta inesperada do servidor. Verifique os logs.', variant: 'destructive' });
      }
      setIsInviteModalOpen(false);
      setInviteEmail('');
      setInviteRole('viewer');
      await fetchUsers();
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Erro', description: e?.message || 'Não foi possível enviar o convite.', variant: 'destructive' });
    } finally {
      setInviteLoading(false);
    }
  };

  // Pode gerenciar conforme papel atual
  const canManageUser = (targetRole: string) => {
    // Em single-tenant, Master sempre pode
    if (SINGLE_TENANT) return true;
    // Política: apenas MASTER pode gerenciar (admin não altera)
    return role === 'master';
  };

  // Expand/collapse
  const toggleUserExpand = (id: string) => {
    setExpandedUser(prev => (prev === id ? null : id));
  };

  // Alterar papel de usuário
  const handleRoleChange = async (id: string, newRole: string) => {
    if (SINGLE_TENANT) {
      if (newRole !== 'master') {
        toast({ title: 'Papel fixo', description: 'No modo single-tenant o papel é sempre Master.' });
      }
      // Mantém como master no estado local
      setUsers(prev => prev.map(u => (u.id === id ? {
        ...u,
        profile: { display_name: u.profile?.display_name || '', role: 'master' as UserRole },
        permissions: getDefaultPermissions('master')
      } : u)));
      return;
    }
    // Multi-tenant: apenas master pode alterar
    if (role !== 'master') {
      toast({ title: 'Acesso negado', description: 'Apenas usuários Master podem alterar papéis.' , variant: 'destructive'});
      return;
    }
    try {
      const target = users.find(u => u.id === id);
      const { error } = await supabase.rpc('set_user_role', {
        target_user_id: id,
        target_role: newRole,
        target_org_id: null
      } as any);
      if (error) {
        console.error('RPC set_user_role error:', error);
        toast({ title: 'Falha ao alterar papel', description: error.message || 'Erro desconhecido.', variant: 'destructive' });
        return;
      }
      // Atualiza estado local
      setUsers(prev => prev.map(u => (u.id === id ? {
        ...u,
        profile: { ...(u.profile as any), role: newRole as UserRole }
      } : u)));
      toast({ title: 'Papel atualizado', description: 'O papel do usuário foi atualizado com sucesso.' });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Erro', description: e?.message || 'Não foi possível alterar o papel.', variant: 'destructive' });
    }
  };

  // Alterar permissão de usuário
  const handlePermissionChange = async (id: string, permission: string, value: boolean) => {
    if (SINGLE_TENANT) {
      setUsers(prev => prev.map(u => (u.id === id ? {
        ...u,
        permissions: { ...u.permissions, [permission]: value } as UserData['permissions']
      } : u)));
      if (selectedUser?.id === id) {
        setEditForm(prev => ({ ...prev, [permission]: value }));
      }
      return;
    }
    // Multi-tenant: apenas master pode alterar
    if (role !== 'master') {
      toast({ title: 'Acesso negado', description: 'Apenas usuários Master podem alterar permissões.' , variant: 'destructive'});
      return;
    }
    try {
      const target = users.find(u => u.id === id);
      const currentPerms = {
        can_manage_users: !!target?.permissions?.can_manage_users,
        can_manage_plans: target?.permissions?.can_manage_plans ?? true,
        can_manage_cases: target?.permissions?.can_manage_cases ?? true,
        can_manage_executions: target?.permissions?.can_manage_executions ?? true,
        can_view_reports: target?.permissions?.can_view_reports ?? true,
        can_use_ai: target?.permissions?.can_use_ai ?? true,
        can_access_model_control: !!target?.permissions?.can_access_model_control,
        can_configure_ai_models: !!target?.permissions?.can_configure_ai_models,
        can_test_ai_connections: !!target?.permissions?.can_test_ai_connections,
        can_manage_ai_templates: !!target?.permissions?.can_manage_ai_templates,
        can_select_ai_models: target?.permissions?.can_select_ai_models ?? true,
      } as Record<string, boolean>;
      // aplica alteração solicitada
      currentPerms[permission] = value;

      const { error } = await supabase.rpc('set_user_permissions', {
        target_user_id: id,
        perms: currentPerms
      } as any);
      if (error) {
        console.error('RPC set_user_permissions error:', error);
        toast({ title: 'Falha ao alterar permissão', description: error.message || 'Erro desconhecido.', variant: 'destructive' });
        return;
      }
      // Atualiza estado local
      setUsers(prev => prev.map(u => (u.id === id ? {
        ...u,
        permissions: { ...u.permissions, [permission]: value } as UserData['permissions']
      } : u)));
      if (selectedUser?.id === id) {
        setEditForm(prev => ({ ...prev, [permission]: value }));
      }
      toast({ title: 'Permissão atualizada', description: 'As permissões do usuário foram atualizadas.' });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Erro', description: e?.message || 'Não foi possível alterar a permissão.', variant: 'destructive' });
    }
  };

  // Abrir modal de deleção
  const handleDeleteUser = (user: UserData) => {
    setUserToDelete(user);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    if (SINGLE_TENANT) {
      toast({ title: 'Ação desabilitada', description: 'Não é possível remover usuários no modo single-tenant.' });
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
      return;
    }
    // Multi-tenant: apenas Master e via Edge Function
    if (role !== 'master') {
      toast({ title: 'Acesso negado', description: 'Apenas usuários Master podem remover usuários.', variant: 'destructive' });
      return;
    }
    try {
      setDeleteLoading(true);
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { user_id: userToDelete.id }
      });
      if (error) {
        console.error('delete-user error:', error);
        toast({ title: 'Falha ao remover usuário', description: (error as any)?.message || 'Erro desconhecido.', variant: 'destructive' });
        return;
      }
      toast({ title: 'Usuário removido', description: 'O usuário foi removido com sucesso.' });
      await fetchUsers();
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Erro', description: e?.message || 'Não foi possível remover o usuário.', variant: 'destructive' });
    } finally {
      setDeleteLoading(false);
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
    }
  };

  // Lista filtrada por busca
  const filteredUsers = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      (u.email || '').toLowerCase().includes(q) ||
      (u.profile?.display_name || '').toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  // Se ocorreu erro ao carregar usuários, mostra mensagem amigável
  if (hasError) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Erro no Sistema</h2>
          <p className="mb-4">Houve um problema ao carregar o gerenciamento de usuários.</p>
          <Button onClick={() => window.location.reload()}>
            Recarregar Página
          </Button>
        </div>
      </div>
    );
  }

  // Se ainda está carregando as permissões, mostra loading
  if (!role) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Verificando permissões...</span>
        </div>
      </div>
    );
  }

  // Se não tem permissão, redireciona
  if (role !== 'master' && role !== 'admin') {
    return (
      <PermissionGuard requiredPermission="can_manage_users">
        <div className="container mx-auto py-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
            <p>Você precisa de permissão para acessar esta página</p>
          </div>
        </div>
      </PermissionGuard>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-8 w-8" />
            Gerenciamento de Usuários
          </h1>
          <p className="text-muted-foreground">
            Gerencie os usuários do sistema e suas permissões
          </p>
        </div>
        
        <div className="flex gap-2">
          {/* Botão para corrigir usuário master (apenas em SINGLE_TENANT) */}
          {SINGLE_TENANT && role !== 'master' && (
            <Button 
              variant="outline" 
              onClick={handleFixUserToMaster}
              disabled={fixingMaster}
              className="border-purple-200 text-purple-700 hover:bg-purple-50"
            >
              {fixingMaster ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Corrigindo...
                </>
              ) : (
                <>
                  <Crown className="h-4 w-4 mr-2" />
                  Restaurar Master
                </>
              )}
            </Button>
          )}
          
          {/* Convite de usuário: apenas para Master e fora do SINGLE_TENANT */}
          {!SINGLE_TENANT && role === 'master' && (
          <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Convidar Usuário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Convidar Novo Usuário</DialogTitle>
                <DialogDescription>
                  Envie um convite para um novo usuário se juntar ao sistema
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    placeholder="email@exemplo.com" 
                    value={inviteEmail} 
                    onChange={(e) => setInviteEmail(e.target.value)} 
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="role">Nível de Acesso</Label>
                  <Select value={inviteRole} onValueChange={(value: UserRole) => setInviteRole(value)}>
                    <SelectTrigger id="role">
                      <SelectValue placeholder="Selecione o nível" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Master pode convidar já como admin; outros papéis não veem essa opção */}
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="manager">Gerente</SelectItem>
                      <SelectItem value="tester">Testador</SelectItem>
                      <SelectItem value="viewer">Visualizador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button 
                  className="w-full" 
                  onClick={handleInviteUser}
                  disabled={inviteLoading}
                >
                  {inviteLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar Convite'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </div>
      
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Todos os Usuários</TabsTrigger>
          <TabsTrigger value="master">Masters</TabsTrigger>
          <TabsTrigger value="admin">Administradores</TabsTrigger>
          <TabsTrigger value="manager">Gerentes</TabsTrigger>
          <TabsTrigger value="tester">Testadores</TabsTrigger>
          <TabsTrigger value="viewer">Visualizadores</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="p-0">
          <UserTable 
            users={filteredUsers} 
            loading={loading} 
            expandedUser={expandedUser}
            canManageUser={canManageUser}
            toggleUserExpand={toggleUserExpand}
            handleRoleChange={handleRoleChange}
            handlePermissionChange={handlePermissionChange}
            handleDeleteUser={handleDeleteUser}
            isMaster={isMaster()}
          />
        </TabsContent>
        
        {['master', 'admin', 'manager', 'tester', 'viewer'].map(roleFilter => (
          <TabsContent key={roleFilter} value={roleFilter} className="p-0">
            <UserTable 
              users={filteredUsers.filter(u => u.profile?.role === roleFilter)} 
              loading={loading} 
              expandedUser={expandedUser}
              canManageUser={canManageUser}
              toggleUserExpand={toggleUserExpand}
              handleRoleChange={handleRoleChange}
              handlePermissionChange={handlePermissionChange}
              handleDeleteUser={handleDeleteUser}
              isMaster={isMaster()}
            />
          </TabsContent>
        ))}
      </Tabs>
      
      {/* Modal de link de recuperação/magic link */}
      <Dialog open={isRecoveryModalOpen} onOpenChange={setIsRecoveryModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link de acesso gerado ({recoveryLinkType === 'magiclink' ? 'Magic Link' : 'Recuperação'})</DialogTitle>
            <DialogDescription>
              O Supabase não envia e-mail para este link de fallback. Copie e compartilhe com o usuário.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>URL</Label>
            <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded break-all text-sm">
              {recoveryLink}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCopyRecoveryLink}>Copiar</Button>
              <Button variant="outline" onClick={handleOpenRecoveryLink}>Abrir</Button>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Fechar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmação para deleção de usuário */}
      <AlertDialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Remoção de Usuário</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Você tem certeza que deseja remover o usuário:</p>
              <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                <p className="font-medium">{userToDelete?.profile?.display_name || 'Usuário'}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{userToDelete?.email}</p>
                <p className="text-sm text-red-600 dark:text-red-400">
                  Nível: {userToDelete?.profile?.role ? roleLabels[userToDelete.profile.role] : 'Não definido'}
                </p>
              </div>
              <p className="text-red-600 dark:text-red-400 font-medium">
                Esta ação é irreversível e removerá permanentemente:
              </p>
              <ul className="text-sm text-red-600 dark:text-red-400 space-y-1 ml-4">
                <li>• O acesso do usuário ao sistema</li>
                <li>• Todas as permissões e configurações</li>
                <li>• Dados do perfil do usuário</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteUser}
              disabled={deleteLoading}
            >
              {deleteLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removendo...
                </>
              ) : (
                'Remover'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const UserTable = ({ 
  users, 
  loading, 
  expandedUser, 
  canManageUser,
  toggleUserExpand, 
  handleRoleChange, 
  handlePermissionChange,
  handleDeleteUser,
  isMaster
}: { 
  users: UserData[], 
  loading: boolean, 
  expandedUser: string | null,
  canManageUser: (role: string) => boolean,
  toggleUserExpand: (id: string) => void, 
  handleRoleChange: (id: string, role: string) => void, 
  handlePermissionChange: (id: string, permission: string, value: boolean) => void,
  handleDeleteUser: (user: UserData) => void,
  isMaster: boolean
}) => {
  
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando usuários...</div>
        </CardContent>
      </Card>
    );
  }
  
  if (users.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Nenhum usuário encontrado</div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Nível de Acesso</TableHead>
              <TableHead>Permissões</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.reduce<React.ReactNode[]>((acc, user) => {
              acc.push(
                
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-medium">
                        {user.profile?.display_name ? user.profile.display_name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium">{user.profile?.display_name || 'Usuário'}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {canManageUser(user.profile?.role || 'tester') ? (
                      <Select 
                        value={user.profile?.role || 'tester'} 
                        onValueChange={(value) => handleRoleChange(user.id, value)}
                      >
                        <SelectTrigger className={`w-[180px] ${roleColors[user.profile?.role || 'tester']} border`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {user.profile?.role === 'master' && (
                            <SelectItem value="master">Master</SelectItem>
                          )}
                          <SelectItem value="admin">Administrador</SelectItem>
                          <SelectItem value="manager">Gerente</SelectItem>
                          <SelectItem value="tester">Testador</SelectItem>
                          <SelectItem value="viewer">Visualizador</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className={`px-3 py-1 rounded text-sm font-medium inline-block ${roleColors[user.profile?.role || 'tester']}`}>
                        {roleLabels[user.profile?.role || 'tester']}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {user.permissions?.can_manage_users && (
                        <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                          Gerenciar Usuários
                        </div>
                      )}
                      {user.permissions?.can_manage_plans && (
                        <div className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded">
                          Planos
                        </div>
                      )}
                      {user.permissions?.can_use_ai && (
                        <div className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">
                          IA
                        </div>
                      )}
                      {user.permissions?.can_view_reports && (
                        <div className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded">
                          Relatórios
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => toggleUserExpand(user.id)}
                      >
                        {expandedUser === user.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                      
                      {/* Botão de apagar disponível apenas para usuários master */}
                      {isMaster && user.profile?.role !== 'master' && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDeleteUser(user)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="Remover usuário (apenas Master)"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
              if (expandedUser === user.id) {
                acc.push(
                  <TableRow key={user.id + '-expanded'}>
                    <TableCell colSpan={4} className="bg-gray-50 dark:bg-gray-900/20">
                      <div className="p-4 space-y-6">
                        <h4 className="font-medium flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Permissões do Usuário
                        </h4>
                        
                        <div className="space-y-4">
                          {/* Seção: Administração do Sistema */}
                          <div className="border rounded-lg">
                            <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-3 rounded-t-lg">
                              <h5 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                <Shield className="h-4 w-4 text-blue-500" />
                                Administração do Sistema
                              </h5>
                            </div>
                            <div className="p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <UserCog className="h-4 w-4 text-blue-500" />
                                  <Label>Gerenciar Usuários</Label>
                                </div>
                                <Switch 
                                  checked={user.permissions?.can_manage_users}
                                  onCheckedChange={(checked) => handlePermissionChange(user.id, 'can_manage_users', checked)}
                                  disabled={!canManageUser(user.profile?.role || 'tester')}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Seção: Gerenciamento de Testes */}
                          <div className="border rounded-lg">
                            <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-3 rounded-t-lg">
                              <h5 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                <ClipboardCheck className="h-4 w-4 text-green-500" />
                                Gerenciamento de Testes
                              </h5>
                            </div>
                            <div className="p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-emerald-500" />
                                  <Label>Gerenciar Planos de Teste</Label>
                                </div>
                                <Switch 
                                  checked={user.permissions?.can_manage_plans}
                                  onCheckedChange={(checked) => handlePermissionChange(user.id, 'can_manage_plans', checked)}
                                  disabled={!canManageUser(user.profile?.role || 'tester')}
                                />
                              </div>
                              
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <ClipboardCheck className="h-4 w-4 text-green-500" />
                                  <Label>Gerenciar Casos de Teste</Label>
                                </div>
                                <Switch 
                                  checked={user.permissions?.can_manage_cases}
                                  onCheckedChange={(checked) => handlePermissionChange(user.id, 'can_manage_cases', checked)}
                                  disabled={!canManageUser(user.profile?.role || 'tester')}
                                />
                              </div>
                              
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Play className="h-4 w-4 text-indigo-500" />
                                  <Label>Gerenciar Execuções de Teste</Label>
                                </div>
                                <Switch 
                                  checked={user.permissions?.can_manage_executions}
                                  onCheckedChange={(checked) => handlePermissionChange(user.id, 'can_manage_executions', checked)}
                                  disabled={!canManageUser(user.profile?.role || 'tester')}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Seção: Geração de Testes com IA */}
                          <div className="border rounded-lg">
                            <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-3 rounded-t-lg">
                              <h5 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-purple-500" />
                                Geração de Testes com IA
                              </h5>
                            </div>
                            <div className="p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Sparkles className="h-4 w-4 text-purple-500" />
                                  <Label>Utilizar Gerador de IA</Label>
                                </div>
                                <Switch 
                                  checked={user.permissions?.can_use_ai}
                                  onCheckedChange={(checked) => handlePermissionChange(user.id, 'can_use_ai', checked)}
                                  disabled={!canManageUser(user.profile?.role || 'tester')}
                                />
                              </div>
                              
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Zap className="h-4 w-4 text-blue-500" />
                                  <Label>Selecionar Modelos IA</Label>
                                </div>
                                <Switch 
                                  checked={user.permissions?.can_select_ai_models}
                                  onCheckedChange={(checked) => handlePermissionChange(user.id, 'can_select_ai_models', checked)}
                                  disabled={!canManageUser(user.profile?.role || 'tester')}
                                />
                              </div>
                              
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-purple-400" />
                                  <Label>Gerar Planos com IA</Label>
                                </div>
                                <Switch 
                                  checked={user.permissions?.can_use_ai && user.permissions?.can_manage_plans}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      handlePermissionChange(user.id, 'can_use_ai', true);
                                      handlePermissionChange(user.id, 'can_manage_plans', true);
                                    }
                                  }}
                                  disabled={!canManageUser(user.profile?.role || 'tester')}
                                />
                              </div>
                              
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <ClipboardCheck className="h-4 w-4 text-purple-400" />
                                  <Label>Gerar Casos com IA</Label>
                                </div>
                                <Switch 
                                  checked={user.permissions?.can_use_ai && user.permissions?.can_manage_cases}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      handlePermissionChange(user.id, 'can_use_ai', true);
                                      handlePermissionChange(user.id, 'can_manage_cases', true);
                                    }
                                  }}
                                  disabled={!canManageUser(user.profile?.role || 'tester')}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Seção: Model Control Panel */}
                          <div className="border rounded-lg">
                            <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-3 rounded-t-lg">
                              <h5 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                <Settings className="h-4 w-4 text-orange-500" />
                                Model Control Panel
                              </h5>
                            </div>
                            <div className="p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Settings className="h-4 w-4 text-orange-500" />
                                  <Label>Acessar MCP</Label>
                                </div>
                                <Switch 
                                  checked={user.permissions?.can_access_model_control}
                                  onCheckedChange={(checked) => handlePermissionChange(user.id, 'can_access_model_control', checked)}
                                  disabled={!canManageUser(user.profile?.role || 'tester')}
                                />
                              </div>
                              
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Zap className="h-4 w-4 text-orange-400" />
                                  <Label>Configurar Modelos</Label>
                                </div>
                                <Switch 
                                  checked={user.permissions?.can_configure_ai_models}
                                  onCheckedChange={(checked) => handlePermissionChange(user.id, 'can_configure_ai_models', checked)}
                                  disabled={!canManageUser(user.profile?.role || 'tester')}
                                />
                              </div>
                              
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="h-4 w-4 text-orange-400" />
                                  <Label>Testar Conexões IA</Label>
                                </div>
                                <Switch 
                                  checked={user.permissions?.can_test_ai_connections}
                                  onCheckedChange={(checked) => handlePermissionChange(user.id, 'can_test_ai_connections', checked)}
                                  disabled={!canManageUser(user.profile?.role || 'tester')}
                                />
                              </div>
                              
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-orange-400" />
                                  <Label>Gerenciar Templates</Label>
                                </div>
                                <Switch 
                                  checked={user.permissions?.can_manage_ai_templates}
                                  onCheckedChange={(checked) => handlePermissionChange(user.id, 'can_manage_ai_templates', checked)}
                                  disabled={!canManageUser(user.profile?.role || 'tester')}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Seção: Relatórios e Análises */}
                          <div className="border rounded-lg">
                            <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-3 rounded-t-lg">
                              <h5 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                <BarChart3 className="h-4 w-4 text-amber-500" />
                                Relatórios e Análises
                              </h5>
                            </div>
                            <div className="p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <BarChart3 className="h-4 w-4 text-amber-500" />
                                  <Label>Visualizar Relatórios</Label>
                                </div>
                                <Switch 
                                  checked={user.permissions?.can_view_reports}
                                  onCheckedChange={(checked) => handlePermissionChange(user.id, 'can_view_reports', checked)}
                                  disabled={!canManageUser(user.profile?.role || 'tester')}
                                />
                              </div>
                              
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Download className="h-4 w-4 text-teal-500" />
                                  <Label>Exportar Dados</Label>
                                </div>
                                <Switch 
                                  checked={user.permissions?.can_view_reports}
                                  onCheckedChange={(checked) => handlePermissionChange(user.id, 'can_view_reports', checked)}
                                  disabled={!canManageUser(user.profile?.role || 'tester')}
                                />
                              </div>
                              
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Eye className="h-4 w-4 text-blue-400" />
                                  <Label>Relatórios Avançados</Label>
                                </div>
                                <Switch 
                                  checked={user.permissions?.can_view_reports && (user.profile?.role === 'admin' || user.profile?.role === 'master')}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      handlePermissionChange(user.id, 'can_view_reports', true);
                                    }
                                  }}
                                  disabled={!canManageUser(user.profile?.role || 'tester') || (user.profile?.role !== 'admin' && user.profile?.role !== 'master')}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Seção: Acesso Geral */}
                          <div className="border rounded-lg">
                            <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-3 rounded-t-lg">
                              <h5 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                <Home className="h-4 w-4 text-gray-500" />
                                Acesso Geral
                              </h5>
                            </div>
                            <div className="p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Home className="h-4 w-4 text-blue-500" />
                                  <Label>Acessar Dashboard</Label>
                                </div>
                                <Switch 
                                  checked={true}
                                  disabled={true}
                                />
                              </div>
                              
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-gray-500" />
                                  <Label>Visualizar Histórico</Label>
                                </div>
                                <Switch 
                                  checked={true}
                                  disabled={true}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {!canManageUser(user.profile?.role || 'tester') && (
                          <div className="text-sm text-muted-foreground mt-4">
                            Você não tem permissão para alterar as configurações deste usuário.
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              }
              return acc;
            }, [])}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}; 