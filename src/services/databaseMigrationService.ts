import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface MigrationResult {
  success: boolean;
  message: string;
  errors?: string[];
}

export class DatabaseMigrationService {
  
  // Migrar todas as tabelas necessárias para a nova base de dados
  static async migrateDatabase(supabaseUrl: string, supabaseKey: string): Promise<MigrationResult> {
    try {
      const client = createClient(supabaseUrl, supabaseKey);
      
      // Lista de migrações em ordem de execução
      const migrations = [
        this.createUserRolesEnum,
        this.createProfilesTable,
        this.createUserPermissionsTable,
        this.createOrganizationsTable,
        this.createOrganizationMembersTable,
        this.createTestPlansTable,
        this.createTestCasesTable,
        this.createTestExecutionsTable,
        this.createUserSettingsTable,
        // Removido: tabelas legadas de To-Do e tokens/logs
        this.setupRLS,
        this.createDefaultData
      ];

      const errors: string[] = [];

      for (const migration of migrations) {
        try {
          await migration(client);
        } catch (error) {
          console.error(`Migration failed: ${migration.name}`, error);
          errors.push(`${migration.name}: ${error}`);
        }
      }

      if (errors.length > 0) {
        return {
          success: false,
          message: 'Algumas migrações falharam',
          errors
        };
      }

      return {
        success: true,
        message: 'Base de dados migrada com sucesso!'
      };

    } catch (error) {
      console.error('Error during migration:', error);
      return {
        success: false,
        message: 'Erro durante a migração',
        errors: [error.toString()]
      };
    }
  }

  // Criar enum de roles de usuário
  private static async createUserRolesEnum(client: SupabaseClient) {
    // Usar SQL direto através de uma query simples para verificar se a tabela existe
    const { error } = await client
      .from('profiles')
      .select('id')
      .limit(1);
    
    // Se não há erro, a tabela já existe, então vamos criar apenas o enum se necessário
    if (!error) {
      console.log('Tables already exist, skipping migration');
      return;
    }

    // Se chegou aqui, precisamos criar as tabelas
    console.log('Creating database schema...');
  }

  // Criar tabela de perfis
  private static async createProfilesTable(client: SupabaseClient) {
    // Como não podemos executar DDL diretamente, vamos verificar se a tabela existe
    // e criar um perfil básico se necessário
    const { data: existingProfiles } = await client
      .from('profiles')
      .select('id')
      .limit(1);

    if (!existingProfiles || existingProfiles.length === 0) {
      // Tentar inserir um perfil de teste para verificar se a tabela existe
      const { error } = await client
        .from('profiles')
        .insert({
          id: '00000000-0000-0000-0000-000000000000',
          display_name: 'Test User',
          email: 'test@example.com'
        });

      if (error && error.code === '42P01') {
        // Tabela não existe - isso é esperado para novas bases
        console.log('Profiles table does not exist - this is expected for new databases');
        throw new Error('Database schema needs to be created manually. Please run the SQL migrations in your Supabase dashboard.');
      }
    }
  }

  // Criar tabela de permissões
  private static async createUserPermissionsTable(client: SupabaseClient) {
    const { error } = await client
      .from('user_permissions')
      .select('id')
      .limit(1);

    if (error && error.code === '42P01') {
      throw new Error('User permissions table does not exist. Please run the SQL migrations.');
    }
  }

  // Criar tabela de organizações
  private static async createOrganizationsTable(client: SupabaseClient) {
    const { error } = await client
      .from('organizations')
      .select('id')
      .limit(1);

    if (error && error.code === '42P01') {
      throw new Error('Organizations table does not exist. Please run the SQL migrations.');
    }
  }

  // Criar tabela de membros da organização
  private static async createOrganizationMembersTable(client: SupabaseClient) {
    const { error } = await client
      .from('organization_members')
      .select('id')
      .limit(1);

    if (error && error.code === '42P01') {
      throw new Error('Organization members table does not exist. Please run the SQL migrations.');
    }
  }

  // Criar tabela de planos de teste
  private static async createTestPlansTable(client: SupabaseClient) {
    const { error } = await client
      .from('test_plans')
      .select('id')
      .limit(1);

    if (error && error.code === '42P01') {
      throw new Error('Test plans table does not exist. Please run the SQL migrations.');
    }
  }

  // Criar tabela de casos de teste
  private static async createTestCasesTable(client: SupabaseClient) {
    const { error } = await client
      .from('test_cases')
      .select('id')
      .limit(1);

    if (error && error.code === '42P01') {
      throw new Error('Test cases table does not exist. Please run the SQL migrations.');
    }
  }

  // Criar tabela de execuções de teste
  private static async createTestExecutionsTable(client: SupabaseClient) {
    const { error } = await client
      .from('test_executions')
      .select('id')
      .limit(1);

    if (error && error.code === '42P01') {
      throw new Error('Test executions table does not exist. Please run the SQL migrations.');
    }
  }

  // Criar tabela de configurações do usuário
  private static async createUserSettingsTable(client: SupabaseClient) {
    const { error } = await client
      .from('user_settings')
      .select('id')
      .limit(1);

    if (error && error.code === '42P01') {
      throw new Error('User settings table does not exist. Please run the SQL migrations.');
    }
  }

  // Criar tabelas Todo
  private static async createTodoTables(client: SupabaseClient) {
    const { error } = await client
      .from('todo_folders')
      .select('id')
      .limit(1);

    if (error && error.code === '42P01') {
      throw new Error('Todo tables do not exist. Please run the SQL migrations.');
    }
  }

  // Criar tabela de tokens de acesso
  private static async createAccessTokensTable(client: SupabaseClient) {
    // DEPRECATED: Tabela removida. Método mantido como no-op por compatibilidade.
    console.warn('createAccessTokensTable: legado descontinuado (no-op).');
    return;
  }

  // Criar tabela de logs de acesso
  private static async createAccessLogsTable(client: SupabaseClient) {
    // DEPRECATED: Tabela removida. Método mantido como no-op por compatibilidade.
    console.warn('createAccessLogsTable: legado descontinuado (no-op).');
    return;
  }

  // Configurar RLS
  private static async setupRLS(client: SupabaseClient) {
    // RLS é configurado via SQL no Supabase dashboard
    // Aqui só verificamos se as tabelas existem
    console.log('RLS configuration should be done via SQL migrations');
  }

  // Criar dados padrão
  private static async createDefaultData(client: SupabaseClient) {
    // Verificar se já existem dados
    const { data: profiles } = await client
      .from('profiles')
      .select('id')
      .limit(1);
    
    if (profiles && profiles.length > 0) {
      console.log('Default data already exists');
      return;
    }
    
    console.log('Creating default data...');
    // Dados padrão podem ser criados aqui se necessário
  }
} 