// NOTA: Este arquivo foi descontinuado
// A funcionalidade de geração de testes com IA foi movida para o cliente
// usando a API Gemini diretamente através do serviço ModelControlService.ts

/**
 * Este arquivo foi mantido apenas para referência.
 * A implementação atual está no frontend utilizando as integrações diretas com o Gemini.
 * 
 * Para usar esta funcionalidade, consulte:
 * - src/services/modelControlService.ts
 * - src/integrations/gemini/client.ts
 * - src/components/forms/AIGeneratorForm.tsx
 */

// Exemplo de como a funcionalidade é implementada no cliente:

/*
// Função para gerar plano de teste
const generateTestPlan = async (variables: {
  description: string;
  context?: string;
  requirements?: string;
}): Promise<any> => {
  const prompt = `
        Crie um plano de teste específico e direto em português brasileiro para:
        
    Descrição: ${variables.description}
    ${variables.context ? `Contexto: ${variables.context}` : ''}
    ${variables.requirements ? `Requisitos: ${variables.requirements}` : ''}
        
        INSTRUÇÕES:
        - Seja ESPECÍFICO e DIRETO
        - Evite contexto desnecessário ou genérico
        - Foque apenas no que foi solicitado
        - Use informações fornecidas, não invente detalhes
        
        Retorne um JSON válido com a seguinte estrutura:
        {
          "title": "título específico e direto",
          "description": "descrição objetiva baseada nas informações fornecidas",
          "objective": "objetivo específico do teste",
          "scope": "escopo claro e limitado",
          "approach": "abordagem direta de teste",
          "criteria": "critérios objetivos de aceite",
          "resources": "recursos essenciais necessários",
          "schedule": "estimativa realista de cronograma",
          "risks": "riscos específicos identificados"
        }
      `;
  
  return await generateStructuredContent(prompt);
};

// Função para gerar caso de teste
const generateTestCase = async (variables: {
  description: string;
  context?: string;
  requirements?: string;
  testPlan?: any;
}): Promise<any> => {
  const prompt = `
        Crie um caso de teste específico e direto em português brasileiro para:
        
    Descrição: ${variables.description}
    ${variables.context ? `Contexto: ${variables.context}` : ''}
    ${variables.requirements ? `Requisitos: ${variables.requirements}` : ''}
    ${variables.testPlan ? `Plano de Teste: ${variables.testPlan.title}` : ''}
        
        INSTRUÇÕES:
        - Seja ESPECÍFICO e DIRETO
        - Passos claros e executáveis
        - Resultados esperados precisos
        - Baseie-se apenas nas informações fornecidas
        
        Retorne um JSON válido com a seguinte estrutura:
        {
          "title": "título específico do caso de teste",
          "description": "descrição objetiva do caso",
          "preconditions": "pré-condições necessárias e específicas",
          "steps": [
            {
              "id": "1",
              "action": "ação específica a ser executada",
              "expected_result": "resultado esperado específico",
              "order": 1
            }
          ],
          "expected_result": "resultado esperado final específico",
          "priority": "medium",
          "type": "functional"
        }
      `;
  
  return await generateStructuredContent(prompt);
};

// Função para gerar execução de teste
const generateTestExecution = async (variables: {
  description: string;
  context?: string;
  testCase: any;
  testPlan: any;
}): Promise<any> => {
  const prompt = `
        Gere uma execução de teste realística e específica em português brasileiro para:
        
    Caso de Teste: ${variables.testCase.title}
    Descrição: ${variables.testCase.description}
    Passos: ${JSON.stringify(variables.testCase.steps)}
        
    Contexto da execução: ${variables.description}
    ${variables.context ? `Observações: ${variables.context}` : ''}
        
        INSTRUÇÕES:
        - Simule uma execução realística
        - Resultado específico baseado nos passos
        - Seja direto e objetivo
        
        Retorne um JSON válido com a seguinte estrutura:
        {
          "status": "passed" ou "failed" ou "blocked",
          "actual_result": "resultado específico obtido na execução simulada",
          "notes": "observações específicas sobre a execução",
          "executed_by": "Testador IA"
        }
      `;
  
  return await generateStructuredContent(prompt);
};
*/
