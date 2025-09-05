import { supabase } from '@/integrations/supabase/client';
import { OrganizationService } from './organizationService';

export interface DatabaseSetupRequest {
  supabaseUrl: string;
  supabaseKey: string;
  organizationName: string;
  aiApiKey?: string;
  organization_id?: string;
}

export interface DatabaseSetupResult {
  success: boolean;
  message?: string;
  error?: string;
  organization_id?: string;
}

export interface UserDatabaseConfig {
  supabaseUrl: string;
  supabaseKey: string;
  databaseId: string;
  organizationName: string;
  isConfigured: boolean;
}

export interface DatabaseStatus {
  tablesExist: boolean;
  userHasOrganization: boolean;
  needsSetup: boolean;
  errorMessage?: string;
}

export class DatabaseSetupService {
  // Cache para evitar múltiplas verificações
  private static databaseStatusCache: DatabaseStatus | null = null;
  private static cacheTimestamp: number = 0;
  private static CACHE_DURATION = 30000; // 30 segundos

  // Método principal para verificar status da base de dados
  static async getDatabaseStatus(userId: string): Promise<DatabaseStatus> {
    // Verificar cache
    const now = Date.now();
    if (this.databaseStatusCache && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
      return this.databaseStatusCache;
    }

    try {
      console.log('🔍 Verificando status da base de dados...');
      
      // 1. Primeiro verificar se as tabelas básicas existem
      const tablesExist = await this.checkTablesExistSafely();
      console.log(`📊 Tabelas existem: ${tablesExist}`);

      if (!tablesExist) {
        const status: DatabaseStatus = {
          tablesExist: false,
          userHasOrganization: false,
          needsSetup: true,
          errorMessage: 'As tabelas da base de dados não existem. Execute o SQL de configuração primeiro.'
        };
        this.cacheStatus(status);
        return status;
      }

      // 2. Se as tabelas existem, verificar se o usuário tem organização
      const userHasOrganization = await this.checkUserHasOrganizationSafely(userId);
      console.log(`👤 Usuário tem organização: ${userHasOrganization}`);

      const status: DatabaseStatus = {
        tablesExist: true,
        userHasOrganization,
        needsSetup: !userHasOrganization
      };

      this.cacheStatus(status);
      return status;

    } catch (error) {
      console.error('❌ Erro ao verificar status da base:', error);
      const status: DatabaseStatus = {
        tablesExist: false,
        userHasOrganization: false,
        needsSetup: true,
        errorMessage: 'Erro ao conectar com a base de dados: ' + (error as Error).message
      };
      this.cacheStatus(status);
      return status;
    }
  }

  // Verificação segura se as tabelas existem (sem gerar erros 406)
  private static async checkTablesExistSafely(): Promise<boolean> {
    try {
      console.log('🔍 Verificando se tabelas existem...');
      
      // Tentar queries simples em tabelas essenciais
      const checks = await Promise.allSettled([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('organizations').select('id', { count: 'exact', head: true }),
        supabase.from('organization_members').select('id', { count: 'exact', head: true })
      ]);

      // Verificar se pelo menos uma tabela existe e é acessível
      const hasAccessibleTable = checks.some(result => {
        if (result.status === 'fulfilled') {
          const { error } = result.value;
          // Se não há erro, ou se o erro é apenas "no rows", a tabela existe
          return !error || error.code === 'PGRST116';
        }
        return false;
      });

      console.log('📊 Tabelas acessíveis:', hasAccessibleTable);
      return hasAccessibleTable;
      
    } catch (error) {
      console.log('📋 Erro ao verificar tabelas:', error);
      return false;
    }
  }

