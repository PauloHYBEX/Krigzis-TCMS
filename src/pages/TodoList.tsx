import React, { useState, useEffect } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  CheckSquare, 
  Plus, 
  FolderPlus,
  Calendar,
  Clock,
  User,
  FileText,
  Folder,
  MoreVertical,
  Edit,
  Trash2,
  CheckCircle,
  Circle,
  AlertCircle
} from 'lucide-react';
import { PermissionGuard } from '@/components/PermissionGuard';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface TodoFolder {
  id: string;
  name: string;
  description?: string;
  color: string;
  created_at: string;
  user_id: string;
}

interface TodoTask {
  id: string;
  folder_id?: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  due_date?: string;
  assigned_to?: string;
  created_at: string;
  user_id: string;
}

export const TodoList = () => {
  const { hasPermission } = usePermissions();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [folders, setFolders] = useState<TodoFolder[]>([]);
  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // Reset forms when modals close
  const handleCloseFolderModal = (open: boolean) => {
    setIsFolderModalOpen(open);
    if (!open) {
      setFolderForm({ name: '', description: '', color: '#3B82F6' });
    }
  };

  const handleCloseTaskModal = (open: boolean) => {
    setIsTaskModalOpen(open);
    if (!open) {
      setTaskForm({ title: '', description: '', priority: 'medium', due_date: '', folder_id: '' });
    }
  };
  
  // Form states
  const [folderForm, setFolderForm] = useState({
    name: '',
    description: '',
    color: '#3B82F6'
  });
  
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    due_date: '',
    folder_id: ''
  });

  // Load folders and tasks
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load folders
      const { data: foldersData, error: foldersError } = await supabase
        .from('todo_folders')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (foldersError) throw foldersError;
      setFolders(foldersData || []);
      
      // Load tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('todo_tasks')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (tasksError) throw tasksError;
      setTasks(tasksData || []);
      
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os dados',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!folderForm.name.trim()) {
      toast({
        title: 'Erro',
        description: 'O nome da pasta é obrigatório',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      const { error } = await supabase
        .from('todo_folders')
        .insert({
          name: folderForm.name,
          description: folderForm.description,
          color: folderForm.color,
          user_id: user?.id
        });
        
      if (error) throw error;
      
      toast({
        title: 'Sucesso',
        description: 'Pasta criada com sucesso'
      });
      
      setIsFolderModalOpen(false);
      setFolderForm({ name: '', description: '', color: '#3B82F6' });
      loadData();
      
    } catch (error) {
      console.error('Error creating folder:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar a pasta',
        variant: 'destructive'
      });
    }
  };

  const handleCreateTask = async () => {
    if (!taskForm.title.trim()) {
      toast({
        title: 'Erro',
        description: 'O título da tarefa é obrigatório',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      const { error } = await supabase
        .from('todo_tasks')
        .insert({
          title: taskForm.title,
          description: taskForm.description,
          priority: taskForm.priority,
          due_date: taskForm.due_date || null,
          folder_id: taskForm.folder_id || null,
          status: 'pending',
          user_id: user?.id
        });
        
      if (error) throw error;
      
      toast({
        title: 'Sucesso',
        description: 'Tarefa criada com sucesso'
      });
      
      setIsTaskModalOpen(false);
      setTaskForm({
        title: '',
        description: '',
        priority: 'medium',
        due_date: '',
        folder_id: ''
      });
      loadData();
      
    } catch (error) {
      console.error('Error creating task:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar a tarefa',
        variant: 'destructive'
      });
    }
  };

  const handleToggleTaskStatus = async (task: TodoTask) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    
    try {
      const { error } = await supabase
        .from('todo_tasks')
        .update({ status: newStatus })
        .eq('id', task.id);
        
      if (error) throw error;
      
      loadData();
      
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar a tarefa',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('todo_tasks')
        .delete()
        .eq('id', taskId);
        
      if (error) throw error;
      
      toast({
        title: 'Sucesso',
        description: 'Tarefa removida com sucesso'
      });
      
      loadData();
      
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível remover a tarefa',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    try {
      // First update tasks to remove folder reference
      await supabase
        .from('todo_tasks')
        .update({ folder_id: null })
        .eq('folder_id', folderId);
      
      // Then delete the folder
      const { error } = await supabase
        .from('todo_folders')
        .delete()
        .eq('id', folderId);
        
      if (error) throw error;
      
      toast({
        title: 'Sucesso',
        description: 'Pasta removida com sucesso'
      });
      
      if (selectedFolder === folderId) {
        setSelectedFolder(null);
      }
      
      loadData();
      
    } catch (error) {
      console.error('Error deleting folder:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível remover a pasta',
        variant: 'destructive'
      });
    }
  };

  const filteredTasks = selectedFolder 
    ? tasks.filter(task => task.folder_id === selectedFolder)
    : tasks;

  const stats = {
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    overdue: tasks.filter(t => {
      if (!t.due_date || t.status === 'completed') return false;
      return new Date(t.due_date) < new Date();
    }).length
  };

  if (!hasPermission('can_access_todo')) {
    return (
      <PermissionGuard requiredPermission="can_access_todo">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Você não tem permissão para acessar o To-Do List</p>
        </div>
      </PermissionGuard>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <CheckSquare className="h-8 w-8" />
            To-Do List
          </h1>
          <p className="text-muted-foreground">
            Sistema integrado de gerenciamento de tarefas
          </p>
        </div>
        
        <div className="flex gap-2">
          {hasPermission('can_manage_todo_folders') && (
            <Button variant="outline" onClick={() => setIsFolderModalOpen(true)}>
              <FolderPlus className="h-4 w-4 mr-2" />
              Nova Pasta
            </Button>
          )}
          {hasPermission('can_manage_todo_tasks') && (
            <Button onClick={() => setIsTaskModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Tarefa
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Tarefas</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {folders.length} pasta{folders.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}% do total
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Progresso</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atrasadas</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Folders Sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pastas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant={selectedFolder === null ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => setSelectedFolder(null)}
              >
                <Folder className="h-4 w-4 mr-2" />
                Todas as Tarefas
              </Button>
              
              {folders.map(folder => (
                <div key={folder.id} className="flex items-center gap-1">
                  <Button
                    variant={selectedFolder === folder.id ? "secondary" : "ghost"}
                    className="flex-1 justify-start"
                    onClick={() => setSelectedFolder(folder.id)}
                  >
                    <div 
                      className="h-4 w-4 mr-2 rounded"
                      style={{ backgroundColor: folder.color }}
                    />
                    {folder.name}
                  </Button>
                  {hasPermission('can_manage_todo_folders') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteFolder(folder.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Tasks List */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedFolder 
                  ? folders.find(f => f.id === selectedFolder)?.name || 'Tarefas'
                  : 'Todas as Tarefas'
                }
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Carregando...</p>
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="text-center py-8">
                  <CheckSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Nenhuma tarefa encontrada</p>
                  {hasPermission('can_manage_todo_tasks') && (
                    <Button 
                      className="mt-4" 
                      onClick={() => setIsTaskModalOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Criar Primeira Tarefa
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTasks.map(task => (
                    <div 
                      key={task.id} 
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <button
                        onClick={() => handleToggleTaskStatus(task)}
                        className="flex-shrink-0"
                      >
                        {task.status === 'completed' ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <Circle className="h-5 w-5 text-gray-400" />
                        )}
                      </button>
                      
                      <div className="flex-1">
                        <h4 className={`font-medium ${task.status === 'completed' ? 'line-through text-gray-500' : ''}`}>
                          {task.title}
                        </h4>
                        {task.description && (
                          <p className="text-sm text-muted-foreground">{task.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-1">
                          <span className={`text-xs px-2 py-1 rounded ${
                            task.priority === 'high' ? 'bg-red-100 text-red-700' :
                            task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {task.priority === 'high' ? 'Alta' : 
                             task.priority === 'medium' ? 'Média' : 'Baixa'}
                          </span>
                          {task.due_date && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(task.due_date).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {hasPermission('can_manage_todo_tasks') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTask(task.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Folder Modal */}
      <Dialog open={isFolderModalOpen} onOpenChange={handleCloseFolderModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Pasta</DialogTitle>
            <DialogDescription>
              Crie uma nova pasta para organizar suas tarefas
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="folder-name">Nome</Label>
              <Input
                id="folder-name"
                value={folderForm.name}
                onChange={(e) => setFolderForm({ ...folderForm, name: e.target.value })}
                placeholder="Nome da pasta"
              />
            </div>
            <div>
              <Label htmlFor="folder-description">Descrição</Label>
              <Textarea
                id="folder-description"
                value={folderForm.description}
                onChange={(e) => setFolderForm({ ...folderForm, description: e.target.value })}
                placeholder="Descrição opcional"
              />
            </div>
            <div>
              <Label htmlFor="folder-color">Cor</Label>
              <Input
                id="folder-color"
                type="color"
                value={folderForm.color}
                onChange={(e) => setFolderForm({ ...folderForm, color: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleCloseFolderModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateFolder}>
              Criar Pasta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Task Modal */}
      <Dialog open={isTaskModalOpen} onOpenChange={handleCloseTaskModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Tarefa</DialogTitle>
            <DialogDescription>
              Crie uma nova tarefa para acompanhar
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="task-title">Título</Label>
              <Input
                id="task-title"
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                placeholder="Título da tarefa"
              />
            </div>
            <div>
              <Label htmlFor="task-description">Descrição</Label>
              <Textarea
                id="task-description"
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                placeholder="Descrição opcional"
              />
            </div>
            <div>
              <Label htmlFor="task-priority">Prioridade</Label>
              <Select
                value={taskForm.priority}
                onValueChange={(value: 'low' | 'medium' | 'high') => 
                  setTaskForm({ ...taskForm, priority: value })
                }
              >
                <SelectTrigger id="task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="task-folder">Pasta</Label>
              <Select
                value={taskForm.folder_id || "none"}
                onValueChange={(value) => setTaskForm({ ...taskForm, folder_id: value === "none" ? "" : value })}
              >
                <SelectTrigger id="task-folder">
                  <SelectValue placeholder="Selecione uma pasta (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {folders.map(folder => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="task-due-date">Data de Vencimento</Label>
              <Input
                id="task-due-date"
                type="date"
                value={taskForm.due_date}
                onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleCloseTaskModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateTask}>
              Criar Tarefa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}; 