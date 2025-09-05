import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Database } from '@/integrations/supabase/types';

type TodoFolder = Database['public']['Tables']['todo_folders']['Row'];
type TodoFolderInsert = Database['public']['Tables']['todo_folders']['Insert'];
type TodoFolderUpdate = Database['public']['Tables']['todo_folders']['Update'];

export const useTodoFolders = () => {
  const [folders, setFolders] = useState<TodoFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Buscar todas as pastas do usuário
  const fetchFolders = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('todo_folders')
        .select('*')
        .order('position', { ascending: true })
        .eq('is_archived', false);

      if (error) throw error;

      setFolders(data || []);
    } catch (err: any) {
      setError(err.message);
      toast({
        title: "Erro ao carregar pastas",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Criar nova pasta
  const createFolder = async (folderData: Omit<TodoFolderInsert, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Buscar última posição
      const { data: lastFolder } = await supabase
        .from('todo_folders')
        .select('position')
        .eq('user_id', user.id)
        .eq('parent_folder_id', folderData.parent_folder_id || null)
        .order('position', { ascending: false })
        .limit(1)
        .single();

      const nextPosition = (lastFolder?.position || 0) + 1;

      const { data, error } = await supabase
        .from('todo_folders')
        .insert({
          ...folderData,
          user_id: user.id,
          position: nextPosition,
        })
        .select()
        .single();

      if (error) throw error;

      setFolders(prev => [...prev, data]);
      toast({
        title: "Pasta criada",
        description: `A pasta "${data.name}" foi criada com sucesso.`,
      });

      return data;
    } catch (err: any) {
      toast({
        title: "Erro ao criar pasta",
        description: err.message,
        variant: "destructive",
      });
      throw err;
    }
  };

  // Atualizar pasta
  const updateFolder = async (id: string, updates: TodoFolderUpdate) => {
    try {
      const { data, error } = await supabase
        .from('todo_folders')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setFolders(prev => prev.map(folder => 
        folder.id === id ? data : folder
      ));

      toast({
        title: "Pasta atualizada",
        description: `A pasta "${data.name}" foi atualizada com sucesso.`,
      });

      return data;
    } catch (err: any) {
      toast({
        title: "Erro ao atualizar pasta",
        description: err.message,
        variant: "destructive",
      });
      throw err;
    }
  };

  // Arquivar pasta (soft delete)
  const archiveFolder = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('todo_folders')
        .update({ is_archived: true })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setFolders(prev => prev.filter(folder => folder.id !== id));
      toast({
        title: "Pasta arquivada",
        description: `A pasta "${data.name}" foi arquivada.`,
      });

      return data;
    } catch (err: any) {
      toast({
        title: "Erro ao arquivar pasta",
        description: err.message,
        variant: "destructive",
      });
      throw err;
    }
  };

  // Deletar pasta permanentemente
  const deleteFolder = async (id: string) => {
    try {
      // Verificar se há tarefas na pasta
      const { data: tasks } = await supabase
        .from('todo_tasks')
        .select('id')
        .eq('folder_id', id)
        .limit(1);

      if (tasks && tasks.length > 0) {
        throw new Error('Não é possível deletar uma pasta que contém tarefas. Mova ou delete as tarefas primeiro.');
      }

      const folderToDelete = folders.find(f => f.id === id);
      
      const { error } = await supabase
        .from('todo_folders')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setFolders(prev => prev.filter(folder => folder.id !== id));
      toast({
        title: "Pasta deletada",
        description: `A pasta "${folderToDelete?.name}" foi deletada permanentemente.`,
      });
    } catch (err: any) {
      toast({
        title: "Erro ao deletar pasta",
        description: err.message,
        variant: "destructive",
      });
      throw err;
    }
  };

  // Reordenar pastas
  const reorderFolders = async (folderId: string, newPosition: number, parentFolderId?: string | null) => {
    try {
      // Atualizar posições das outras pastas
      const siblingFolders = folders.filter(f => 
        f.parent_folder_id === (parentFolderId || null) && f.id !== folderId
      );

      const updates = siblingFolders
        .filter(f => f.position >= newPosition)
        .map(f => ({
          id: f.id,
          position: f.position + 1
        }));

      // Executar updates em batch se necessário
      for (const update of updates) {
        await supabase
          .from('todo_folders')
          .update({ position: update.position })
          .eq('id', update.id);
      }

      // Atualizar a pasta movida
      const { data, error } = await supabase
        .from('todo_folders')
        .update({ 
          position: newPosition,
          parent_folder_id: parentFolderId || null
        })
        .eq('id', folderId)
        .select()
        .single();

      if (error) throw error;

      // Recarregar pastas para refletir nova ordem
      await fetchFolders();

      return data;
    } catch (err: any) {
      toast({
        title: "Erro ao reordenar pastas",
        description: err.message,
        variant: "destructive",
      });
      throw err;
    }
  };

  // Compartilhar pasta
  const shareFolder = async (id: string, userIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from('todo_folders')
        .update({ 
          is_shared: userIds.length > 0,
          shared_with: userIds 
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setFolders(prev => prev.map(folder => 
        folder.id === id ? data : folder
      ));

      toast({
        title: "Compartilhamento atualizado",
        description: userIds.length > 0 
          ? `Pasta compartilhada com ${userIds.length} usuário(s).`
          : "Compartilhamento removido da pasta.",
      });

      return data;
    } catch (err: any) {
      toast({
        title: "Erro ao compartilhar pasta",
        description: err.message,
        variant: "destructive",
      });
      throw err;
    }
  };

  // Buscar pastas filhas
  const getFolderChildren = (parentId: string | null) => {
    return folders.filter(folder => folder.parent_folder_id === parentId);
  };

  // Buscar caminho completo da pasta (breadcrumb)
  const getFolderPath = (folderId: string): TodoFolder[] => {
    const path: TodoFolder[] = [];
    let currentFolder = folders.find(f => f.id === folderId);

    while (currentFolder) {
      path.unshift(currentFolder);
      currentFolder = currentFolder.parent_folder_id 
        ? folders.find(f => f.id === currentFolder!.parent_folder_id)
        : undefined;
    }

    return path;
  };

  useEffect(() => {
    fetchFolders();
  }, []);

  return {
    folders,
    loading,
    error,
    
    // CRUD Operations
    createFolder,
    updateFolder,
    archiveFolder,
    deleteFolder,
    
    // Advanced Operations
    reorderFolders,
    shareFolder,
    
    // Utility Functions
    getFolderChildren,
    getFolderPath,
    
    // Refresh
    refetch: fetchFolders,
  };
}; 