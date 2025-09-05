import { useEffect, useState } from 'react';
import { Sparkles, Files, FileText, TestTube, PlayCircle, ChevronRight, Eye, ArrowLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AIGeneratorForm } from '@/components/forms/AIGeneratorForm';
import { AIBatchGeneratorForm } from '@/components/forms/AIBatchGeneratorForm';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AIBatchModal } from '@/components/AIBatchModal';

interface GeneratedItem {
  id: string;
  title: string;
  description: string;
  objective?: string;
  scope?: string;
  approach?: string;
  criteria?: string;
  resources?: string;
  schedule?: string;
  risks?: string;
  preconditions?: string;
  expected_result?: string;
  priority?: string;
  type?: string;
  steps?: Array<{
    action: string;
    expected_result: string;
  }>;
  status: 'pending' | 'approved' | 'rejected' | 'regenerating';
}

type GenerationType = 'plan' | 'case' | 'execution';

interface GenerationOption {
  type: GenerationType;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  permission: string;
}

export const AIGenerator = () => {
  const [showForm, setShowForm] = useState(false);
  const [generationType, setGenerationType] = useState<'plan' | 'case' | 'execution'>('plan');
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showPlanWithCasesModal, setShowPlanWithCasesModal] = useState(false);
  const [generatedPlans, setGeneratedPlans] = useState<GeneratedItem[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<GeneratedItem | null>(null);
  const [showPlanDetails, setShowPlanDetails] = useState(false);
  const navigate = useNavigate();
  // Modo local da página (sem localStorage): 'individual' ou 'batch'
  const [batchMode, setBatchMode] = useState<'individual' | 'batch'>('individual');
  // Modo específico do card de Plano: alterna visualmente entre geração em lote e "plano único com casos"
  const [planCardMode, setPlanCardMode] = useState<'batch' | 'plan-with-cases'>('batch');
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission, loading } = usePermissions();

  const canGeneratePlan = hasPermission('can_use_ai') && hasPermission('can_manage_plans');
  const canGenerateCase = hasPermission('can_use_ai') && hasPermission('can_manage_cases');
  const canGenerateExecution = hasPermission('can_use_ai') && hasPermission('can_manage_executions');
  const planDisabled = loading || !canGeneratePlan;
  const caseDisabled = loading || !canGenerateCase;
  const executionDisabled = loading || !canGenerateExecution;

  // Sincroniza o estado com o query param ?type=
  useEffect(() => {
    const t = searchParams.get('type');
    if (t === 'plan' || t === 'case' || t === 'execution') {
      setGenerationType(t);
      setShowForm(true);
    }
  }, [searchParams]);

  const handleGenerationSuccess = (data: any) => {
    setShowForm(false);
    if (batchMode === 'batch' && (generationType === 'plan' || generationType === 'case')) {
      // Para geração em lote, abrir o modal de revisão
      if (data.plans || data.cases) {
        const itemsWithStatus = (data.plans || data.cases).map((item: any) => ({
          ...item,
          id: item.id || Math.random().toString(36).substr(2, 9),
          status: 'pending' as const
        }));
        setGeneratedPlans(itemsWithStatus);
        setShowBatchModal(true);
      }
    } else {
      // Para geração individual, redirecionar normalmente
      if (generationType === 'plan') {
        navigate('/plans');
      } else if (generationType === 'case') {
        navigate('/cases');
      } else {
        navigate('/executions');
      }
    }
  };

  const handlePlanApprove = (planId: string) => {
    setGeneratedPlans(prev => 
      prev.map(plan => 
        plan.id === planId ? { ...plan, status: 'approved' as const } : plan
      )
    );
  };

  const handlePlanReject = (planId: string) => {
    setGeneratedPlans(prev => 
      prev.map(plan => 
        plan.id === planId ? { ...plan, status: 'rejected' as const } : plan
      )
    );
  };

  const handlePlanRegenerate = (planId: string, feedback: string) => {
    setGeneratedPlans(prev => 
      prev.map(plan => 
        plan.id === planId ? { ...plan, status: 'regenerating' as const } : plan
      )
    );
    // Aqui você implementaria a lógica para regenerar o plano com o feedback
    console.log(`Regenerating plan ${planId} with feedback: ${feedback}`);
  };

  const handleViewPlanDetails = (plan: GeneratedItem) => {
    setSelectedPlan(plan);
    setShowPlanDetails(true);
  };

  if (showForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setSearchParams({}); }}>
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            {(batchMode === 'batch' && generationType === 'plan') ? 'Gerar Vários Planos de Teste com IA' :
             (batchMode === 'batch' && generationType === 'case') ? 'Gerar Vários Casos de Teste com IA' :
              `Gerar ${generationType === 'plan' ? 'Plano' : generationType === 'case' ? 'Caso' : 'Execução'} de Teste com IA`
            }
          </h2>
        </div>
        
        {(batchMode === 'batch' && (generationType === 'plan' || generationType === 'case')) ? (
          <AIBatchGeneratorForm onSuccess={handleGenerationSuccess} type={generationType} />
        ) : (
          <AIGeneratorForm onSuccess={handleGenerationSuccess} initialType={generationType} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="text-center flex-1">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Gerador IA</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Use inteligência artificial para gerar planos, casos e execuções de teste automaticamente
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Modo</span>
          <div className="p-1 rounded-lg border">
            <Button
              size="sm"
              variant={batchMode === 'individual' ? 'default' : 'outline'}
              aria-pressed={batchMode === 'individual'}
              onClick={() => setBatchMode('individual')}
            >
              Individual
            </Button>
            <Button
              size="sm"
              variant={batchMode === 'batch' ? 'default' : 'outline'}
              aria-pressed={batchMode === 'batch'}
              onClick={() => setBatchMode('batch')}
              className="ml-1"
            >
              Em lote
            </Button>
          </div>
        </div>
      </div>
      <div className="md:hidden flex justify-center">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Modo</span>
          <div className="p-1 rounded-lg border">
            <Button
              size="sm"
              variant={batchMode === 'individual' ? 'default' : 'outline'}
              aria-pressed={batchMode === 'individual'}
              onClick={() => setBatchMode('individual')}
            >
              Individual
            </Button>
            <Button
              size="sm"
              variant={batchMode === 'batch' ? 'default' : 'outline'}
              aria-pressed={batchMode === 'batch'}
              onClick={() => setBatchMode('batch')}
              className="ml-1"
            >
              Em lote
            </Button>
          </div>
        </div>
      </div>

      {/* Skeleton enquanto permissões carregam */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <div className="h-[300px] rounded-xl border bg-gray-200/60 dark:bg-gray-800/60 animate-pulse" />
          <div className="h-[300px] rounded-xl border bg-gray-200/60 dark:bg-gray-800/60 animate-pulse" />
          <div className="h-[300px] rounded-xl border bg-gray-200/60 dark:bg-gray-800/60 animate-pulse" />
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        <Card
          className={`group relative text-center transition-colors border hover:shadow-md rounded-xl h-[300px] flex flex-col overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${planDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          role="button"
          tabIndex={planDisabled ? -1 : 0}
          aria-disabled={planDisabled}
          aria-label={batchMode === 'batch' ? 'Gerar Vários Planos' : 'Gerar Plano de Teste'}
          onKeyDown={(e) => {
            if (planDisabled) return;
            // Evita acionar via teclado quando o foco estiver no botão do ícone
            const active = document.activeElement as HTMLElement | null;
            if (active && active.closest('[data-role="plan-with-cases-trigger"]')) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setGenerationType('plan');
              setShowForm(true);
              setSearchParams({ type: 'plan' });
            }
          }}
          onClick={(e) => {
            if (planDisabled) return;
            // Se o clique partiu do ícone, não abre o fluxo padrão
            const target = e.target as HTMLElement | null;
            if (target && target.closest('[data-role="plan-with-cases-trigger"]')) return;
            setGenerationType('plan');
            setShowForm(true);
            setSearchParams({ type: 'plan' });
          }}
        >
          {/* Flip container com layout compacto (igual aos demais cards) */}
          <div className={`relative h-full w-full flip-card`}>
            <div className="flip-inner">
              {/* Botão do modal dedicado posicionado acima das faces (mesmo stacking context) */}
              {!planDisabled && (
                <button
                  type="button"
                  className="absolute top-3 right-3 z-30 p-2 rounded-md bg-transparent opacity-70 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-primary"
                  title={'Abrir Plano Único com Casos (IA)'}
                  aria-label="Abrir Plano Único com Casos (IA)"
                  data-role="plan-with-cases-trigger"
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onKeyDown={(e) => { e.stopPropagation(); }}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setShowPlanWithCasesModal(true);
                  }}
                >
                  <Files className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </button>
              )}
              {/* Frente: segue o modo global (Individual/Lote) */}
              <div className="flip-face flip-front flex flex-col h-full">
                <CardHeader className="p-4 pb-3">
                  <div className="mx-auto mb-3 p-4 bg-blue-100 dark:bg-blue-900 rounded-full w-fit">
                    {batchMode === 'batch' ? (
                      <Files className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                  <CardTitle className="flex items-center justify-center gap-2 text-lg">
                    <Sparkles className="h-5 w-5" />
                    {batchMode === 'batch' ? 'Gerar Vários Planos' : 'Gerar Plano de Teste'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 flex flex-col flex-1">
                  <p className="text-muted-foreground text-sm line-clamp-2 mb-2">
                    {batchMode === 'batch'
                      ? 'Analise documentos e gere múltiplos planos de teste automaticamente'
                      : 'Crie planos de teste completos baseados na descrição do seu projeto'}
                  </p>
                  <div className="mt-auto text-sm font-medium text-primary flex items-center justify-center">
                    Começar geração
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </div>
                </CardContent>
              </div>

              {/* Verso: Plano Único com Casos (IA) */}
              <div className="flip-face flip-back flex flex-col h-full">
                <CardHeader className="p-4 pb-3">
                  <div className="mx-auto mb-3 p-4 bg-blue-100 dark:bg-blue-900 rounded-full w-fit">
                    <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <CardTitle className="flex items-center justify-center gap-2 text-lg">
                    <Sparkles className="h-5 w-5" />
                    Plano Único com Casos (IA)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 flex flex-col flex-1">
                  <p className="text-muted-foreground text-sm line-clamp-2 mb-2">
                    Consolide um plano e gere múltiplos casos a partir de uma tabela/descrição
                  </p>
                  <div className="mt-auto text-sm font-medium text-primary flex items-center justify-center">
                    Abrir modal
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </div>
                </CardContent>
              </div>
            </div>
          </div>
          {(planDisabled) && (
            <div className="absolute inset-0 bg-black/30 text-white flex items-center justify-center rounded-xl">
              {loading ? 'Carregando permissões...' : 'Sem permissão'}
            </div>
          )}
        </Card>

        <Card
          className={`group relative text-center transition-colors border hover:shadow-md rounded-xl h-[300px] flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${caseDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          role="button"
          tabIndex={caseDisabled ? -1 : 0}
          aria-disabled={caseDisabled}
          aria-label={batchMode === 'batch' ? 'Gerar vários casos de teste' : 'Gerar casos de teste'}
          onKeyDown={(e) => {
            if (caseDisabled) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setGenerationType('case');
              setShowForm(true);
              setSearchParams({ type: 'case' });
            }
          }}
          onClick={() => {
            if (!canGenerateCase || caseDisabled) return;
            setGenerationType('case');
            setShowForm(true);
            setSearchParams({ type: 'case' });
          }}
        >
          <CardHeader className="pb-4 flex-shrink-0">
            <div className="mx-auto mb-4 p-4 bg-green-100 dark:bg-green-900 rounded-full w-fit">
              {batchMode === 'batch' ? (
                <Files className="h-8 w-8 text-green-600 dark:text-green-400" />
              ) : (
              <TestTube className="h-8 w-8 text-green-600 dark:text-green-400" />
              )}
            </div>
            <CardTitle className="flex items-center justify-center gap-2 text-lg">
              <Sparkles className="h-5 w-5" />
              {batchMode === 'batch' ? 'Gerar Vários Casos' : 'Gerar Casos de Teste'}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-1 flex-1 flex items-center justify-center">
              {batchMode === 'batch' 
                ? 'Analise documentos em múltiplos formatos e gere casos de teste automaticamente'
                : 'Gere casos de teste detalhados para funcionalidades específicas'
              }
            </p>
            <div className="mt-2 text-sm font-medium text-primary flex items-center justify-center">
              Começar geração
              <ChevronRight className="ml-1 h-4 w-4" />
            </div>
          </CardContent>
          {(caseDisabled) && (
            <div className="absolute inset-0 bg-black/30 text-white flex items-center justify-center rounded-xl">
              {loading ? 'Carregando permissões...' : 'Sem permissão'}
            </div>
          )}
        </Card>

        <Card
          className={`group relative text-center transition-colors border hover:shadow-md rounded-xl h-[300px] flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${executionDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          role="button"
          tabIndex={executionDisabled ? -1 : 0}
          aria-disabled={executionDisabled}
          aria-label={'Gerar execução de teste'}
          onKeyDown={(e) => {
            if (executionDisabled) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setGenerationType('execution');
              setShowForm(true);
              setSearchParams({ type: 'execution' });
            }
          }}
          onClick={() => {
            if (executionDisabled) return;
            setGenerationType('execution');
            setShowForm(true);
            setSearchParams({ type: 'execution' });
          }}
        >
          <CardHeader className="pb-4 flex-shrink-0">
            <div className="mx-auto mb-4 p-4 bg-purple-100 dark:bg-purple-900 rounded-full w-fit">
              <PlayCircle className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            </div>
            <CardTitle className="flex items-center justify-center gap-2 text-lg">
              <Sparkles className="h-5 w-5" />
              Gerar Execução de Teste
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-1 flex-1 flex items-center justify-center">
              Simule execuções de teste automaticamente baseadas em casos existentes
            </p>
            <div className="mt-2 text-sm font-medium text-primary flex items-center justify-center">
              Começar geração
              <ChevronRight className="ml-1 h-4 w-4" />
            </div>
          </CardContent>
          {(executionDisabled) && (
            <div className="absolute inset-0 bg-black/30 text-white flex items-center justify-center rounded-xl">
              {loading ? 'Carregando permissões...' : 'Sem permissão'}
            </div>
          )}
        </Card>
      </div>
      )}

      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>
              <Sparkles />
              Como funciona?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-[2rem_1fr] items-start gap-3">
                <div className="bg-blue-100 dark:bg-blue-900 rounded-full w-8 h-8 flex items-center justify-center">
                  <span className="text-blue-600 dark:text-blue-400 font-semibold text-sm">1</span>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-medium leading-6">
                    {batchMode === 'batch' ? 'Forneça o documento' : 'Descreva seu projeto'}
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {batchMode === 'batch' 
                      ? 'Cole ou faça upload do documento com as especificações do sistema'
                      : 'Forneça informações sobre o sistema que será testado'
                    }
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-[2rem_1fr] items-start gap-3">
                <div className="bg-blue-100 dark:bg-blue-900 rounded-full w-8 h-8 flex items-center justify-center">
                  <span className="text-blue-600 dark:text-blue-400 font-semibold text-sm">2</span>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-medium leading-6">IA analisa e gera</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {batchMode === 'batch' 
                      ? 'Nossa IA identifica automaticamente diferentes funcionalidades e gera planos específicos'
                      : 'Nossa IA cria planos, casos e execuções de teste personalizados'
                    }
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-[2rem_1fr] items-start gap-3">
                <div className="bg-blue-100 dark:bg-blue-900 rounded-full w-8 h-8 flex items-center justify-center">
                  <span className="text-blue-600 dark:text-blue-400 font-semibold text-sm">3</span>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-medium leading-6">Revise e execute</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {batchMode === 'batch' 
                      ? 'Aprove, rejeite ou refaça cada plano individualmente antes de salvar'
                      : 'Ajuste conforme necessário e execute seus testes'
                    }
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <AIBatchModal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        plans={generatedPlans}
        onApprove={handlePlanApprove}
        onReject={handlePlanReject}
        onRegenerate={handlePlanRegenerate}
        onViewDetails={handleViewPlanDetails}
      />

      {/* Modal para Plano Único com Múltiplos Casos */}
      <Dialog open={showPlanWithCasesModal} onOpenChange={setShowPlanWithCasesModal}>
        <DialogContent className="max-w-3xl" aria-describedby="plan-with-cases-desc">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Files className="h-5 w-5" />
              Plano Único com Múltiplos Casos (IA)
            </DialogTitle>
            <DialogDescription id="plan-with-cases-desc">
              Cole a tabela/descrição. A IA consolidará um plano e gerará vários casos de teste.
            </DialogDescription>
          </DialogHeader>
          <div className="pt-2">
            <AIBatchGeneratorForm
              type="plan"
              mode="plan-with-cases"
              onSuccess={() => {
                setShowPlanWithCasesModal(false);
                navigate('/plans');
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes */}
      <Dialog open={showPlanDetails} onOpenChange={setShowPlanDetails}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="plan-details-desc">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Detalhes do {generationType === 'case' ? 'Caso' : 'Plano'} Gerado
            </DialogTitle>
            <DialogDescription id="plan-details-desc">
              Visualize todos os detalhes do {generationType === 'case' ? 'caso' : 'plano'} de teste gerado pela IA
            </DialogDescription>
          </DialogHeader>
          
          {selectedPlan && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">{selectedPlan.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 mt-1">{selectedPlan.description}</p>
              </div>
              
              {generationType === 'plan' ? (
                (() => {
                  const obj = selectedPlan.objective?.toString().trim();
                  const scope = selectedPlan.scope?.toString().trim();
                  const approach = selectedPlan.approach?.toString().trim();
                  const criteria = selectedPlan.criteria?.toString().trim();
                  const resources = selectedPlan.resources?.toString().trim();
                  const schedule = selectedPlan.schedule?.toString().trim();
                  const risks = selectedPlan.risks?.toString().trim();
                  const hasAny = Boolean(obj || scope || approach || criteria || resources || schedule || risks);
                  if (!hasAny) return null;
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {obj && (
                        <div>
                          <h4 className="font-medium mb-2">Objetivo</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{obj}</p>
                        </div>
                      )}
                      {scope && (
                        <div>
                          <h4 className="font-medium mb-2">Escopo</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{scope}</p>
                        </div>
                      )}
                      {approach && (
                        <div>
                          <h4 className="font-medium mb-2">Abordagem</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{approach}</p>
                        </div>
                      )}
                      {criteria && (
                        <div>
                          <h4 className="font-medium mb-2">Critérios</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{criteria}</p>
                        </div>
                      )}
                      {resources && (
                        <div>
                          <h4 className="font-medium mb-2">Recursos</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{resources}</p>
                        </div>
                      )}
                      {schedule && (
                        <div>
                          <h4 className="font-medium mb-2">Cronograma</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{schedule}</p>
                        </div>
                      )}
                      {risks && (
                        <div className="md:col-span-2">
                          <h4 className="font-medium mb-2">Riscos</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{risks}</p>
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div className="space-y-4">
                  {selectedPlan.preconditions && (
                    <div>
                      <h4 className="font-medium mb-2">Pré-condições</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{selectedPlan.preconditions}</p>
                    </div>
                  )}
                  
                  {selectedPlan.steps && selectedPlan.steps.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Passos do Teste</h4>
                      <div className="space-y-2">
                        {selectedPlan.steps.map((step: any, index: number) => (
                          <div key={index} className="border rounded-lg p-3">
                            <div className="font-medium text-sm">Passo {index + 1}</div>
                            <div className="text-sm mt-1">
                              <strong>Ação:</strong> {step.action}
                            </div>
                            <div className="text-sm">
                              <strong>Resultado Esperado:</strong> {step.expected_result}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {selectedPlan.expected_result && (
                    <div>
                      <h4 className="font-medium mb-2">Resultado Final Esperado</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{selectedPlan.expected_result}</p>
                    </div>
                  )}
                  
                  <div className="flex gap-4">
                    {selectedPlan.priority && (
                      <div>
                        <h4 className="font-medium mb-2">Prioridade</h4>
                        <Badge className={
                          selectedPlan.priority === 'critical' ? 'bg-red-100 text-red-800' :
                          selectedPlan.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                          selectedPlan.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }>
                          {selectedPlan.priority}
                        </Badge>
                      </div>
                    )}
                    
                    {selectedPlan.type && (
                      <div>
                        <h4 className="font-medium mb-2">Tipo</h4>
                        <Badge variant="outline">{selectedPlan.type}</Badge>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
