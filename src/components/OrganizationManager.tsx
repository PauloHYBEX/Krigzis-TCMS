import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Building2, Settings, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { OrganizationService } from '@/services/organizationService';
import { DatabaseSetupService } from '@/services/databaseSetupService';
import { useAuth } from '@/hooks/useAuth';

interface OrganizationManagerProps {
  currentOrganization?: any;
  onOrganizationChange?: () => void;
}

const OrganizationManager: React.FC<OrganizationManagerProps> = ({ 
  currentOrganization, 
  onOrganizationChange 
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showChangeDialog, setShowChangeDialog] = useState(false);
  const [formData, setFormData] = useState({
    organizationName: '',
    supabaseUrl: '',
    supabaseKey: '',
    aiApiKey: ''
  });

  const handleChangeOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Erro",
        description: "Usuário não encontrado",
        variant: "destructive",
      });
      return;
    }

    if (!formData.organizationName || !formData.supabaseUrl || !formData.supabaseKey) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Primeiro testar a conexão
      const isValid = await DatabaseSetupService.testDatabaseConnection(
        formData.supabaseUrl, 
        formData.supabaseKey
      );

      if (!isValid) {
        toast({
          title: "Conexão inválida",
          description: "Não foi possível conectar com a base de dados fornecida",
          variant: "destructive",
        });
        return;
      }

      // Configurar nova organização
      const result = await DatabaseSetupService.setupUserDatabase(user.id, {
        supabaseUrl: formData.supabaseUrl,
        supabaseKey: formData.supabaseKey,
        organizationName: formData.organizationName,
        aiApiKey: formData.aiApiKey
      });

      if (result.success) {
        toast({
          title: "Sucesso!",
          description: "Organização alterada com sucesso!",
        });
        
        setShowChangeDialog(false);
        setFormData({
          organizationName: '',
          supabaseUrl: '',
          supabaseKey: '',
          aiApiKey: ''
        });
        
        // Recarregar página para aplicar nova configuração
        if (onOrganizationChange) {
          onOrganizationChange();
        }
        
        // Aguardar um pouco e recarregar a página
        setTimeout(() => {
          window.location.reload();
        }, 1000);
        
      } else {
        toast({
          title: "Erro",
          description: result.error || "Erro ao alterar organização",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro inesperado: " + (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Organização Atual
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentOrganization ? (
          <>
            <div>
              <Label className="text-sm text-muted-foreground">Nome</Label>
              <p className="font-medium">{currentOrganization.name}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">ID da Base</Label>
              <p className="font-mono text-sm">{currentOrganization.database_id}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Status</Label>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-green-600 font-medium">Ativa</span>
              </div>
            </div>
            
            <Dialog open={showChangeDialog} onOpenChange={setShowChangeDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Settings className="h-4 w-4 mr-2" />
                  Alterar Organização
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Alterar Organização</DialogTitle>
                  <DialogDescription>
                    Configure uma nova organização ou conecte-se a uma existente.
                  </DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleChangeOrganization} className="space-y-4">
                  <div>
                    <Label htmlFor="org-name">Nome da Nova Organização *</Label>
                    <Input
                      id="org-name"
                      placeholder="Minha Nova Empresa"
                      value={formData.organizationName}
                      onChange={(e) => setFormData(prev => ({ ...prev, organizationName: e.target.value }))}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="supabase-url">URL do Supabase *</Label>
                    <Input
                      id="supabase-url"
                      type="url"
                      placeholder="https://seu-projeto.supabase.co"
                      value={formData.supabaseUrl}
                      onChange={(e) => setFormData(prev => ({ ...prev, supabaseUrl: e.target.value }))}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="supabase-key">Chave Anônima do Supabase *</Label>
                    <Input
                      id="supabase-key"
                      type="password"
                      placeholder="sua-chave-anonima-aqui"
                      value={formData.supabaseKey}
                      onChange={(e) => setFormData(prev => ({ ...prev, supabaseKey: e.target.value }))}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="ai-key">Chave da API de IA (Opcional)</Label>
                    <Input
                      id="ai-key"
                      type="password"
                      placeholder="sk-..."
                      value={formData.aiApiKey}
                      onChange={(e) => setFormData(prev => ({ ...prev, aiApiKey: e.target.value }))}
                    />
                  </div>
                  
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Ao alterar a organização, você será desconectado da organização atual e conectado à nova.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowChangeDialog(false)}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Alterar
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </>
        ) : (
          <div className="text-center py-4">
            <AlertCircle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
            <p className="text-muted-foreground">Nenhuma organização configurada</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OrganizationManager; 