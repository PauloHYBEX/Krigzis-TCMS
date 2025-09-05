import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/hooks/useAuth';
import { createProject, generateSlug, checkSlugExists } from '@/services/projectService';
import { Project } from '@/types';
import { Plus, FolderOpen, Settings } from 'lucide-react';
import { ProjectManager } from '@/components/ProjectManager';
import { toast } from '@/hooks/use-toast';

export const ProjectSelector: React.FC = () => {
  const { user } = useAuth();
  const { currentProject, projects, setCurrentProject, refreshProjects } = useProject();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '', 
    color: '#3b82f6'
  });

  const handleCreateProject = async () => {
    if (!user || !formData.name.trim()) return;
    
    try {
      setCreating(true);
      
      // Gerar slug único
      let slug = generateSlug(formData.name);
      let counter = 1;
      while (await checkSlugExists(slug)) {
        slug = `${generateSlug(formData.name)}-${counter}`;
        counter++;
      }

      const newProject = await createProject({
        name: formData.name.trim(),
        slug,
        description: formData.description.trim() || undefined,
        color: formData.color,
        user_id: user.id
      });

      await refreshProjects();
      setCurrentProject(newProject);
      setShowCreateForm(false);
      setFormData({ name: '', description: '', color: '#3b82f6' });
      
      toast({
        title: 'Projeto criado',
        description: `O projeto "${newProject.name}" foi criado com sucesso.`
      });
    } catch (error) {
      console.error('Erro ao criar projeto:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o projeto. Tente novamente.',
        variant: 'destructive'
      });
    } finally {
      setCreating(false);
    }
  };

  const handleProjectChange = (projectId: string) => {
    if (projectId === 'all') {
      setCurrentProject(null);
      toast({ title: 'Filtro aplicado', description: 'Exibindo dados de todos os projetos.' });
      return;
    }
    const project = projects.find(p => p.id === projectId);
    setCurrentProject(project || null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'completed': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'archived': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
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
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <FolderOpen className="h-4 w-4 text-muted-foreground" />
        <Select value={currentProject?.id || 'all'} onValueChange={handleProjectChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Selecione um projeto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <div className="flex items-center gap-2">
                <span>Todos os projetos</span>
              </div>
            </SelectItem>
            {projects.length === 0 ? (
              <div className="p-2 text-sm text-muted-foreground text-center">
                Nenhum projeto disponível
              </div>
            ) : (
              projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: project.color }}
                    />
                    <span>{project.name}</span>
                    <Badge variant="outline" className={getStatusColor(project.status)}>
                      {getStatusLabel(project.status)}
                    </Badge>
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Novo Projeto
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md border-brand/20 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-brand text-xl font-semibold">Criar Novo Projeto</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="project-name">Nome do Projeto *</Label>
              <Input
                id="project-name"
                placeholder="Ex: Sistema de Vendas"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="focus:border-brand/50 focus:ring-brand/20"
              />
            </div>

            <div>
              <Label htmlFor="project-description">Descrição</Label>
              <Textarea
                id="project-description"
                placeholder="Descrição opcional do projeto..."
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

            <div className="flex justify-end gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setShowCreateForm(false)}
                disabled={creating}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleCreateProject}
                disabled={creating || !formData.name.trim()}
                className="bg-brand hover:bg-brand/90 text-white"
              >
                {creating ? 'Criando...' : 'Criar Projeto'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
