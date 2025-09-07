import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Requirements } from '@/pages/Requirements';
import { TraceabilityMatrix } from '@/pages/TraceabilityMatrix';
import { Defects } from '@/pages/Defects';
import { useSearchParams } from 'react-router-dom';
import { ViewModeToggle } from '@/components/ViewModeToggle';

export const Gestao = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<'requirements' | 'traceability' | 'defects'>(() => {
    const t = (searchParams.get('tab') || 'requirements') as any;
    if (t === 'traceability' || t === 'defects' || t === 'requirements') return t;
    return 'requirements';
  });
  const [tabView, setTabView] = useState<{requirements: 'cards'|'list'; traceability: 'cards'|'list'; defects: 'cards'|'list' }>({
    requirements: 'cards',
    traceability: 'cards',
    defects: 'cards',
  });

  // Sincroniza a aba com a URL
  useEffect(() => {
    const t = searchParams.get('tab');
    if (!t) return; 
    if (t === 'requirements' || t === 'traceability' || t === 'defects') {
      setTab(t);
    }
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    const next = (value as any) as 'requirements' | 'traceability' | 'defects';
    setTab(next);
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    setSearchParams(params);
  };

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header padrão como outras páginas */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gestão</h1>
        <p className="text-sm text-muted-foreground">Organize requisitos, vínculos e defeitos</p>
      </div>

      <div className="mt-2">
        <Tabs value={tab} onValueChange={handleTabChange}>
          <div className="flex items-center justify-between">
            <TabsList className="bg-transparent p-0 h-auto border-b border-border rounded-none">
              <TabsTrigger value="requirements" className="rounded-none px-3 pb-3 pt-1 data-[state=active]:border-b-2 data-[state=active]:border-brand data-[state=active]:text-brand">
                Requisitos
              </TabsTrigger>
              <TabsTrigger value="traceability" className="rounded-none px-3 pb-3 pt-1 data-[state=active]:border-b-2 data-[state=active]:border-brand data-[state=active]:text-brand">
                Matriz de Rastreabilidade
              </TabsTrigger>
              <TabsTrigger value="defects" className="rounded-none px-3 pb-3 pt-1 data-[state=active]:border-b-2 data-[state=active]:border-brand data-[state=active]:text-brand">
                Defeitos
              </TabsTrigger>
            </TabsList>
            <ViewModeToggle
              viewMode={tabView[tab]}
              onViewModeChange={(mode) => setTabView(v => ({ ...v, [tab]: mode }))}
            />
          </div>

          <TabsContent value="requirements" className="mt-4">
            <Requirements 
              embedded 
              preferredViewMode={tabView.requirements}
              onPreferredViewModeChange={(mode) => setTabView(v => ({ ...v, requirements: mode }))}
            />
          </TabsContent>

          <TabsContent value="traceability" className="mt-4">
            <TraceabilityMatrix 
              embedded 
              preferredViewMode={tabView.traceability}
              onPreferredViewModeChange={(mode) => setTabView(v => ({ ...v, traceability: mode }))}
            />
          </TabsContent>

          <TabsContent value="defects" className="mt-4">
            <Defects 
              embedded 
              preferredViewMode={tabView.defects}
              onPreferredViewModeChange={(mode) => setTabView(v => ({ ...v, defects: mode }))}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Gestao;
