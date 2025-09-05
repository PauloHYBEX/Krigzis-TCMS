import { useState, useEffect } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { useAuth } from './useAuth';
import { DatabaseSetupService } from '@/services/databaseSetupService';

export function useUserSupabase() {
  const { user } = useAuth();
  const [userSupabase, setUserSupabase] = useState<SupabaseClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setUserSupabase(null);
      setLoading(false);
      return;
    }

    const loadUserSupabase = async () => {
      try {
        setLoading(true);
        setError(null);

        // Obter configuração do banco de dados do usuário
        const config = await DatabaseSetupService.getUserDatabaseConfig(user.id);
        
        if (config && config.isConfigured) {
          // Criar cliente Supabase específico do usuário
          const client = createClient(config.supabaseUrl, config.supabaseKey);
          setUserSupabase(client);
        } else {
          setUserSupabase(null);
        }
      } catch (err) {
        console.error('Error loading user Supabase client:', err);
        setError('Erro ao carregar configuração de banco de dados');
        setUserSupabase(null);
      } finally {
        setLoading(false);
      }
    };

    loadUserSupabase();
  }, [user]);

  return {
    userSupabase,
    loading,
    error,
    hasUserDatabase: !!userSupabase
  };
} 