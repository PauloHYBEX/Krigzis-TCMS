import React, { useState } from 'react';
import { useTodoFolders } from '@/hooks/useTodoFolders';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Folder,
  FolderPlus, 
  MoreHorizontal,
  Edit,
  Archive,
  Trash2,
  Share2,
  FolderOpen,
  Plus
} from 'lucide-react';

interface FolderManagerProps {
  selectedFolderId?: string | null;
  onFolderSelect: (folderId: string | null) => void;
  showCreateButton?: boolean;
}

const FOLDER_COLORS = [
  { value: '#3b82f6', label: 'Azul', class: 'bg-blue-500' },
  { value: '#10b981', label: 'Verde', class: 'bg-green-500' },
  { value: '#f59e0b', label: 'Amarelo', class: 'bg-yellow-500' },
  { value: '#ef4444', label: 'Vermelho', class: 'bg-red-500' },
  { value: '#8b5cf6', label: 'Roxo', class: 'bg-purple-500' },
  { value: '#06b6d4', label: 'Ciano', class: 'bg-cyan-500' },
  { value: '#f97316', label: 'Laranja', class: 'bg-orange-500' },
  { value: '#84cc16', label: 'Lima', class: 'bg-lime-500' },
];

const FOLDER_ICONS = [
  'Folder', 'FolderOpen', 'Archive', 'Briefcase', 'Target', 
  'Star', 'Heart', 'Zap', 'Shield', 'Award'
];

export const FolderManager: React.FC<FolderManagerProps> = ({
  selectedFolderId,
  onFolderSelect,
  showCreateButton = true
}) => {
  const { folders, loading, createFolder, updateFolder, archiveFolder } = useTodoFolders();
  const { hasPermission } = usePermissions();
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingFolder, setEditingFolder] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3b82f6',
    icon: 'Folder',
    parent_folder_id: null as string | null,
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      color: '#3b82f6',
      icon: 'Folder',
      parent_folder_id: null,
    });
  };

  const handleCreateFolder = async () => {
    if (!formData.name.trim()) return;

    try {
      await createFolder({
        name: formData.name,
        description: formData.description,
        color: formData.color,
        icon: formData.icon,
        parent_folder_id: formData.parent_folder_id,
        is_archived: false,
        is_shared: false,
        shared_with: [],
      });

      resetForm();
      setShowCreateDialog(false);
    } catch (error) {
      console.error('Error creating folder:', error);
    }
  };

  const handleEditFolder = async () => {
    if (!editingFolder || !formData.name.trim()) return;

    try {
      await updateFolder(editingFolder.id, {
        name: formData.name,
        description: formData.description,
        color: formData.color,
        icon: formData.icon,
        parent_folder_id: formData.parent_folder_id,
      });

      resetForm();
      setShowEditDialog(false);
      setEditingFolder(null);
    } catch (error) {
      console.error('Error updating folder:', error);
    }
  };

  const openEditDialog = (folder: any) => {
    setEditingFolder(folder);
    setFormData({
      name: folder.name,
      description: folder.description || '',
      color: folder.color || '#3b82f6',
      icon: folder.icon || 'Folder',
      parent_folder_id: folder.parent_folder_id,
    });
    setShowEditDialog(true);
  };

  const handleArchiveFolder = async (folderId: string) => {
    try {
      await archiveFolder(folderId);
      if (selectedFolderId === folderId) {
        onFolderSelect(null);
      }
    } catch (error) {
      console.error('Error archiving folder:', error);
    }
  };

  const renderFolderTree = (parentId: string | null = null, depth: number = 0) => {
    const childFolders = folders.filter(f => f.parent_folder_id === parentId);
    
    return childFolders.map(folder => (
      <div key={folder.id} className={`${depth > 0 ? 'ml-4' : ''}`}>
        <div
          className={`flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer ${
            selectedFolderId === folder.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
          }`}
          onClick={() => onFolderSelect(folder.id)}
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-4 h-4 rounded"
              style={{ backgroundColor: folder.color || '#3b82f6' }}
            />
            <FolderOpen className="h-4 w-4 text-gray-500" />
            <span className="font-medium">{folder.name}</span>
            {folder.description && (
              <span className="text-sm text-gray-500 truncate max-w-[200px]">
                {folder.description}
              </span>
            )}
            {folder.is_shared && (
              <Badge variant="secondary" className="text-xs">
                <Share2 className="h-3 w-3 mr-1" />
                Compartilhada
              </Badge>
            )}
          </div>

          {hasPermission('can_manage_todo_folders') && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEditDialog(folder)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleArchiveFolder(folder.id)}>
                  <Archive className="h-4 w-4 mr-2" />
                  Arquivar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => handleArchiveFolder(folder.id)}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Deletar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        
        {renderFolderTree(folder.id, depth + 1)}
      </div>
    ));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Pastas</h3>
        {showCreateButton && hasPermission('can_manage_todo_folders') && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Pasta
          </Button>
        )}
      </div>

      <div className="space-y-1">
        <div
          className={`flex items-center p-2 rounded-lg hover:bg-gray-50 cursor-pointer ${
            selectedFolderId === null ? 'bg-blue-50 border-l-4 border-blue-500' : ''
          }`}
          onClick={() => onFolderSelect(null)}
        >
          <Folder className="h-4 w-4 text-gray-500 mr-3" />
          <span className="font-medium">Todas as Tarefas</span>
        </div>
        
        {renderFolderTree()}
      </div>

      {/* Dialog de Criação */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Pasta</DialogTitle>
            <DialogDescription>
              Crie uma nova pasta para organizar suas tarefas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nome da Pasta</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Digite o nome da pasta"
              />
            </div>

            <div>
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição da pasta"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cor</Label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {FOLDER_COLORS.map(color => (
                    <button
                      key={color.value}
                      type="button"
                      className={`w-8 h-8 rounded ${color.class} ${
                        formData.color === color.value ? 'ring-2 ring-offset-2 ring-gray-400' : ''
                      }`}
                      onClick={() => setFormData({ ...formData, color: color.value })}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>

              <div>
                <Label>Pasta Pai (opcional)</Label>
                <Select
                  value={formData.parent_folder_id || 'none'}
                  onValueChange={(value) => 
                    setFormData({ 
                      ...formData, 
                      parent_folder_id: value === 'none' ? null : value 
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar pasta pai" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma (raiz)</SelectItem>
                    {folders
                      .filter(f => !f.parent_folder_id)
                      .map(folder => (
                        <SelectItem key={folder.id} value={folder.id}>
                          {folder.name}
                        </SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateFolder} disabled={!formData.name.trim()}>
              <FolderPlus className="h-4 w-4 mr-2" />
              Criar Pasta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Edição */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Pasta</DialogTitle>
            <DialogDescription>
              Atualize as informações da pasta.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Nome da Pasta</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Digite o nome da pasta"
              />
            </div>

            <div>
              <Label htmlFor="edit-description">Descrição (opcional)</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição da pasta"
                rows={3}
              />
            </div>

            <div>
              <Label>Cor</Label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {FOLDER_COLORS.map(color => (
                  <button
                    key={color.value}
                    type="button"
                    className={`w-8 h-8 rounded ${color.class} ${
                      formData.color === color.value ? 'ring-2 ring-offset-2 ring-gray-400' : ''
                    }`}
                    onClick={() => setFormData({ ...formData, color: color.value })}
                    title={color.label}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEditFolder} disabled={!formData.name.trim()}>
              <Edit className="h-4 w-4 mr-2" />
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}; 