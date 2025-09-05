import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions, UserRole } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

const SINGLE_TENANT = String((import.meta as any).env?.VITE_SINGLE_TENANT ?? 'true') === 'true';

type Profile = Database['public']['Tables']['profiles']['Row'];

const roleLabels: Record<UserRole, string> = {
  master: 'Master',
  admin: 'Administrador',
  manager: 'Gerente',
  tester: 'Testador',
  viewer: 'Visualizador',
};

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { role } = usePermissions();

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'user' | 'history' | 'preferences'>('user');

  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [prefs, setPrefs] = useState<{ email_enabled: boolean; system_enabled: boolean; push_enabled: boolean } | null>(null);
  const [history, setHistory] = useState<Array<{ id: string; action: string; context: string | null; created_at: string }>>([]);
  const [saving, setSaving] = useState(false);

  // Preferimos carregar quando abrir
  useEffect(() => {
    const load = async () => {
      if (!isOpen) return;
      try {
        setLoading(true);
        if (!user) return;

        if (SINGLE_TENANT) {
          const { data } = await supabase.auth.getUser();
          const u = data?.user;
          setEmail(u?.email || '');
          setDisplayName((u?.user_metadata as any)?.full_name || '');
          setProfile({
            id: u?.id || '',
            email: u?.email || '',
            display_name: (u?.user_metadata as any)?.full_name || '',
            role: (role || 'viewer') as UserRole,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            organization_id: null,
          } as Profile);
          setPrefs({ email_enabled: true, system_enabled: true, push_enabled: false });
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('id, display_name, email, role, created_at, updated_at')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          console.error(error);
          toast({ title: 'Erro', description: 'Não foi possível carregar seu perfil.', variant: 'destructive' });
          return;
        }
        if (data) {
          setProfile(data as Profile);
          setDisplayName((data as Profile).display_name || '');
          setEmail((data as Profile).email || '');
        }

        // Carregar preferências
        const { data: pref, error: prefErr } = await supabase
          .from('notification_preferences' as any)
          .select('email_enabled, system_enabled, push_enabled')
          .eq('user_id', user.id)
          .maybeSingle();
        if (!prefErr && pref) {
          setPrefs(pref as any);
        } else {
          setPrefs({ email_enabled: true, system_enabled: true, push_enabled: false });
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOpen, toast, user, role]);

  const roleName = useMemo(() => roleLabels[(profile?.role || role || 'viewer') as UserRole], [profile?.role, role]);

  // Carregar histórico ao trocar para a aba
  useEffect(() => {
    const loadHistory = async () => {
      if (activeTab !== 'history' || !isOpen || !user) return;
      if (SINGLE_TENANT) {
        setHistory([]);
        return;
      }
      const { data, error } = await supabase
        .from('activity_logs' as any)
        .select('id, action, context, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);
      if (!error && data) setHistory(data as any);
    };
    loadHistory();
  }, [activeTab, isOpen, user]);

  const handleSave = async () => {
    if (!user) return;
    try {
      setSaving(true);
      // Salvar nome
      if (SINGLE_TENANT) {
        const { error: upErr } = await supabase.auth.updateUser({ data: { full_name: displayName } as any });
        if (upErr) throw upErr;
        toast({ title: 'Perfil atualizado', description: 'Seu nome foi atualizado.' });
        return;
      }

      const { error: profErr } = await supabase
        .from('profiles')
        .update({ display_name: displayName })
        .eq('id', user.id);
      if (profErr) throw profErr;

      // Salvar preferências (se existir prefs state)
      if (prefs) {
        const { error: prefErr } = await supabase
          .from('notification_preferences' as any)
          .upsert({ user_id: user.id, ...prefs }, { onConflict: 'user_id' } as any);
        if (prefErr) throw prefErr;
      }

      toast({ title: 'Perfil atualizado', description: 'Dados e preferências salvos.' });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Erro ao salvar', description: e?.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Meu Perfil</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList>
            <TabsTrigger value="user">Usuário</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
            <TabsTrigger value="preferences">Preferências</TabsTrigger>
          </TabsList>

          <TabsContent value="user" className="space-y-4 p-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="display_name">Nome</Label>
                <Input id="display_name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={email} readOnly />
              </div>
              <div className="space-y-2">
                <Label>Papel</Label>
                <Input value={roleName} readOnly />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>Fechar</Button>
              <Button onClick={handleSave} disabled={loading || saving}>Salvar</Button>
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-3 p-2">
            <div className="text-sm text-muted-foreground">Histórico do usuário</div>
            {history.length === 0 ? (
              <div className="text-sm text-gray-500">Nenhum registro disponível.</div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-auto pr-1">
                {history.map((h) => (
                  <div key={h.id} className="text-sm border rounded-md p-2">
                    <div className="font-medium">{h.action}</div>
                    {h.context && <div className="text-xs text-muted-foreground">{h.context}</div>}
                    <div className="text-xs text-gray-500 mt-1">{new Date(h.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="preferences" className="space-y-4 p-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Notificações por email</div>
                  <div className="text-xs text-muted-foreground">Receber alertas por email</div>
                </div>
                <Switch 
                  checked={!!prefs?.email_enabled}
                  onCheckedChange={(v) => setPrefs((p) => (p ? { ...p, email_enabled: v } : { email_enabled: v, system_enabled: true, push_enabled: false }))}
                  disabled={SINGLE_TENANT}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Notificações no sistema</div>
                  <div className="text-xs text-muted-foreground">Mostrar alertas no sininho</div>
                </div>
                <Switch 
                  checked={!!prefs?.system_enabled}
                  onCheckedChange={(v) => setPrefs((p) => (p ? { ...p, system_enabled: v } : { email_enabled: true, system_enabled: v, push_enabled: false }))}
                  disabled={SINGLE_TENANT}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Notificações Push</div>
                  <div className="text-xs text-muted-foreground">Receber push quando disponível</div>
                </div>
                <Switch 
                  checked={!!prefs?.push_enabled}
                  onCheckedChange={(v) => setPrefs((p) => (p ? { ...p, push_enabled: v } : { email_enabled: true, system_enabled: true, push_enabled: v }))}
                  disabled={SINGLE_TENANT}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileModal;
