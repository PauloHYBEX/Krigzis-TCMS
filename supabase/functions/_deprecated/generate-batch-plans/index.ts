// NOTA: Este arquivo foi descontinuado
// A funcionalidade de geração em lote de planos de teste foi movida para o cliente
// usando a API Gemini diretamente através do serviço ModelControlService.ts

/**
 * Este arquivo foi mantido apenas para referência.
 * A implementação atual está no frontend utilizando as integrações diretas com o Gemini.
 * 
 * Para usar esta funcionalidade, consulte:
 * - src/services/modelControlService.ts
 * - src/integrations/gemini/client.ts
 */

// Exemplo de como a funcionalidade é implementada no cliente:

/*
export async function generateBatchPlans(
  documentContent: string, 
  context?: string, 
  userId?: string
): Promise<any[]> {
    const prompt = `
      Analise o seguinte documento e identifique AUTONOMAMENTE diferentes funcionalidades, sistemas ou módulos que necessitam de planos de teste específicos.

      DOCUMENTO:
      ${documentContent}

      ${context ? `CONTEXTO ADICIONAL: ${context}` : ''}

      INSTRUÇÕES IMPORTANTES:
      - Analise o documento e identifique automaticamente as diferentes funcionalidades/sistemas
      - Para cada funcionalidade identificada, crie um plano de teste específico e focado
      - Seja DIRETO e ESPECÍFICO, evite contexto desnecessário
      - Cada plano deve ser independente e testável
      - Gere apenas o essencial baseado nas informações fornecidas

      Retorne um JSON válido com esta estrutura EXATA:
      {
        "plans": [
          {
            "title": "título específico do plano",
            "description": "descrição direta e objetiva",
            "objective": "objetivo claro do teste",
            "scope": "escopo específico a ser testado",
            "approach": "abordagem de teste direta",
            "criteria": "critérios de aceite objetivos",
            "resources": "recursos necessários",
            "schedule": "estimativa de cronograma",
            "risks": "principais riscos identificados"
          }
        ]
      }

      IMPORTANTE: Gere quantos planos forem necessários baseado na análise do documento, mas seja específico e direto.
    `;

  try {
    // Usar a função de generateStructuredContent da integração com o Gemini
    const generatedData = await generateStructuredContent<{plans: any[]}>(prompt);

    if (!generatedData.plans || !Array.isArray(generatedData.plans)) {
      throw new Error('Formato de resposta inválido: plans array esperado');
    }

    // Adicionar IDs únicos para cada plano
    const plansWithIds = generatedData.plans.map((plan) => ({
      ...plan,
      id: crypto.randomUUID(),
      user_id: userId,
      generated_by_ai: true,
      created_at: new Date(),
      updated_at: new Date()
    }));

    return plansWithIds;

  } catch (error) {
    console.error('Erro na função de geração em lote:', error);
    throw new Error(`Erro na geração em lote: ${error.message}`);
  }
}
*/