  // Verificação segura se o usuário tem organização
  private static async checkUserHasOrganizationSafely(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('organization_members')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .limit(1);

      // Se a query funciona e retorna dados, o usuário tem organização
      return !error && data && data.length > 0;
    } catch (error) {
      console.log('👤 Erro ao verificar organização do usuário:', error);
      return false;
    }
  }

  // Cache do status
  private static cacheStatus(status: DatabaseStatus): void {
    this.databaseStatusCache = status;
    this.cacheTimestamp = Date.now();
  }

  // Limpar cache (para forçar nova verificação)
  static clearCache(): void {
    this.databaseStatusCache = null;
    this.cacheTimestamp = 0;
  }

  // Método legacy (mantido para compatibilidade)
  static async needsDatabaseSetup(userId: string): Promise<boolean> {
    const status = await this.getDatabaseStatus(userId);
    return status.needsSetup;
  }

  // Verificar se as tabelas básicas existem
  static async checkBasicTablesExist(): Promise<boolean> {
    const status = await this.getDatabaseStatus('temp');
    return status.tablesExist;
  }

  // Obter configuração atual do Supabase (para mostrar na aba Sobre)
  static getCurrentSupabaseConfig(): { url: string; isDemo: boolean } {
    // Obter URL do ambiente ou usar valor padrão
    const currentUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mhhzdykyjgrnprcyhlbz.supabase.co';
    
    // Verificar se é uma instância demo/exemplo
    const isDemo = currentUrl.includes('demo') || 
                   currentUrl.includes('example') || 
                   currentUrl.includes('test') ||
                   currentUrl === 'https://mhhzdykyjgrnprcyhlbz.supabase.co';
    
    return {
      url: currentUrl,
      isDemo
    };
  }

  // Configurar base de dados para o usuário
  static async setupUserDatabase(userId: string, data: DatabaseSetupRequest): Promise<DatabaseSetupResult> {
    try {
      console.log('⚙️ Iniciando configuração da base de dados...');
      
      // Limpar cache para forçar nova verificação
      this.clearCache();

      // Primeiro validar se a nova base tem as tabelas necessárias
      const isValid = await this.validateDatabaseStructure(data.supabaseUrl, data.supabaseKey);
      
      if (!isValid) {
        return {
          success: false,
          error: 'A base de dados não possui as tabelas necessárias. Por favor, execute as migrações SQL primeiro.'
        };
      }

      // Verificar se já existe uma organização para este usuário
      const status = await this.getDatabaseStatus(userId);
      if (status.userHasOrganization) {
        return {
          success: false,
          error: 'Usuário já possui uma base de dados configurada'
        };
      }

      // Criar nova organização
      const organization = await OrganizationService.createDefaultOrganizationForUser(
        userId,
        data.organizationName
      );

      if (!organization) {
        return {
          success: false,
          error: 'Erro ao criar organização'
        };
      }

      // Atualizar organização com dados do Supabase (via settings)
      const updatedOrg = await OrganizationService.updateOrganization(organization.id, {
        settings: {
          supabase_url: data.supabaseUrl,
          supabase_key: data.supabaseKey,
          ai_api_key: data.aiApiKey || null
        },
        updated_at: new Date().toISOString()
      });

      if (!updatedOrg) {
        return {
          success: false,
          error: 'Erro ao configurar dados da organização'
        };
      }

      // Limpar cache após configuração bem-sucedida
      this.clearCache();

      console.log('✅ Base de dados configurada com sucesso!');
      return {
        success: true,
        message: 'Base de dados configurada com sucesso!',
        organization_id: organization.id
      };

    } catch (error) {
      console.error('❌ Erro ao configurar base de dados:', error);
      return {
        success: false,
        error: 'Erro inesperado ao configurar base de dados: ' + (error as Error).message
      };
    }
  }

  // Obter configuração da base de dados do usuário
  static async getUserDatabaseConfig(userId: string): Promise<UserDatabaseConfig | null> {
    try {
      const status = await this.getDatabaseStatus(userId);
      
      if (!status.tablesExist || !status.userHasOrganization) {
        return null;
      }

      const userOrg = await OrganizationService.getCurrentUserOrganization();
      if (!userOrg) {
        return null;
      }

      const settings = userOrg.organization.settings as Record<string, unknown> || {};

      return {
        supabaseUrl: (settings.supabase_url as string) || '',
        supabaseKey: (settings.supabase_key as string) || '',
        databaseId: userOrg.organization.database_id,
        organizationName: userOrg.organization.name,
        isConfigured: true
      };

    } catch (error) {
      console.error('Error getting user database config:', error);
      return null;
    }
  }

  // Remover configuração da base de dados
  static async removeDatabaseConfig(userId: string): Promise<boolean> {
    try {
      const userOrg = await OrganizationService.getCurrentUserOrganization();
      
      if (!userOrg) {
        return false;
      }

      // Remover usuário da organização
      const removed = await OrganizationService.removeUserFromOrganization(
        userOrg.organization.id,
        userId
      );

      if (removed) {
        this.clearCache();
      }

      return removed;

    } catch (error) {
      console.error('Error removing database config:', error);
      return false;
    }
  }

  // Testar conexão com a base de dados
  static async testDatabaseConnection(supabaseUrl: string, supabaseKey: string): Promise<boolean> {
    try {
      // Criar cliente temporário para teste
      const { createClient } = await import('@supabase/supabase-js');
      const testClient = createClient(supabaseUrl, supabaseKey);

      // Testar conexão básica
      const { error } = await testClient.from('profiles').select('count').limit(1);
      
      return !error;

    } catch (error) {
      console.error('Error testing database connection:', error);
      return false;
    }
  }

  // Verificar se as tabelas necessárias existem
  static async validateDatabaseStructure(supabaseUrl: string, supabaseKey: string): Promise<boolean> {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const testClient = createClient(supabaseUrl, supabaseKey);

      // Verificar se tabelas principais existem
      const requiredTables = ['profiles', 'organizations', 'organization_members', 'user_permissions'];
      
      for (const table of requiredTables) {
        const { error } = await testClient.from(table).select('*').limit(1);
        if (error) {
          console.error(`Table ${table} not found or accessible:`, error);
          return false;
        }
      }

      return true;

    } catch (error) {
      console.error('Error validating database structure:', error);
      return false;
    }
  }

  // Obter estatísticas da base de dados
  static async getDatabaseStatistics(): Promise<{
    totalUsers: number;
    totalOrganizations: number;
    totalTests: number;
  }> {
    try {
      const status = await this.getDatabaseStatus('temp');
      
      if (!status.tablesExist) {
        return {
          totalUsers: 0,
          totalOrganizations: 0,
          totalTests: 0
        };
      }

      const [usersCount, orgsCount, testsCount] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('organizations').select('id', { count: 'exact', head: true }),
        supabase.from('test_plans').select('id', { count: 'exact', head: true })
      ]);

      return {
        totalUsers: usersCount.count || 0,
        totalOrganizations: orgsCount.count || 0,
        totalTests: testsCount.count || 0
      };

    } catch (error) {
      console.error('Error getting database statistics:', error);
      return {
        totalUsers: 0,
        totalOrganizations: 0,
        totalTests: 0
      };
    }
  }
} 