import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/hooks/useAuth';
import { updateProject, deleteProject } from '@/services/projectService';
import { Project } from '@/types';
import { Settings, Edit, Trash2, Archive, CheckCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ProjectManagerProps {
  project: Project;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({ project }) => {
  const { user } = useAuth();
  const { refreshProjects, setCurrentProject } = useProject();
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({
    name: project.name,
    description: project.description || '',
    color: project.color,
    status: project.status
  });

  const handleUpdateProject = async () => {
    if (!user || !formData.name.trim()) return;

    try {
      setEditing(true);
      await updateProject(project.id, {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        color: formData.color,
        status: formData.status
      });

      await refreshProjects();
      setShowEditForm(false);

      toast({
        title: 'Projeto atualizado',
        description: `O projeto "${formData.name}" foi atualizado com sucesso.`
      });
    } catch (error) {
      console.error('Erro ao atualizar projeto:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o projeto. Tente novamente.',
        variant: 'destructive'
      });
    } finally {
      setEditing(false);
    }
  };

  const handleDeleteProject = async () => {
    try {
      setDeleting(true);
      await deleteProject(project.id);
      await refreshProjects();
      setCurrentProject(null);

      toast({
        title: 'Projeto excluído',
        description: `O projeto "${project.name}" foi excluído com sucesso.`
      });
    } catch (error) {
      console.error('Erro ao excluir projeto:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o projeto. Tente novamente.',
        variant: 'destructive'
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleArchiveProject = async () => {
    try {
      await updateProject(project.id, { status: 'archived' });
      await refreshProjects();

      toast({
        title: 'Projeto arquivado',
        description: `O projeto "${project.name}" foi arquivado com sucesso.`
      });
    } catch (error) {
      console.error('Erro ao arquivar projeto:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível arquivar o projeto. Tente novamente.',
        variant: 'destructive'
      });
    }
  };

  const handleRestoreProject = async () => {
    try {
      await updateProject(project.id, { status: 'active' });
      await refreshProjects();

      toast({
        title: 'Projeto restaurado',
        description: `O projeto "${project.name}" foi restaurado com sucesso.`
      });
    } catch (error) {
      console.error('Erro ao restaurar projeto:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível restaurar o projeto. Tente novamente.',
        variant: 'destructive'
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-50 text-green-700 border-green-200';
      case 'completed': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'archived': return 'bg-gray-50 text-gray-700 border-gray-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'completed': return 'Concluído';
      case 'archived': return 'Arquivado';
      default: return status;
    }
  };

  return (
    <>
      <Dialog open={showEditForm} onOpenChange={setShowEditForm}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md border-brand/20 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-brand text-xl font-semibold">
              Gerenciar Projeto
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="project-name">Nome do Projeto</Label>
              <Input
                id="project-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="focus:border-brand/50 focus:ring-brand/20"
              />
            </div>

            <div>
              <Label htmlFor="project-description">Descrição</Label>
              <Textarea
                id="project-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="focus:border-brand/50 focus:ring-brand/20"
              />
            </div>

            <div>
              <Label htmlFor="project-color">Cor de Identificação</Label>
              <div className="flex items-center gap-3">
                <input
                  id="project-color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  className="w-12 h-10 rounded border border-brand/30 cursor-pointer focus:border-brand"
                />
                <span className="text-sm text-muted-foreground">{formData.color}</span>
              </div>
            </div>

            <div>
              <Label>Status Atual</Label>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={getStatusColor(project.status)}>
                  {getStatusLabel(project.status)}
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-4">
              {project.status === 'active' ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleArchiveProject}
                  className="flex-1 border-orange-200 text-orange-700 hover:bg-orange-50"
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Arquivar
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRestoreProject}
                  className="flex-1 border-green-200 text-green-700 hover:bg-green-50"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Restaurar
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDeleteDialog(true)}
                className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </Button>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setShowEditForm(false)}
                disabled={editing}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleUpdateProject}
                disabled={editing || !formData.name.trim()}
                className="bg-brand hover:bg-brand/90 text-white"
              >
                {editing ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Projeto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o projeto "{project.name}"? Esta ação não pode ser desfeita e todos os dados relacionados serão perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
