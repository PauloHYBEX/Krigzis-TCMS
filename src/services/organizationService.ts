import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Organization = Tables<'organizations'>;
export type OrganizationMember = Tables<'organization_members'>;
export type CreateOrganizationData = TablesInsert<'organizations'>;
export type UpdateOrganizationData = TablesUpdate<'organizations'>;

export interface OrganizationWithMembers extends Organization {
  members: OrganizationMember[];
}

export interface UserOrganizationInfo {
  organization: Organization;
  member: OrganizationMember;
}

export class OrganizationService {
  // Buscar organização por ID
  static async getOrganizationById(id: string): Promise<Organization | null> {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching organization:', error);
      return null;
    }

    return data;
  }

  // Buscar organização por database_id
  static async getOrganizationByDatabaseId(databaseId: string): Promise<Organization | null> {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('database_id', databaseId)
      .single();

    if (error) {
      console.error('Error fetching organization by database_id:', error);
      return null;
    }

    return data;
  }

  // Obter organização atual do usuário
  static async getCurrentUserOrganization(): Promise<UserOrganizationInfo | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: member, error: memberError } = await supabase
        .from('organization_members')
        .select(`
          *,
          organization:organizations(*)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (memberError) {
        // Se erro 406 ou 42P01, as tabelas não existem - retornar null silenciosamente
        if (memberError.code === 'PGRST116' || memberError.code === '42P01') {
          console.log('🏢 Tabelas de organização não encontradas');
          return null;
        }
        console.error('Error fetching user organization:', memberError);
        return null;
      }

      if (!member || !member.organization) {
        return null;
      }

      return {
        organization: member.organization,
        member: {
          id: member.id,
          organization_id: member.organization_id,
          user_id: member.user_id,
          role: member.role,
          status: member.status,
          joined_at: member.joined_at,
          invited_by: member.invited_by,
          invited_at: member.invited_at,
          accepted_at: member.accepted_at
        }
      };
    } catch (error) {
      console.log('🏢 Erro ao buscar organização do usuário:', error);
      return null;
    }
  }

  // Criar nova organização
  static async createOrganization(data: CreateOrganizationData): Promise<Organization | null> {
    try {
      const { data: organization, error } = await supabase
        .from('organizations')
        .insert(data)
        .select()
        .single();

      if (error) {
        console.error('Error creating organization:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        return null;
      }

      return organization;
    } catch (error) {
      console.error('Unexpected error creating organization:', error);
      return null;
    }
  }

  // Atualizar organização
  static async updateOrganization(id: string, data: UpdateOrganizationData): Promise<Organization | null> {
    const { data: organization, error } = await supabase
      .from('organizations')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating organization:', error);
      return null;
    }

    return organization;
  }

  // Buscar membros de uma organização
  static async getOrganizationMembers(organizationId: string): Promise<OrganizationMember[]> {
    const { data, error } = await supabase
      .from('organization_members')
      .select(`
        *,
        user:profiles(display_name, email)
      `)
      .eq('organization_id', organizationId)
      .order('joined_at', { ascending: false });

    if (error) {
      console.error('Error fetching organization members:', error);
      return [];
    }

    return data;
  }

  // Adicionar usuário à organização
  static async addUserToOrganization(
    organizationId: string,
    userId: string,
    role: 'master' | 'admin' | 'manager' | 'tester' | 'viewer' = 'viewer',
    status: 'pending' | 'active' | 'suspended' = 'pending'
  ): Promise<boolean> {
    const { error } = await supabase
      .from('organization_members')
      .insert({
        organization_id: organizationId,
        user_id: userId,
        role,
        status,
        invited_by: (await supabase.auth.getUser()).data.user?.id || null
      });

    if (error) {
      console.error('Error adding user to organization:', error);
      return false;
    }

    return true;
  }

  // Atualizar papel do usuário na organização
  static async updateUserRole(
    organizationId: string,
    userId: string,
    role: 'master' | 'admin' | 'manager' | 'tester' | 'viewer'
  ): Promise<boolean> {
    const { error } = await supabase
      .from('organization_members')
      .update({ role })
      .eq('organization_id', organizationId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating user role:', error);
      return false;
    }

    return true;
  }

  // Aprovar usuário pendente
  static async approveUser(organizationId: string, userId: string): Promise<boolean> {
    const { error } = await supabase
      .from('organization_members')
      .update({ 
        status: 'active',
        accepted_at: new Date().toISOString()
      })
      .eq('organization_id', organizationId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error approving user:', error);
      return false;
    }

    return true;
  }

  // Remover usuário da organização
  static async removeUserFromOrganization(organizationId: string, userId: string): Promise<boolean> {
    const { error } = await supabase
      .from('organization_members')
      .delete()
      .eq('organization_id', organizationId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error removing user from organization:', error);
      return false;
    }

    return true;
  }

  // Buscar usuários pendentes
  static async getPendingUsers(organizationId: string): Promise<OrganizationMember[]> {
    const { data, error } = await supabase
      .from('organization_members')
      .select(`
        *,
        user:profiles(display_name, email)
      `)
      .eq('organization_id', organizationId)
      .eq('status', 'pending')
      .order('invited_at', { ascending: false });

    if (error) {
      console.error('Error fetching pending users:', error);
      return [];
    }

    return data;
  }

  // Verificar se usuário é master
  static async isUserMaster(organizationId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error) {
      console.error('Error checking user master status:', error);
      return false;
    }

    return data?.role === 'master';
  }

  // Verificar se usuário pode gerenciar organização
  static async canUserManageOrganization(organizationId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error) {
      console.error('Error checking user management permissions:', error);
      return false;
    }

    return ['master', 'admin'].includes(data?.role || '');
  }

  // Gerar ID único para database
  static generateDatabaseId(): string {
    return `db_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Criar organização padrão para usuário
  static async createDefaultOrganizationForUser(
    userId: string,
    organizationName: string = 'Minha Organização'
  ): Promise<Organization | null> {
    try {
      console.log('🏢 Criando organização padrão para usuário:', { userId, organizationName });
      
      const slug = organizationName.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .substring(0, 50);

      // Tentar usar função SQL primeiro (mais confiável para RLS)
      try {
        const { data: orgId, error: rpcError } = await supabase.rpc('create_organization_with_master', {
          org_name: organizationName,
          org_slug: slug,
          org_description: 'Organização criada automaticamente',
          user_id: userId
        });

        if (!rpcError && orgId) {
          console.log('✅ Organização criada via função SQL:', orgId);
          
          // Buscar a organização criada
          const { data: organization, error: fetchError } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', orgId)
            .single();

          if (!fetchError && organization) {
            return organization;
          }
        }
      } catch (rpcError) {
        console.log('⚠️ Função SQL não disponível, tentando método tradicional...');
      }

      // Método tradicional como fallback
      const databaseId = this.generateDatabaseId();

      const organization = await this.createOrganization({
        name: organizationName,
        slug: slug,
        database_id: databaseId,
        description: 'Organização criada automaticamente',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      if (!organization) {
        console.error('❌ Falha ao criar organização');
        return null;
      }

      // Adicionar usuário como master
      const addedToOrg = await this.addUserToOrganization(
        organization.id,
        userId,
        'master',
        'active'
      );

      if (!addedToOrg) {
        console.error('❌ Falha ao adicionar usuário como master');
        return null;
      }

      console.log('✅ Organização criada com sucesso:', organization.id);
      return organization;

    } catch (error) {
      console.error('❌ Erro ao criar organização padrão:', error);
      return null;
    }
  }

  // Associar usuário a organização existente
  static async associateUserToExistingOrganization(
    userId: string,
    databaseId: string,
    role: 'master' | 'admin' | 'manager' | 'tester' | 'viewer' = 'viewer'
  ): Promise<boolean> {
    const organization = await this.getOrganizationByDatabaseId(databaseId);
    
    if (!organization) {
      return false;
    }

    return await this.addUserToOrganization(organization.id, userId, role, 'active');
  }
} 