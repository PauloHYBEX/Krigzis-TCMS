
import { TestPlan, TestCase, TestExecution, Requirement, Defect } from '@/types';
import { priorityLabel, testCaseTypeLabel, executionStatusLabel } from '@/lib/labels';

export type ExportFormat = 'pdf' | 'word' | 'txt' | 'md';

// Função de tradução de status
const translateStatus = (status: string) => {
  const statusMap: { [key: string]: string } = {
    'open': 'aberto',
    'closed': 'fechado',
    'in_progress': 'em andamento',
    'resolved': 'resolvido',
    'pending': 'pendente',
    'approved': 'aprovado',
    'rejected': 'rejeitado',
    'active': 'ativo',
    'inactive': 'inativo',
    'draft': 'rascunho',
    'review': 'em revisão'
  };
  return statusMap[status] || status;
};

// Helpers de formatação para exportação
const normalizeText = (s?: string) => (s ?? '').toString().trim();

const hasListMarkers = (s: string) => {
  return /^(?:[-•\u00BA]|#\d+\s+)/m.test(s) || /\n\s*[-•\u00BA]/.test(s);
};

// Converte blocos em Markdown com listas quando apropriado
const toMarkdownListOrParagraph = (s: string): string => {
  const text = normalizeText(s);
  if (!text) return '';

  // Caso específico: "Contexto consolidado por caso:" seguido de linhas por caso
  if (text.startsWith('Contexto consolidado por caso:')) {
    const [, ...lines] = text.split(/\r?\n/);
    const items = lines.filter(Boolean).map(l => l.replace(/^#\d+\s*/, '').trim());
    return ['Contexto consolidado por caso:', ...items.map((i, idx) => `${idx + 1}. ${i}`)].join('\n');
  }

  // Se possuir marcadores comuns ou linhas com '-' já tratamos como lista
  if (hasListMarkers(text)) {
    return text
      .split(/\r?\n/)
      .map(l => {
        const t = l.trim();
        if (!t) return '';
        if (/^[-•]/.test(t)) return `- ${t.replace(/^[-•]\s*/, '')}`;
        if (/^\u00BA/.test(t)) return `- ${t.replace(/^\u00BA\s*/, '')}`; // º
        if (/^#\d+\s+/.test(t)) return `- ${t.replace(/^#\d+\s+/, '')}`;
        return t;
      })
      .join('\n');
  }

  // Heurística para branches: se mencionar "branch"(es) e conter vírgulas, quebrar em lista com marcador 'º'
  if (/branch/i.test(text) && text.includes(',')) {
    const parts = text
      .split(/[:,]/)
      .map(p => p.trim())
      .filter(Boolean);
    if (parts.length > 1) {
      const [label, ...rest] = parts;
      const items = rest.map(r => r.replace(/^e\s+/i, '').trim()).filter(Boolean);
      if (items.length) {
        // Usa prefixo literal 'º ' para se aproximar do estilo desejado nos exports Markdown/TXT
        return `${label}:\n${items.map(i => `º ${i}`).join('\n')}`;
      }
    }
  }

  return text;
};

// Converte texto para HTML com listas quando apropriado, preservando quebras de linha
const toHTMLListOrParagraph = (s: string): string => {
  const text = normalizeText(s);
  if (!text) return '';

  const escape = (str: string) => str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const renderUL = (items: string[], bulletPrefix?: string) => {
    return `<ul>${items.map(i => `<li>${bulletPrefix ? `${bulletPrefix}` : ''}${escape(i)}</li>`).join('')}</ul>`;
  };

  // Contexto consolidado por caso
  if (text.startsWith('Contexto consolidado por caso:')) {
    const [label, ...lines] = text.split(/\r?\n/);
    const items = lines.filter(Boolean).map(l => l.replace(/^#\d+\s*/, '').trim());
    const renderOL = (it: string[]) => `<ol>${it.map(i => `<li>${escape(i)}</li>`).join('')}</ol>`;
    return `<p>${escape(label)}</p>${renderOL(items)}`;
  }

  // Linhas com marcadores '-', 'º' ou '#N '
  if (hasListMarkers(text)) {
    const items = text
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean)
      .map(l => l.replace(/^[-•\u00BA]\s*/, '').replace(/^#\d+\s+/, ''));
    return renderUL(items);
  }

  // Heurística de branches: contém 'branch' e vírgulas
  if (/branch/i.test(text) && text.includes(',')) {
    const [label, rest] = text.split(/:/, 2);
    const items = (rest || '')
      .split(',')
      .map(p => p.replace(/^e\s+/i, '').trim())
      .filter(Boolean);
    if (items.length) {
      // Renderiza como lista sem marcadores padrão e prefixa cada item com 'º '
      return `<p>${escape(label)}:</p><ul style="list-style:none; padding-left:0; margin:0 0 12px 0;">${items.map(i => `<li>º ${escape(i)}</li>`).join('')}</ul>`;
    }
  }

  // Fallback: parágrafos com <br/>
  return `<p>${escape(text).replace(/\r?\n/g, '<br/>')}</p>`;
};

export const exportItem = async (
  item: TestPlan | TestCase | TestExecution | Requirement | Defect,
  type: 'plan' | 'case' | 'execution' | 'requirement' | 'defect',
  format: ExportFormat
) => {
  const content = generateContent(item, type, format);
  const filename = getFilename(item, type, format);
  
  if (format === 'pdf') {
    await exportToPDF(content, filename);
  } else {
    downloadTextFile(content, filename);
  }
};

export const copyToClipboard = async (
  item: TestPlan | TestCase | TestExecution | Requirement | Defect,
  type: 'plan' | 'case' | 'execution' | 'requirement' | 'defect',
  format: ExportFormat
) => {
  const content = generateContent(item, type, format);
  await navigator.clipboard.writeText(content);
};

const generateContent = (
  item: TestPlan | TestCase | TestExecution | Requirement | Defect,
  type: 'plan' | 'case' | 'execution' | 'requirement' | 'defect',
  format: ExportFormat
): string => {
  const title = getItemTitle(item, type);
  const description = getItemDescription(item, type);
  
  switch (format) {
    case 'md':
      return generateMarkdownContent(item, type, title, description);
    case 'txt':
      return generateTextContent(item, type, title, description);
    default:
      return generateHTMLContent(item, type, title, description);
  }
};

const generateMarkdownContent = (
  item: TestPlan | TestCase | TestExecution | Requirement | Defect,
  type: 'plan' | 'case' | 'execution' | 'requirement' | 'defect',
  title: string,
  description: string
): string => {
  let content = `# ${title}\n\n`;
  if (description) {
    content += `## Descrição\n${toMarkdownListOrParagraph(description)}\n\n`;
  }
  
  if (type === 'plan' && 'objective' in item) {
    content += `## Objetivo\n${toMarkdownListOrParagraph((item as any).objective || '')}\n\n`;
    content += `## Escopo\n${toMarkdownListOrParagraph((item as any).scope || '')}\n\n`;
    content += `## Abordagem\n${toMarkdownListOrParagraph((item as any).approach || '')}\n\n`;
    content += `## Critérios\n${toMarkdownListOrParagraph((item as any).criteria || '')}\n\n`;
  }
  
  if (type === 'case' && 'steps' in item) {
    if (item.preconditions) {
      content += `## Pré-condições\n${item.preconditions}\n\n`;
    }
    
    content += `## Passos de Teste\n\n`;
    content += `| Passo | Ação | Resultado Esperado |\n`;
    content += `|-------|------|--------------------|\n`;
    
    item.steps?.forEach((step: any, index: number) => {
      content += `| ${step.order || index + 1} | ${step.action} | ${step.expected_result} |\n`;
    });
    
    if (item.expected_result) {
      content += `\n## Resultado Final Esperado\n${item.expected_result}\n\n`;
    }
    
    if (item.priority) {
      content += `**Prioridade:** ${priorityLabel((item as any).priority)}\n\n`;
    }
    
    if (item.type) {
      content += `**Tipo:** ${testCaseTypeLabel((item as any).type)}\n\n`;
    }
  }
  
  if (type === 'execution') {
    const execution = item as TestExecution;
    content += `## Status\n${executionStatusLabel(execution.status as any)}\n\n`;
    
    if (execution.actual_result) {
      content += `## Resultado Obtido\n${execution.actual_result}\n\n`;
    }
    
    if (execution.executed_by) {
      content += `**Executado por:** ${execution.executed_by}\n\n`;
    }
    
    content += `**Data de Execução:** ${new Date(execution.executed_at as any).toLocaleDateString()}\n\n`;
  }
  
  if (type === 'defect') {
    const defect = item as Defect;
    content += `## Status\n${translateStatus(defect.status)}\n\n`;
    
    if ('severity' in defect && defect.severity) {
      content += `**Severidade:** ${priorityLabel(defect.severity as any)}\n\n`;
    }
    
    if ('priority' in defect && defect.priority) {
      content += `**Prioridade:** ${priorityLabel(defect.priority as any)}\n\n`;
    }
    
    if ('steps_to_reproduce' in defect && defect.steps_to_reproduce) {
      content += `## Passos para Reproduzir\n${toMarkdownListOrParagraph(defect.steps_to_reproduce as string)}\n\n`;
    }
    
    if ('expected_behavior' in defect && defect.expected_behavior) {
      content += `## Comportamento Esperado\n${toMarkdownListOrParagraph(defect.expected_behavior as string)}\n\n`;
    }
    
    if ('actual_behavior' in defect && defect.actual_behavior) {
      content += `## Comportamento Atual\n${toMarkdownListOrParagraph(defect.actual_behavior as string)}\n\n`;
    }
    
    content += `**Data de Criação:** ${new Date(defect.created_at).toLocaleDateString()}\n\n`;
  }
  
  if (type === 'requirement') {
    const requirement = item as Requirement;
    content += `## Status\n${translateStatus(requirement.status)}\n\n`;
    
    if ('type' in requirement && requirement.type) {
      content += `**Tipo:** ${requirement.type}\n\n`;
    }
    
    if ('priority' in requirement && requirement.priority) {
      content += `**Prioridade:** ${priorityLabel(requirement.priority as any)}\n\n`;
    }
    
    if ('acceptance_criteria' in requirement && requirement.acceptance_criteria) {
      content += `## Critérios de Aceitação\n${toMarkdownListOrParagraph(requirement.acceptance_criteria as string)}\n\n`;
    }
    
    content += `**Data de Criação:** ${new Date(requirement.created_at).toLocaleDateString()}\n\n`;
  }
  
  return content;
};

const generateTextContent = (
  item: TestPlan | TestCase | TestExecution | Requirement | Defect,
  type: 'plan' | 'case' | 'execution' | 'requirement' | 'defect',
  title: string,
  description: string
): string => {
  return generateMarkdownContent(item, type, title, description)
    .replace(/#+\s/g, '')
    .replace(/\|.*\|/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\n\n+/g, '\n\n');
};

const generateHTMLContent = (
  item: TestPlan | TestCase | TestExecution | Requirement | Defect,
  type: 'plan' | 'case' | 'execution' | 'requirement' | 'defect',
  title: string,
  description: string
): string => {
  let html = `<h1>${title}</h1>`;
  if (description) {
    html += `<h2>Descrição</h2>${toHTMLListOrParagraph(description)}`;
  }
  
  if (type === 'plan' && 'objective' in item) {
    html += `<h2>Objetivo</h2>${toHTMLListOrParagraph((item as any).objective || '')}`;
    html += `<h2>Escopo</h2>${toHTMLListOrParagraph((item as any).scope || '')}`;
    html += `<h2>Abordagem</h2>${toHTMLListOrParagraph((item as any).approach || '')}`;
    html += `<h2>Critérios</h2>${toHTMLListOrParagraph((item as any).criteria || '')}`;
  }
  
  if (type === 'case' && 'steps' in item) {
    if (item.preconditions) {
      html += `<h2>Pré-condições</h2><p>${item.preconditions}</p>`;
    }
    
    html += `<h2>Passos de Teste</h2><table border="1"><tr><th>Passo</th><th>Ação</th><th>Resultado Esperado</th></tr>`;
    
    item.steps?.forEach((step: any, index: number) => {
      html += `<tr><td>${step.order || index + 1}</td><td>${step.action}</td><td>${step.expected_result}</td></tr>`;
    });
    
    html += `</table>`;
    
    if (item.expected_result) {
      html += `<h2>Resultado Final Esperado</h2><p>${item.expected_result}</p>`;
    }

    // Metadados traduzidos
    if ((item as any).priority) {
      html += `<p><strong>Prioridade:</strong> ${priorityLabel((item as any).priority)}</p>`;
    }
    if ((item as any).type) {
      html += `<p><strong>Tipo:</strong> ${testCaseTypeLabel((item as any).type)}</p>`;
    }
  }
  
  if (type === 'execution') {
    const execution = item as TestExecution;
    html += `<h2>Status</h2><p>${executionStatusLabel(execution.status as any)}</p>`;
    
    if (execution.actual_result) {
      html += `<h2>Resultado Obtido</h2><p>${execution.actual_result}</p>`;
    }
    
    if (execution.executed_by) {
      html += `<p><strong>Executado por:</strong> ${execution.executed_by}</p>`;
    }
    
    html += `<p><strong>Data de Execução:</strong> ${execution.executed_at.toLocaleDateString()}</p>`;
  }
  
  if (type === 'defect') {
    const defect = item as Defect;
    html += `<h2>Status</h2><p>${translateStatus(defect.status)}</p>`;
    
    if ('severity' in defect && defect.severity) {
      html += `<p><strong>Severidade:</strong> ${priorityLabel(defect.severity as any)}</p>`;
    }
    
    if ('priority' in defect && defect.priority) {
      html += `<p><strong>Prioridade:</strong> ${priorityLabel(defect.priority as any)}</p>`;
    }
    
    if ('steps_to_reproduce' in defect && defect.steps_to_reproduce) {
      html += `<h2>Passos para Reproduzir</h2>${toHTMLListOrParagraph(defect.steps_to_reproduce as string)}`;
    }
    
    if ('expected_behavior' in defect && defect.expected_behavior) {
      html += `<h2>Comportamento Esperado</h2>${toHTMLListOrParagraph(defect.expected_behavior as string)}`;
    }
    
    if ('actual_behavior' in defect && defect.actual_behavior) {
      html += `<h2>Comportamento Atual</h2>${toHTMLListOrParagraph(defect.actual_behavior as string)}`;
    }
    
    html += `<p><strong>Data de Criação:</strong> ${new Date(defect.created_at).toLocaleDateString()}</p>`;
  }
  
  if (type === 'requirement') {
    const requirement = item as Requirement;
    html += `<h2>Status</h2><p>${translateStatus(requirement.status)}</p>`;
    
    if ('type' in requirement && requirement.type) {
      html += `<p><strong>Tipo:</strong> ${requirement.type}</p>`;
    }
    
    if ('priority' in requirement && requirement.priority) {
      html += `<p><strong>Prioridade:</strong> ${priorityLabel(requirement.priority as any)}</p>`;
    }
    
    if ('acceptance_criteria' in requirement && requirement.acceptance_criteria) {
      html += `<h2>Critérios de Aceitação</h2>${toHTMLListOrParagraph(requirement.acceptance_criteria as string)}`;
    }
    
    html += `<p><strong>Data de Criação:</strong> ${new Date(requirement.created_at).toLocaleDateString()}</p>`;
  }
  
  return html;
};

const getItemTitle = (item: TestPlan | TestCase | TestExecution | Requirement | Defect, type: 'plan' | 'case' | 'execution' | 'requirement' | 'defect'): string => {
  if (type === 'execution') {
    const seq = 'sequence' in item && (item as any).sequence ? (item as any).sequence : item.id.slice(0, 8);
    return `Execução #${seq}`;
  }
  return (item as TestPlan | TestCase | Requirement | Defect).title;
};

const getItemDescription = (item: TestPlan | TestCase | TestExecution | Requirement | Defect, type: 'plan' | 'case' | 'execution' | 'requirement' | 'defect'): string => {
  if (type === 'execution') {
    return (item as TestExecution).notes || '';
  }
  return (item as TestPlan | TestCase | Requirement | Defect).description || '';
};

const getFilename = (item: TestPlan | TestCase | TestExecution | Requirement | Defect, type: 'plan' | 'case' | 'execution' | 'requirement' | 'defect', format: ExportFormat): string => {
  const title = getItemTitle(item, type);
  const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
  return `${sanitizedTitle}.${format}`;
};

const exportToPDF = async (content: string, filename: string) => {
  // Para PDF, vamos criar um HTML e usar a API de impressão do navegador
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${filename}</title>
          <style>
            @page { size: A4; margin: 12mm; }
            html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body { font-family: Arial, sans-serif; margin: 0; font-size: 12px; color: #111; line-height: 1.4; }
            h1, h2 { color: #333; margin: 0 0 10px 0; page-break-after: avoid; }
            hr { border: 0; border-top: 1px solid #ddd; margin: 12px 0; }
            table { border-collapse: collapse; width: 100%; margin: 12px 0 20px 0; table-layout: auto; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
            th { background-color: #f5f5f5; font-weight: bold; }
            tr { page-break-inside: avoid; }
            p { white-space: pre-wrap; }
            ul { margin: 0 0 12px 20px; padding: 0; }
            li { margin: 4px 0; }
          </style>
        </head>
        <body>
          <p style="font-size:11px;color:#555;margin:0 0 8px 0">Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
          ${content}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    };
  }
};

const downloadTextFile = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
