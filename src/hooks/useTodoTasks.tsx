import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Database } from '@/integrations/supabase/types';

type TodoTask = Database['public']['Tables']['todo_tasks']['Row'];
type TodoTaskInsert = Database['public']['Tables']['todo_tasks']['Insert'];
type TodoTaskUpdate = Database['public']['Tables']['todo_tasks']['Update'];

interface TaskFilters {
  folderId?: string | null;
  status?: string;
  priority?: string;
  assignedTo?: string;
  tags?: string[];
  search?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
}

interface TaskStats {
  total: number;
  completed: number;
  inProgress: number;
  overdue: number;
  byPriority: Record<string, number>;
  byStatus: Record<string, number>;
}

export const useTodoTasks = (folderId?: string | null) => {
  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<TaskStats>({
    total: 0,
    completed: 0,
    inProgress: 0,
    overdue: 0,
    byPriority: {},
    byStatus: {}
  });
  const { toast } = useToast();

  // Buscar tarefas com filtros
  const fetchTasks = async (filters: TaskFilters = {}) => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('todo_tasks')
        .select('*')
        .neq('status', 'archived')
        .order('position', { ascending: true });

      // Aplicar filtros
      if (folderId !== undefined) {
        query = query.eq('folder_id', folderId);
      }
      if (filters.folderId !== undefined) {
        query = query.eq('folder_id', filters.folderId);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.priority) {
        query = query.eq('priority', filters.priority);
      }
      if (filters.assignedTo) {
        query = query.eq('assigned_to', filters.assignedTo);
      }
      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }
      if (filters.dueDateFrom) {
        query = query.gte('due_date', filters.dueDateFrom);
      }
      if (filters.dueDateTo) {
        query = query.lte('due_date', filters.dueDateTo);
      }
      if (filters.tags && filters.tags.length > 0) {
        query = query.overlaps('tags', filters.tags);
      }

      const { data, error } = await query;

      if (error) throw error;

      setTasks(data || []);
      calculateStats(data || []);
    } catch (err: any) {
      setError(err.message);
      toast({
        title: "Erro ao carregar tarefas",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Calcular estatísticas
  const calculateStats = (taskList: TodoTask[]) => {
    const now = new Date();
    const newStats: TaskStats = {
      total: taskList.length,
      completed: 0,
      inProgress: 0,
      overdue: 0,
      byPriority: {},
      byStatus: {}
    };

    taskList.forEach(task => {
      // Status counts
      if (task.status === 'done') newStats.completed++;
      if (task.status === 'in_progress') newStats.inProgress++;
      
      // Overdue tasks
      if (task.due_date && new Date(task.due_date) < now && task.status !== 'done') {
        newStats.overdue++;
      }

      // Priority distribution
      const priority = task.priority || 'medium';
      newStats.byPriority[priority] = (newStats.byPriority[priority] || 0) + 1;

      // Status distribution
      const status = task.status || 'todo';
      newStats.byStatus[status] = (newStats.byStatus[status] || 0) + 1;
    });

    setStats(newStats);
  };

  // Criar nova tarefa
  const createTask = async (taskData: Omit<TodoTaskInsert, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Buscar última posição na pasta
      const { data: lastTask } = await supabase
        .from('todo_tasks')
        .select('position')
        .eq('folder_id', taskData.folder_id)
        .order('position', { ascending: false })
        .limit(1)
        .single();

      const nextPosition = (lastTask?.position || 0) + 1;

      const { data, error } = await supabase
        .from('todo_tasks')
        .insert({
          ...taskData,
          user_id: user.id,
          position: nextPosition,
          assigned_to: taskData.assigned_to || user.id,
        })
        .select('*')
        .single();

      if (error) throw error;

      setTasks(prev => [...prev, data]);
      toast({
        title: "Tarefa criada",
        description: `A tarefa "${data.title}" foi criada com sucesso.`,
      });

      return data;
    } catch (err: any) {
      toast({
        title: "Erro ao criar tarefa",
        description: err.message,
        variant: "destructive",
      });
      throw err;
    }
  };

  // Atualizar tarefa
  const updateTask = async (id: string, updates: TodoTaskUpdate) => {
    try {
      // Se status mudou para 'done', definir completed_at
      if (updates.status === 'done' && !updates.completed_at) {
        updates.completed_at = new Date().toISOString();
        updates.progress_percentage = 100;
      }
      
      // Se status mudou de 'done' para outro, limpar completed_at
      if (updates.status && updates.status !== 'done') {
        updates.completed_at = null;
      }

      const { data, error } = await supabase
        .from('todo_tasks')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;

      setTasks(prev => prev.map(task => 
        task.id === id ? data : task
      ));

      toast({
        title: "Tarefa atualizada",
        description: `A tarefa "${data.title}" foi atualizada.`,
      });

      return data;
    } catch (err: any) {
      toast({
        title: "Erro ao atualizar tarefa",
        description: err.message,
        variant: "destructive",
      });
      throw err;
    }
  };

  // Arquivar tarefa
  const archiveTask = async (id: string) => {
    try {
      const taskToArchive = tasks.find(t => t.id === id);
      
      const { data, error } = await supabase
        .from('todo_tasks')
        .update({ status: 'archived' })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setTasks(prev => prev.filter(task => task.id !== id));
      toast({
        title: "Tarefa arquivada",
        description: `A tarefa "${taskToArchive?.title}" foi arquivada.`,
      });

      return data;
    } catch (err: any) {
      toast({
        title: "Erro ao arquivar tarefa",
        description: err.message,
        variant: "destructive",
      });
      throw err;
    }
  };

  // Deletar tarefa permanentemente
  const deleteTask = async (id: string) => {
    try {
      const taskToDelete = tasks.find(t => t.id === id);
      
      const { error } = await supabase
        .from('todo_tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setTasks(prev => prev.filter(task => task.id !== id));
      toast({
        title: "Tarefa deletada",
        description: `A tarefa "${taskToDelete?.title}" foi deletada permanentemente.`,
      });
    } catch (err: any) {
      toast({
        title: "Erro ao deletar tarefa",
        description: err.message,
        variant: "destructive",
      });
      throw err;
    }
  };

  // Reordenar tarefas
  const reorderTasks = async (taskId: string, newPosition: number, newFolderId?: string) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) throw new Error('Tarefa não encontrada');

      const targetFolderId = newFolderId || task.folder_id;

      // Atualizar posições das outras tarefas
      const siblingTasks = tasks.filter(t => 
        t.folder_id === targetFolderId && t.id !== taskId
      );

      const updates = siblingTasks
        .filter(t => t.position >= newPosition)
        .map(t => ({
          id: t.id,
          position: t.position + 1
        }));

      // Executar updates em batch
      for (const update of updates) {
        await supabase
          .from('todo_tasks')
          .update({ position: update.position })
          .eq('id', update.id);
      }

      // Atualizar a tarefa movida
      const { data, error } = await supabase
        .from('todo_tasks')
        .update({ 
          position: newPosition,
          folder_id: targetFolderId
        })
        .eq('id', taskId)
        .select('*')
        .single();

      if (error) throw error;

      // Recarregar tarefas para refletir nova ordem
      await fetchTasks();

      return data;
    } catch (err: any) {
      toast({
        title: "Erro ao reordenar tarefas",
        description: err.message,
        variant: "destructive",
      });
      throw err;
    }
  };

  // Duplicar tarefa
  const duplicateTask = async (id: string) => {
    try {
      const originalTask = tasks.find(t => t.id === id);
      if (!originalTask) throw new Error('Tarefa não encontrada');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const duplicateData = {
        folder_id: originalTask.folder_id,
        title: `${originalTask.title} (Cópia)`,
        description: originalTask.description,
        content: originalTask.content,
        priority: originalTask.priority,
        status: 'todo' as const,
        due_date: originalTask.due_date,
        estimated_hours: originalTask.estimated_hours,
        tags: originalTask.tags,
        is_recurring: originalTask.is_recurring,
        recurrence_pattern: originalTask.recurrence_pattern,
      };

      return await createTask(duplicateData);
    } catch (err: any) {
      toast({
        title: "Erro ao duplicar tarefa",
        description: err.message,
        variant: "destructive",
      });
      throw err;
    }
  };

  // Atribuir tarefa
  const assignTask = async (id: string, userId: string) => {
    return await updateTask(id, { assigned_to: userId });
  };

  // Atualizar progresso
  const updateProgress = async (id: string, percentage: number) => {
    const status = percentage === 100 ? 'done' : 
                  percentage > 0 ? 'in_progress' : 'todo';
    
    return await updateTask(id, { 
      progress_percentage: percentage,
      status: status as any
    });
  };

  // Adicionar/remover tags
  const updateTags = async (id: string, tags: string[]) => {
    return await updateTask(id, { tags });
  };

  // Marcar como vista
  const markAsViewed = async (id: string) => {
    try {
      await supabase
        .from('todo_tasks')
        .update({ 
          view_count: 1, // Will be incremented by trigger
          last_viewed_at: new Date().toISOString()
        })
        .eq('id', id);
    } catch (err: any) {
      // Silently fail for view tracking
      console.warn('Failed to update view count:', err.message);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [folderId]);

  return {
    tasks,
    loading,
    error,
    stats,
    
    // CRUD Operations
    createTask,
    updateTask,
    archiveTask,
    deleteTask,
    
    // Advanced Operations
    reorderTasks,
    duplicateTask,
    assignTask,
    updateProgress,
    updateTags,
    markAsViewed,
    
    // Utility Functions
    fetchTasks,
    refetch: () => fetchTasks(),
  };
}; 