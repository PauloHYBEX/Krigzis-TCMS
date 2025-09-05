import { supabase } from '@/integrations/supabase/client';
import { Project } from '@/types';

// Criar projeto
export const createProject = async (projectData: {
  name: string;
  slug: string;
  description?: string;
  color?: string;
  user_id: string;
}): Promise<Project> => {
  const { data, error } = await supabase
    .from('projects')
    .insert([{
      ...projectData,
      color: projectData.color || '#3b82f6'
    }])
    .select()
    .single();

  if (error) throw error;
  
  return {
    ...data,
    created_at: new Date(data.created_at),
    updated_at: new Date(data.updated_at)
  };
};

// Listar projetos do usuário
export const getProjects = async (): Promise<Project[]> => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data.map(project => ({
    ...project,
    created_at: new Date(project.created_at),
    updated_at: new Date(project.updated_at)
  }));
};

// Buscar projeto por ID
export const getProjectById = async (id: string): Promise<Project | null> => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  if (!data) return null;

  return {
    ...data,
    created_at: new Date(data.created_at),
    updated_at: new Date(data.updated_at)
  };
};

// Atualizar projeto
export const updateProject = async (id: string, updates: Partial<{
  name: string;
  slug: string;
  description: string;
  status: 'active' | 'archived' | 'completed';
  color: string;
}>): Promise<Project> => {
  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  return {
    ...data,
    created_at: new Date(data.created_at),
    updated_at: new Date(data.updated_at)
  };
};

// Excluir projeto
export const deleteProject = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

// Buscar projetos ativos
export const getActiveProjects = async (): Promise<Project[]> => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('status', 'active')
    .order('name', { ascending: true });

  if (error) throw error;

  return data.map(project => ({
    ...project,
    created_at: new Date(project.created_at),
    updated_at: new Date(project.updated_at)
  }));
};

// Gerar slug a partir do nome
export const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove caracteres especiais
    .replace(/[\s_-]+/g, '-') // Substitui espaços e underscores por hífens
    .replace(/^-+|-+$/g, ''); // Remove hífens do início e fim
};

// Verificar se slug já existe
export const checkSlugExists = async (slug: string, excludeId?: string): Promise<boolean> => {
  let query = supabase
    .from('projects')
    .select('id')
    .eq('slug', slug);

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data.length > 0;
};
