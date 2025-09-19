import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Check, Edit, Trash2, Plus, Save, RefreshCcw, Sparkles, Zap, Loader2, CheckCircle, XCircle, FileText, Copy } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { PermissionGuard } from '@/components/PermissionGuard';
import { AIModel, AIPromptTemplate, AIModelTask, AIModelConfig } from '@/types';
import * as ModelControlService from '@/services/modelControlService';
import { generateText } from '@/integrations/gemini/client';
import { openAIGenerateText } from '@/integrations/openai/client';
import { anthropicGenerateText } from '@/integrations/anthropic/client';
import { groqGenerateText } from '@/integrations/groq/client';
import { ollamaGenerateText } from '@/integrations/ollama/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export const ModelControlPanel = () => {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<AIModelConfig | null>(null);
  // Seções colapsáveis por tema
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    models: false,
    templates: false,
    tests: false,
  });
  const [activeTab, setActiveTab] = useState<'models' | 'templates' | 'tests'>('models');

  useEffect(() => {
    // Abre "Modelos" por padrão quando a página é montada
    setOpenSections({ models: true, templates: false, tests: false });
  }, []);

  // Form states
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [modelForm, setModelForm] = useState<Partial<AIModel>>({});
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState<Partial<AIPromptTemplate>>({});
  
  // Capabilities editor state
  const [capabilityInput, setCapabilityInput] = useState('');
  // API key input UX
  const [showApiKey, setShowApiKey] = useState(false);
  
  // API test states
  const [testPrompt, setTestPrompt] = useState('Diga olá em português.');
  const [testApiKey, setTestApiKey] = useState('');
  const [testModelId, setTestModelId] = useState<string>('auto');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    response?: string;
    error?: string;
    modelUsed?: string;
  } | null>(null);

  // Template filters
  const [templateFilterTask, setTemplateFilterTask] = useState<string>('all');
  const [templateFilterStatus, setTemplateFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  // Load configuration
  useEffect(() => {
    if (user) {
      loadConfig();
    }
  }, [user]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      // First load from local storage
      let localConfig = ModelControlService.loadConfig();
      
      // Then try to load from Supabase (if user is authenticated)
      if (user) {
        try {
          const remoteConfig = await ModelControlService.loadMCPConfigFromSupabase(user.id);
          if (remoteConfig) {
            localConfig = remoteConfig;
            // Save to local storage
            ModelControlService.saveConfig(remoteConfig);
          }
        } catch (error) {
          console.error('Error loading from Supabase:', error);
          // Continue with local config
        }
      }
      
      setConfig(localConfig);
    } catch (error) {
      console.error('Error loading config:', error);
    } finally {
      setLoading(false);
    }
  };

  // Quick actions
  const testModelQuick = async (m: AIModel) => {
    setActiveTab('tests');
    setOpenSections({ models: false, templates: false, tests: true });
    await testApiConnection(m.id);
  };

  const duplicateTemplate = (template: AIPromptTemplate) => {
    if (!config) return;
    const newTpl = ModelControlService.addPromptTemplate({
      name: `${template.name} (Cópia)`,
      task: template.task,
      template: template.template,
      description: template.description,
      parameters: template.parameters,
      active: template.active,
    });
    setConfig({ ...config, promptTemplates: [...config.promptTemplates, newTpl] });
  };

  const toggleTemplateActive = (template: AIPromptTemplate) => {
    if (!config) return;
    const updated = ModelControlService.updatePromptTemplate(template.id, { active: !template.active });
    if (updated) {
      setConfig({
        ...config,
        promptTemplates: config.promptTemplates.map(t => t.id === updated.id ? updated : t)
      });
    }
  };

  const testTemplateQuick = (template: AIPromptTemplate) => {
    // Render preview with simple variable placeholders
    const params = template.parameters || [];
    let out = template.template || '';
    params.forEach(p => {
      try {
        const re = new RegExp(`\\{{${p}\\}}`, 'g');
        out = out.replace(re, `<${p}>`);
      } catch { /* noop */ }
    });
    setTestPrompt(out);
    setActiveTab('tests');
    setOpenSections({ models: false, templates: false, tests: true });
  };

  // Save configuration
  const saveConfigToSupabase = async () => {
    if (!user || !config) return;
    
    try {
      await ModelControlService.saveMCPConfigToSupabase(user.id, config);
      ModelControlService.saveApiKeys(config);
      alert('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Error saving config to Supabase:', error);
      alert('Erro ao salvar configurações.');
    }
  };

  // Reset configuration
  const resetConfig = () => {
    if (window.confirm('Tem certeza que deseja redefinir todas as configurações para o padrão?')) {
      // Clear localStorage to force reload of default config
      localStorage.removeItem('mcp_config');
      const defaultConfig = ModelControlService.resetConfig();
      setConfig(defaultConfig);
      
      // Also reload the page to ensure fresh state
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  };

  // Model operations
  const startEditingModel = (model: AIModel) => {
    setEditingModelId(model.id);
    setModelForm({ ...model });
  };

  const startAddingModel = () => {
    setEditingModelId('new');
    setModelForm({
      name: '',
      provider: 'gemini',
      description: '',
      version: '1.0',
      capabilities: [],
      active: true,
      settings: {}
    });
  };

  const cancelEditingModel = () => {
    setEditingModelId(null);
    setModelForm({});
  };

  const saveModel = () => {
    if (!config) return;
    
    if (editingModelId === 'new') {
      // Add new model
      ModelControlService.addModel(modelForm as Omit<AIModel, 'id'>);
      // Recarrega do serviço para garantir consistência com quaisquer efeitos colaterais
      const fresh = ModelControlService.loadConfig();
      setConfig(fresh);
    } else {
      // Update existing model
      const updatedModel = ModelControlService.updateModel(editingModelId!, modelForm);
      if (updatedModel) {
        // Recarrega do serviço para refletir a alteração persistida
        const fresh = ModelControlService.loadConfig();
        setConfig(fresh);
      }
    }
    
    cancelEditingModel();
  };

  const deleteModel = (modelId: string) => {
    if (!config || !window.confirm('Tem certeza que deseja excluir este modelo?')) return;
    
    const deleted = ModelControlService.deleteModel(modelId);
    if (deleted) {
      // O serviço também atualiza tasks e defaultModel quando necessário; recarregar garante a UI correta
      const fresh = ModelControlService.loadConfig();
      setConfig(fresh);
    }
  };

  // Template operations
  const startEditingTemplate = (template: AIPromptTemplate) => {
    setEditingTemplateId(template.id);
    setTemplateForm({ ...template });
  };

  const startAddingTemplate = () => {
    setEditingTemplateId('new');
    setTemplateForm({
      name: '',
      task: 'test-plan-generation',
      template: '',
      description: '',
      parameters: [],
      active: true
    });
  };

  const cancelEditingTemplate = () => {
    setEditingTemplateId(null);
    setTemplateForm({});
  };

  const saveTemplate = () => {
    if (!config) return;
    
    if (editingTemplateId === 'new') {
      // Add new template
      const newTemplate = ModelControlService.addPromptTemplate(templateForm as Omit<AIPromptTemplate, 'id' | 'createdAt' | 'updatedAt'>);
      setConfig({
        ...config,
        promptTemplates: [...config.promptTemplates, newTemplate]
      });
    } else {
      // Update existing template
      const updatedTemplate = ModelControlService.updatePromptTemplate(editingTemplateId!, templateForm);
      if (updatedTemplate) {
        setConfig({
          ...config,
          promptTemplates: config.promptTemplates.map(t => t.id === updatedTemplate.id ? updatedTemplate : t)
        });
      }
    }
    
    cancelEditingTemplate();
  };

  const deleteTemplate = (templateId: string) => {
    if (!config || !window.confirm('Tem certeza que deseja excluir este template?')) return;
    
    const deleted = ModelControlService.deletePromptTemplate(templateId);
    if (deleted) {
      setConfig({
        ...config,
        promptTemplates: config.promptTemplates.filter(t => t.id !== templateId)
      });
    }
  };

  // Set default model for a task
  const setDefaultModelForTask = (task: AIModelTask, modelId: string) => {
    if (!config) return;
    
    ModelControlService.setDefaultModelForTask(task, modelId);
    setConfig({
      ...config,
      tasks: {
        ...config.tasks,
        [task]: modelId
      }
    });
  };

  // API testing helpers
  const resolveModelForTest = () => {
    if (!config) return undefined;
    if (testModelId === 'auto' || !testModelId) {
      const defaultId = config.tasks['general-completion'];
      const byTask = config.models.find(m => m.id === defaultId && m.active);
      if (byTask) return byTask;
      return config.models.find(m => m.active);
    }
    return config.models.find(m => m.id === testModelId);
  };

  const providerRequiresApiKey = (provider: AIModel['provider']) => provider !== 'ollama';

  const providerLabel = (provider: AIModel['provider']) => {
    const map: Record<string, string> = {
      gemini: 'Gemini',
      openai: 'OpenAI',
      anthropic: 'Anthropic',
      groq: 'Groq',
      ollama: 'Ollama',
      other: 'Modelo'
    };
    return map[provider] || 'Modelo';
  };

  // Sugestões de slugs por provedor (para facilitar testes)
  const providerModelSuggestions = (provider: AIModel['provider']): string[] => {
    switch (provider) {
      case 'groq':
        return ['llama-3.1-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'];
      case 'openai':
        return ['gpt-4o-mini', 'gpt-4o'];
      case 'anthropic':
        return ['claude-3-5-sonnet-20240620', 'claude-3-haiku-20240307'];
      case 'ollama':
        return ['llama3:8b', 'qwen2.5:7b-instruct'];
      default:
        return [];
    }
  };

  const getCurrentApiKey = () => {
    const model = resolveModelForTest();
    return model?.apiKey || '';
  };

  const testApiConnection = async (overrideModelId?: string) => {
    setTestLoading(true);
    setTestResult(null);

    try {
      const model = overrideModelId && config
        ? config.models.find(m => m.id === overrideModelId)
        : resolveModelForTest();
      if (!model) {
        throw new Error('Nenhum modelo ativo selecionado para teste');
      }

      // Update API key in config if provided and required
      if (testApiKey.trim() && config && providerRequiresApiKey(model.provider)) {
        const idx = config.models.findIndex(m => m.id === model.id);
        if (idx !== -1) {
          const updatedConfig: AIModelConfig = { ...config, models: [...config.models] };
          updatedConfig.models[idx] = { ...updatedConfig.models[idx], apiKey: testApiKey.trim() } as AIModel;
          setConfig(updatedConfig);
          ModelControlService.saveConfig(updatedConfig);
        }
      }

      // Call provider client
      let responseText = '';
      const baseUrl = typeof model.settings?.baseUrl === 'string' ? model.settings.baseUrl : undefined;
      const apiModelName = (typeof model.settings?.apiModel === 'string' && model.settings.apiModel.trim())
        ? model.settings.apiModel.trim()
        : model.id;

      switch (model.provider) {
        case 'gemini':
          responseText = await generateText(testPrompt, model.id);
          break;
        case 'openai':
          responseText = await openAIGenerateText(testPrompt, apiModelName, model.apiKey || testApiKey.trim());
          break;
        case 'anthropic':
          responseText = await anthropicGenerateText(testPrompt, apiModelName, model.apiKey || testApiKey.trim());
          break;
        case 'groq':
          responseText = await groqGenerateText(testPrompt, apiModelName, model.apiKey || testApiKey.trim());
          break;
        case 'ollama':
          responseText = await ollamaGenerateText(testPrompt, apiModelName, baseUrl);
          break;
        default:
          throw new Error(`Provedor não suportado: ${model.provider}`);
      }

      setTestResult({
        success: true,
        message: 'Conexão com a API estabelecida com sucesso!',
        response: responseText.substring(0, 300) + (responseText.length > 300 ? '...' : ''),
        modelUsed: model.name
      });
    } catch (error: any) {
      const modelName = resolveModelForTest()?.name;
      setTestResult({
        success: false,
        message: 'Falha na conexão com a API',
        error: error.message,
        modelUsed: modelName
      });
    } finally {
      setTestLoading(false);
    }
  };

  // Render loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <PermissionGuard requiredPermission="can_access_model_control">
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Model Control Panel</h2>
          <p className="text-gray-600 dark:text-gray-400">Gerenciamento de modelos e templates de IA</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetConfig} className="flex items-center gap-2">
            <RefreshCcw className="h-4 w-4" /> Redefinir
          </Button>
          <Button onClick={saveConfigToSupabase} className="flex items-center gap-2">
            <Save className="h-4 w-4" /> Salvar
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          const val = (v as 'models' | 'templates' | 'tests');
          setActiveTab(val);
          setOpenSections({
            models: val === 'models',
            templates: val === 'templates',
            tests: val === 'tests',
          });
        }}
      >
        <TabsList className="bg-gray-100 dark:bg-gray-800">
          <TabsTrigger value="models">Modelos</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="tests">Testes</TabsTrigger>
        </TabsList>

        {/* Seção: Modelos */}
        <TabsContent value="models">
      <Collapsible
        open={openSections.models}
        onOpenChange={() => setOpenSections(s => ({ ...s, models: !s.models }))}
        className="border rounded-lg"
      >
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold">Modelos</h3>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Gerenciamento</Badge>
              <Button
                size="sm"
                className="flex items-center gap-1"
                onClick={(e) => { e.stopPropagation(); startAddingModel(); }}
                disabled={!hasPermission('can_configure_ai_models')}
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Adicionar Modelo</span>
              </Button>
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="p-4 pt-0 space-y-4">
          {/* Gemini Models Quick Toggle Section */}
          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                Modelos de IA
                <Badge className="bg-blue-100 text-blue-800">Múltiplos Provedores</Badge>
              </CardTitle>
              <CardDescription>
                Ative/desative rapidamente os modelos disponíveis. Use "Editar" para configurar chaves/API e capacidades.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {config?.models.map(model => (
                  <div key={model.id} className="flex items-center justify-between p-4 border rounded-lg bg-white dark:bg-gray-900">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{model.name}</h4>
                        <Badge variant="outline">{providerLabel(model.provider)}</Badge>
                        {model.version === '2.0-exp' && (
                          <Badge variant="outline" className="text-purple-600 border-purple-600">Experimental</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{model.description}</p>
                      <div className="flex gap-1 mt-2">
                        {model.capabilities.slice(0, 3).map(cap => (
                          <Badge key={cap} variant="outline" className="text-xs">
                            {cap.replace('-', ' ')}
                          </Badge>
                        ))}
                        {model.capabilities.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{model.capabilities.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={model.active}
                        onCheckedChange={(checked) => {
                          // Persiste alteração e recarrega do serviço
                          ModelControlService.updateModel(model.id, { active: checked });
                          const fresh = ModelControlService.loadConfig();
                          setConfig(fresh);
                        }}
                        disabled={!hasPermission('can_configure_ai_models')}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEditingModel(model)}
                        className="text-gray-500 hover:text-gray-700"
                        disabled={!hasPermission('can_configure_ai_models')}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteModel(model.id)}
                        className="text-gray-500 hover:text-red-600"
                        disabled={!hasPermission('can_configure_ai_models')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Task Assignment for Gemini Models */}
              <div className="mt-6 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  Atribuição Otimizada de Tarefas
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Geração de Planos:</span>
                      <span className="font-medium">
                        {config?.models.find(m => m.id === (config?.tasks['test-plan-generation'] as string))?.name || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Geração de Casos:</span>
                      <span className="font-medium">
                        {config?.models.find(m => m.id === (config?.tasks['test-case-generation'] as string))?.name || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Detecção de Bugs:</span>
                      <span className="font-medium">
                        {config?.models.find(m => m.id === (config?.tasks['bug-detection'] as string))?.name || '—'}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Análise de Código:</span>
                      <span className="font-medium">
                        {config?.models.find(m => m.id === (config?.tasks['code-analysis'] as string))?.name || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Completion Geral:</span>
                      <span className="font-medium">
                        {config?.models.find(m => m.id === (config?.tasks['general-completion'] as string))?.name || '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          

          {editingModelId === 'new' && (
            <Card className="mt-4 border-dashed">
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="new-model-name">Nome</Label>
                    <Input 
                      id="new-model-name" 
                      value={modelForm.name || ''}
                      onChange={e => setModelForm({...modelForm, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="new-model-provider">Provedor</Label>
                    <Select 
                      value={modelForm.provider} 
                      onValueChange={value => {
                        const provider = value as AIModel['provider'];
                        const suggestions = providerModelSuggestions(provider);
                        const currentSlug = (modelForm.settings?.apiModel as string) || '';
                        setModelForm(prev => ({
                          ...prev,
                          provider,
                          settings: !currentSlug && suggestions[0]
                            ? { ...(prev.settings || {}), apiModel: suggestions[0] }
                            : (prev.settings || undefined)
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o provedor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gemini">Google Gemini</SelectItem>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                        <SelectItem value="groq">Groq</SelectItem>
                        <SelectItem value="ollama">Ollama</SelectItem>
                        <SelectItem value="other">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="new-model-description">Descrição</Label>
                  <Textarea 
                    id="new-model-description" 
                    value={modelForm.description || ''}
                    onChange={e => setModelForm({...modelForm, description: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="new-model-version">Versão</Label>
                    <Input 
                      id="new-model-version" 
                      value={modelForm.version || ''}
                      onChange={e => setModelForm({...modelForm, version: e.target.value})}
                    />
                  </div>
                  {providerRequiresApiKey((modelForm.provider as AIModel['provider']) || 'other') && (
                    <div>
                      <Label htmlFor="new-model-api-key">Chave de API</Label>
                      <Input 
                        id="new-model-api-key" 
                        type="password"
                        value={modelForm.apiKey || ''}
                        onChange={e => {
                          const val = e.target.value;
                          const provider = (modelForm.provider as AIModel['provider']) || 'other';
                          const currentSlug = (modelForm.settings?.apiModel as string) || '';
                          const suggestions = providerModelSuggestions(provider);
                          setModelForm({
                            ...modelForm,
                            apiKey: val,
                            settings: !currentSlug && suggestions[0]
                              ? { ...(modelForm.settings || {}), apiModel: suggestions[0] }
                              : modelForm.settings
                          });
                        }}
                      />
                    </div>
                  )}
                </div>
                {(['openai','anthropic','groq','ollama'] as AIModel['provider'][]).includes((modelForm.provider as AIModel['provider']) || 'other') && (
                  <div>
                    <Label htmlFor="new-model-slug">Modelo (slug exato)</Label>
                    <Input 
                      id="new-model-slug" 
                      placeholder={
                        modelForm.provider === 'openai' ? 'gpt-4o-mini' :
                        modelForm.provider === 'anthropic' ? 'claude-3-5-sonnet-20240620' :
                        modelForm.provider === 'groq' ? 'llama-3.1-70b-versatile' :
                        modelForm.provider === 'ollama' ? 'llama3:8b' : ''
                      }
                      value={(modelForm.settings?.apiModel as string) || ''}
                      onChange={e => setModelForm({
                        ...modelForm,
                        settings: { ...(modelForm.settings || {}), apiModel: e.target.value }
                      })}
                    />
                    <p className="text-xs text-gray-500 mt-1">Use o slug oficial do modelo. Exemplos: OpenAI "gpt-4o-mini", Anthropic "claude-3-5-sonnet-20240620", Groq "llama-3.1-70b-versatile", Ollama "llama3:8b".</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {providerModelSuggestions((modelForm.provider as AIModel['provider']) || 'other').map(s => (
                        <Button
                          key={s}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setModelForm({
                            ...modelForm,
                            settings: { ...(modelForm.settings || {}), apiModel: s }
                          })}
                          title={`Usar ${s}`}
                        >
                          {s}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                {modelForm.provider === 'ollama' && (
                  <div>
                    <Label htmlFor="new-model-baseurl">Base URL (Ollama)</Label>
                    <Input 
                      id="new-model-baseurl" 
                      placeholder="http://localhost:11434"
                      value={(modelForm.settings?.baseUrl as string) || ''}
                      onChange={e => setModelForm({
                        ...modelForm,
                        settings: { ...(modelForm.settings || {}), baseUrl: e.target.value }
                      })}
                    />
                    <p className="text-xs text-gray-500 mt-1">Ex.: http://localhost:11434</p>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="new-model-active"
                    checked={!!modelForm.active}
                    onCheckedChange={checked => setModelForm({...modelForm, active: checked})}
                  />
                  <Label htmlFor="new-model-active">Ativo</Label>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={cancelEditingModel}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={saveModel} 
                    disabled={
                      !hasPermission('can_configure_ai_models') ||
                      !(modelForm.name && modelForm.name.trim()) ||
                      (
                        providerRequiresApiKey((modelForm.provider as AIModel['provider']) || 'other') &&
                        !(modelForm.apiKey && modelForm.apiKey.trim())
                      ) ||
                      (modelForm.provider === 'ollama' && !((modelForm.settings?.baseUrl as string) || '').trim())
                    }
                  >
                    Salvar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {editingModelId && editingModelId !== 'new' && config?.models.filter(m => m.id === editingModelId).map(model => (
            <Card key={model.id} className={editingModelId === model.id ? 'border-blue-500' : ''}>
              {editingModelId === model.id ? (
                // Edit Mode
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="model-name">Nome</Label>
                      <Input 
                        id="model-name" 
                        value={modelForm.name || ''}
                        onChange={e => setModelForm({...modelForm, name: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="model-provider">Provedor</Label>
                      <Select 
                        value={modelForm.provider} 
                        onValueChange={value => {
                          const provider = value as AIModel['provider'];
                          const suggestions = providerModelSuggestions(provider);
                          const currentSlug = (modelForm.settings?.apiModel as string) || '';
                          setModelForm(prev => ({
                            ...prev,
                            provider,
                            settings: !currentSlug && suggestions[0]
                              ? { ...(prev.settings || {}), apiModel: suggestions[0] }
                              : (prev.settings || undefined)
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o provedor" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gemini">Google Gemini</SelectItem>
                          <SelectItem value="openai">OpenAI</SelectItem>
                          <SelectItem value="anthropic">Anthropic</SelectItem>
                          <SelectItem value="groq">Groq</SelectItem>
                          <SelectItem value="ollama">Ollama</SelectItem>
                          <SelectItem value="other">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="model-version">Versão</Label>
                    <Input 
                      id="model-version" 
                      value={modelForm.version || ''}
                      onChange={e => setModelForm({...modelForm, version: e.target.value})}
                    />
                  </div>
                  {/* Capabilities chips editor */}
                  <div>
                    <Label htmlFor="model-capabilities">Recursos (capabilities)</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {(modelForm.capabilities || []).map(cap => (
                        <Badge key={cap} variant="outline" className="flex items-center gap-1">
                          {cap}
                          <button
                            type="button"
                            className="ml-1 text-gray-500 hover:text-red-600"
                            onClick={() => setModelForm({
                              ...modelForm,
                              capabilities: (modelForm.capabilities || []).filter(c => c !== cap)
                            })}
                            aria-label={`Remover ${cap}`}
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Input
                        id="model-capabilities"
                        placeholder="Ex.: chat, vision, json"
                        value={capabilityInput}
                        onChange={e => setCapabilityInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            const value = capabilityInput.trim();
                            if (value && !(modelForm.capabilities || []).includes(value)) {
                              setModelForm({
                                ...modelForm,
                                capabilities: [ ...(modelForm.capabilities || []), value ]
                              });
                              setCapabilityInput('');
                            }
                          }
                        }}
                      />
                      <Button
                        type="button"
                        onClick={() => {
                          const value = capabilityInput.trim();
                          if (value && !(modelForm.capabilities || []).includes(value)) {
                            setModelForm({
                              ...modelForm,
                              capabilities: [ ...(modelForm.capabilities || []), value ]
                            });
                            setCapabilityInput('');
                          }
                        }}
                      >
                        Adicionar
                      </Button>
                    </div>
                  </div>
                  {providerRequiresApiKey((modelForm.provider as AIModel['provider']) || 'other') && (
                    <div>
                      <Label htmlFor="model-api-key">Chave de API</Label>
                      <div className="flex gap-2">
                        <Input 
                          id="model-api-key" 
                          type={showApiKey ? 'text' : 'password'}
                          value={modelForm.apiKey || ''}
                          onChange={e => {
                            const val = e.target.value;
                            const provider = (modelForm.provider as AIModel['provider']) || 'other';
                            const currentSlug = (modelForm.settings?.apiModel as string) || '';
                            const suggestions = providerModelSuggestions(provider);
                            setModelForm({
                              ...modelForm,
                              apiKey: val,
                              settings: !currentSlug && suggestions[0]
                                ? { ...(modelForm.settings || {}), apiModel: suggestions[0] }
                                : modelForm.settings
                            });
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowApiKey(v => !v)}
                          title={showApiKey ? 'Ocultar chave' : 'Mostrar chave'}
                        >
                          {showApiKey ? 'Ocultar' : 'Mostrar'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => { if (modelForm.apiKey) navigator.clipboard.writeText(modelForm.apiKey); }}
                          disabled={!modelForm.apiKey}
                          title="Copiar chave"
                        >
                          Copiar
                        </Button>
                      </div>
                    </div>
                  )}
                  {(['openai','anthropic','groq','ollama'] as AIModel['provider'][]).includes((modelForm.provider as AIModel['provider']) || 'other') && (
                    <div>
                      <Label htmlFor="model-slug">Modelo (slug exato)</Label>
                      <Input 
                        id="model-slug" 
                        placeholder={
                          modelForm.provider === 'openai' ? 'gpt-4o-mini' :
                          modelForm.provider === 'anthropic' ? 'claude-3-5-sonnet-20240620' :
                          modelForm.provider === 'groq' ? 'llama-3.1-70b-versatile' :
                          modelForm.provider === 'ollama' ? 'llama3:8b' : ''
                        }
                        value={(modelForm.settings?.apiModel as string) || ''}
                        onChange={e => setModelForm({
                          ...modelForm,
                          settings: { ...(modelForm.settings || {}), apiModel: e.target.value }
                        })}
                      />
                      <p className="text-xs text-gray-500 mt-1">Use o slug oficial do modelo. Exemplos: OpenAI "gpt-4o-mini", Anthropic "claude-3-5-sonnet-20240620", Groq "llama-3.1-70b-versatile", Ollama "llama3:8b".</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {providerModelSuggestions((modelForm.provider as AIModel['provider']) || 'other').map(s => (
                          <Button
                            key={s}
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setModelForm({
                              ...modelForm,
                              settings: { ...(modelForm.settings || {}), apiModel: s }
                            })}
                            title={`Usar ${s}`}
                          >
                            {s}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  {modelForm.provider === 'ollama' && (
                    <div>
                      <Label htmlFor="model-baseurl">Base URL (Ollama)</Label>
                      <Input 
                        id="model-baseurl" 
                        placeholder="http://localhost:11434"
                        value={(modelForm.settings?.baseUrl as string) || ''}
                        onChange={e => setModelForm({
                          ...modelForm,
                          settings: { ...(modelForm.settings || {}), baseUrl: e.target.value }
                        })}
                      />
                      <p className="text-xs text-gray-500 mt-1">Ex.: http://localhost:11434</p>
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="model-active"
                      checked={modelForm.active}
                      onCheckedChange={checked => setModelForm({...modelForm, active: checked})}
                    />
                    <Label htmlFor="model-active">Ativo</Label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={cancelEditingModel}>
                      Cancelar
                    </Button>
                    <Button 
                      onClick={saveModel}
                      disabled={
                        !(modelForm.name && modelForm.name.trim()) ||
                        (
                          providerRequiresApiKey((modelForm.provider as AIModel['provider']) || 'other') &&
                          !(modelForm.apiKey && modelForm.apiKey.trim())
                        ) ||
                        (modelForm.provider === 'ollama' && !((modelForm.settings?.baseUrl as string) || '').trim())
                      }
                    >
                      Salvar
                    </Button>
                  </div>
                </CardContent>
              ) : (
                // View Mode
                <>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-blue-600" />
                        {model.name}
                        {model.active ? (
                          <Badge className="bg-green-100 text-green-800">Ativo</Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-800">Inativo</Badge>
                        )}
                      </CardTitle>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => testModelQuick(model)} title="Testar modelo">
                          <Zap className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => startEditingModel(model)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteModel(model.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <CardDescription>{model.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Provedor</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{providerLabel(model.provider)}</Badge>
                          <span className="font-medium">{providerLabel(model.provider)}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Versão</p>
                        <p className="font-medium">{model.version}</p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <p className="text-sm text-gray-500">Recursos</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {model.capabilities.map(capability => (
                          <Badge key={capability} variant="outline">
                            {capability}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="bg-gray-50 dark:bg-gray-800">
                    <div className="w-full space-y-3">
                      <div>
                        <p className="text-sm text-gray-500 mb-2">Tarefas padrão</p>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(config.tasks)
                            .filter(([_, modelId]) => modelId === model.id)
                            .map(([task]) => (
                              <Badge key={task} className="bg-blue-100 text-blue-800">
                                {task}
                              </Badge>
                            ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm text-gray-500">Definir como padrão para</Label>
                        <Select onValueChange={(value) => setDefaultModelForTask(value as AIModelTask, model.id)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a tarefa" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="test-plan-generation">Geração de Plano de Teste</SelectItem>
                            <SelectItem value="test-case-generation">Geração de Caso de Teste</SelectItem>
                            <SelectItem value="bug-detection">Detecção de Bugs</SelectItem>
                            <SelectItem value="code-analysis">Análise de Código</SelectItem>
                            <SelectItem value="general-completion">Completar Texto</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardFooter>
                </>
              )}
// ... (rest of the code remains the same)
            </Card>
          ))}

          <Card>
            <CardHeader>
              <CardTitle>Configuração de Tarefas</CardTitle>
              <CardDescription>
                Defina qual modelo será usado para cada tipo de tarefa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(config?.tasks || {}).map(([task, modelId]) => (
                <div key={task} className="grid grid-cols-3 gap-4 items-center">
                  <div>
                    <Label>{task}</Label>
                  </div>
                  <div className="col-span-2">
                    <Select 
                      value={modelId} 
                      onValueChange={value => setDefaultModelForTask(task as AIModelTask, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o modelo" />
                      </SelectTrigger>
                      <SelectContent>
                        {config?.models.map(model => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.name}{model.active ? '' : ' (inativo)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
        </TabsContent>

        {/* Seção: Templates */}
        <TabsContent value="templates">
      <Collapsible
        open={openSections.templates}
        onOpenChange={() => setOpenSections(s => ({ ...s, templates: !s.templates }))}
        className="border rounded-lg"
      >
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Templates</h3>
            </div>
            <Badge variant="secondary">Prompts</Badge>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="p-4 pt-0 space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-56">
                <Label className="text-sm">Filtrar por Tarefa</Label>
                <Select value={templateFilterTask} onValueChange={setTemplateFilterTask}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as tarefas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="test-plan-generation">Geração de Plano de Teste</SelectItem>
                    <SelectItem value="test-case-generation">Geração de Caso de Teste</SelectItem>
                    <SelectItem value="bug-detection">Detecção de Bugs</SelectItem>
                    <SelectItem value="code-analysis">Análise de Código</SelectItem>
                    <SelectItem value="general-completion">Completar Texto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-44">
                <Label className="text-sm">Status</Label>
                <Select value={templateFilterStatus} onValueChange={(v) => setTemplateFilterStatus(v as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativos</SelectItem>
                    <SelectItem value="inactive">Inativos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={startAddingTemplate} className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> Adicionar Template
            </Button>
          </div>

          {(config?.promptTemplates || [])
            .filter(t => templateFilterTask === 'all' ? true : t.task === templateFilterTask)
            .filter(t => templateFilterStatus === 'all' ? true : templateFilterStatus === 'active' ? t.active : !t.active)
            .map(template => (
            <Card key={template.id} className={editingTemplateId === template.id ? 'border-blue-500' : ''}>
              {editingTemplateId === template.id ? (
                // Edit Mode
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="template-name">Nome</Label>
                      <Input 
                        id="template-name" 
                        value={templateForm.name || ''}
                        onChange={e => setTemplateForm({...templateForm, name: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="template-task">Tarefa</Label>
                      <Select 
                        value={templateForm.task as string} 
                        onValueChange={value => setTemplateForm({...templateForm, task: value as AIModelTask})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a tarefa" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="test-plan-generation">Geração de Plano de Teste</SelectItem>
                          <SelectItem value="test-case-generation">Geração de Caso de Teste</SelectItem>
                          <SelectItem value="bug-detection">Detecção de Bugs</SelectItem>
                          <SelectItem value="code-analysis">Análise de Código</SelectItem>
                          <SelectItem value="general-completion">Completar Texto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="template-description">Descrição</Label>
                    <Textarea 
                      id="template-description" 
                      value={templateForm.description || ''}
                      onChange={e => setTemplateForm({...templateForm, description: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="template-content">Conteúdo do Template</Label>
                    <Textarea 
                      id="template-content" 
                      value={templateForm.template || ''}
                      onChange={e => setTemplateForm({...templateForm, template: e.target.value})}
                      className="min-h-[200px] font-mono"
                    />
                  </div>
                  <div>
                    <Label htmlFor="template-parameters">Parâmetros (separados por vírgula)</Label>
                    <Input 
                      id="template-parameters" 
                      value={(templateForm.parameters || []).join(', ')}
                      onChange={e => setTemplateForm({
                        ...templateForm, 
                        parameters: e.target.value.split(',').map(p => p.trim()).filter(p => p)
                      })}
                    />
                  </div>
                  <div>
                    <Label>Preview</Label>
                    <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-800 rounded-md font-mono text-xs max-h-[200px] overflow-auto whitespace-pre-wrap">
                      {(() => {
                        const content = templateForm.template || '';
                        const params = templateForm.parameters || [];
                        let out = content as string;
                        try {
                          (params as string[]).forEach(p => {
                            const re = new RegExp(`\\{{${p}\\}}`, 'g');
                            out = out.replace(re, `<${p}>`);
                          });
                        } catch (e) { void e; }

                        return out;
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="template-active"
                      checked={templateForm.active}
                      onCheckedChange={checked => setTemplateForm({...templateForm, active: checked})}
                    />
                    <Label htmlFor="template-active">Ativo</Label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={cancelEditingTemplate}>
                      Cancelar
                    </Button>
                    <Button onClick={saveTemplate}>
                      Salvar
                    </Button>
                  </div>
                </CardContent>
              ) : (
                // View Mode
                <>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        {template.name}
                        {template.active ? (
                          <Badge className="bg-green-100 text-green-800">Ativo</Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-800">Inativo</Badge>
                        )}
                      </CardTitle>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => testTemplateQuick(template)} title="Testar com modelo">
                          <Zap className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => duplicateTemplate(template)} title="Duplicar">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => toggleTemplateActive(template)} title={template.active ? 'Desativar' : 'Ativar'}>
                          {template.active ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => startEditingTemplate(template)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteTemplate(template.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <CardDescription>{template.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4">
                      <p className="text-sm text-gray-500">Tarefa</p>
                      <Badge className="mt-1">{template.task}</Badge>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Parâmetros</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {template.parameters.map(param => (
                          <Badge key={param} variant="outline">
                            {param}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="mt-4">
                      <p className="text-sm text-gray-500">Template</p>
                      <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-800 rounded-md font-mono text-xs max-h-[200px] overflow-auto whitespace-pre-wrap">
                        {template.template}
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="text-xs text-gray-500">
                    Criado em: {template.createdAt.toLocaleString()} | 
                    Atualizado em: {template.updatedAt.toLocaleString()}
                  </CardFooter>
                </>
              )}
            </Card>
          ))}
        </CollapsibleContent>
      </Collapsible>
        </TabsContent>

        {/* Seção: Testes */}
        <TabsContent value="tests">
      <Collapsible
        open={openSections.tests}
        onOpenChange={() => setOpenSections(s => ({ ...s, tests: !s.tests }))}
        className="border rounded-lg"
      >
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold">Testes</h3>
            </div>
            <Badge variant="secondary">API de IA</Badge>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="p-4 pt-0 space-y-4">
          <Card className="w-full max-w-3xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2 text-center">
                <Zap className="h-5 w-5 text-blue-600" />
                {`Teste de Conectividade - ${providerLabel((resolveModelForTest()?.provider as any) || 'other')}`}
                <Badge className="bg-blue-100 text-blue-800">Múltiplos Modelos</Badge>
              </CardTitle>
              <CardDescription className="text-center">
                Teste diferentes modelos por provedor para verificar conectividade e performance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="current-key" className="block text-center">Chave API Atual</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      id="current-key"
                      type="password"
                      value={getCurrentApiKey()}
                      disabled
                      placeholder="Nenhuma chave configurada"
                      className="text-center"
                    />
                    <Badge variant={getCurrentApiKey() ? "default" : "secondary"}>
                      {getCurrentApiKey() ? "Configurada" : "Não configurada"}
                    </Badge>
                  </div>
                </div>

                <div>
                  <Label htmlFor="test-key" className="block text-center">Nova Chave API (Opcional)</Label>
                  <Input
                    id="test-key"
                    type="password"
                    value={testApiKey}
                    onChange={(e) => setTestApiKey(e.target.value)}
                    placeholder="Cole uma nova chave API para testar"
                    className="text-center"
                  />
                  <p className="text-sm text-gray-500 mt-1 text-center">
                    Se fornecida, esta chave será salva e usada para o teste
                  </p>
                </div>

                <div>
                  <Label htmlFor="test-model" className="block text-center">Modelo para Teste</Label>
                  <Select value={testModelId} onValueChange={setTestModelId}>
                    <SelectTrigger className="justify-center">
                      <SelectValue placeholder="Selecione um modelo ou use o ativo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Modelo Ativo (Automático)</SelectItem>
                      {config?.models.map(model => (
                        <SelectItem key={model.id} value={model.id} disabled={!model.active}>
                          <div className="flex items-center gap-2">
                            <span>{model.name}</span>
                            <Badge variant="outline" className="text-xs">{providerLabel(model.provider)}</Badge>
                            {!model.active && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
                            {model.version === '2.0-exp' && <Badge variant="outline" className="text-purple-600 text-xs">Exp</Badge>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-500 mt-1 text-center">
                    Teste modelos específicos para comparar performance
                  </p>
                </div>

                <div>
                  <Label htmlFor="test-prompt" className="block text-center">Prompt de Teste</Label>
                  <Textarea
                    id="test-prompt"
                    value={testPrompt}
                    onChange={(e) => setTestPrompt(e.target.value)}
                    placeholder="Digite um prompt simples para testar a API"
                    rows={3}
                    className="text-center"
                  />
                  <div className="flex gap-2 mt-2 justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTestPrompt('Diga olá em português e explique suas capacidades.')}
                    >
                      Teste Simples
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTestPrompt('Gere um plano de teste básico para um aplicativo de e-commerce, incluindo funcionalidades de login, carrinho e pagamento.')}
                    >
                      Teste Complexo
                    </Button>
                  </div>
                </div>

                <Button 
                  onClick={() => testApiConnection()} 
                  disabled={
                    testLoading ||
                    !resolveModelForTest() ||
                    (
                      providerRequiresApiKey(resolveModelForTest()!.provider) &&
                      (!getCurrentApiKey() && !testApiKey.trim())
                    ) ||
                    !hasPermission('can_test_ai_connections')
                  }
                  className="w-full"
                >
                  {testLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Testando Conexão...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      {`Testar Conexão com ${providerLabel((resolveModelForTest()?.provider as any) || 'other')}`}
                    </>
                  )}
                </Button>
              </div>

              {testResult && (
                <Alert className={testResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                  <div className="flex items-center gap-2">
                    {testResult.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <AlertDescription className="flex-1">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                        <p className={testResult.success ? "text-green-800" : "text-red-800"}>
                          {testResult.message}
                        </p>
                          {testResult.modelUsed && (
                            <Badge className={testResult.success ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                              {testResult.modelUsed}
                            </Badge>
                          )}
                        </div>
                        
                        {testResult.response && (
                          <div className="mt-3">
                            <p className="text-sm font-medium text-green-700">Resposta da API:</p>
                                            <div className="mt-1 p-3 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded text-sm whitespace-pre-wrap">
                  {testResult.response}
                </div>
                          </div>
                        )}
                        
                        {testResult.error && (
                          <div className="mt-3">
                            <p className="text-sm font-medium text-red-700">Detalhes do Erro:</p>
                                            <div className="mt-1 p-3 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded text-sm font-mono whitespace-pre-wrap">
                  {testResult.error}
                </div>
                          </div>
                        )}
                      </div>
                    </AlertDescription>
                  </div>
                </Alert>
              )}

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="space-y-2">
                    <h4 className="font-medium text-blue-900 dark:text-blue-400">
                      Como Obter uma Chave API do Gemini
                    </h4>
                    <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                      <p>1. Acesse <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline">Google AI Studio</a></p>
                      <p>2. Faça login com sua conta Google</p>
                      <p>3. Clique em "Create API Key"</p>
                      <p>4. Copie a chave gerada e cole no campo acima</p>
                      <p>5. Configure no Model Control Panel para uso permanente</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
        </TabsContent>
      </Tabs>
    </div>
    </PermissionGuard>
  );
};