#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Script de Melhoria de Qualidade de Código
 * ==========================================
 * 
 * Este script implementa um sistema automatizado para:
 * 1. Detectar duplicações de código
 * 2. Identificar problemas de tipos
 * 3. Corrigir warnings comuns
 * 4. Melhorar estrutura do projeto
 */

class CodeQualityFixer {
  constructor() {
    this.srcPath = path.join(__dirname, '../src');
    this.errors = [];
    this.fixes = [];
  }

  // Executar todas as verificações e correções
  async fixAll() {
    console.log('🔧 Iniciando correções de qualidade de código...\n');

    try {
      await this.detectDuplicateFiles();
      await this.fixCommonTSErrors();
      await this.optimizeImports();
      await this.validateBuild();
      
      this.printSummary();
    } catch (error) {
      console.error('❌ Erro durante execução:', error);
    }
  }

  // Detectar arquivos com duplicações
  async detectDuplicateFiles() {
    console.log('🔍 Detectando duplicações...');
    
    const files = this.getAllTSFiles();
    const duplicates = new Map();
    
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');
        
        // Procurar por padrões de duplicação
        const exportPattern = /^export (class|function|interface)/;
        const importPattern = /^import.*from/;
        
        let exportCount = 0;
        let importLines = [];
        
        lines.forEach((line, index) => {
          if (exportPattern.test(line.trim())) {
            exportCount++;
            if (exportCount > 1) {
              if (!duplicates.has(file)) {
                duplicates.set(file, []);
              }
              duplicates.get(file).push({
                type: 'duplicate_export',
                line: index + 1,
                content: line.trim()
              });
            }
          }
          
          if (importPattern.test(line.trim())) {
            if (importLines.includes(line.trim())) {
              if (!duplicates.has(file)) {
                duplicates.set(file, []);
              }
              duplicates.get(file).push({
                type: 'duplicate_import',
                line: index + 1,
                content: line.trim()
              });
            }
            importLines.push(line.trim());
          }
        });
        
      } catch (error) {
        console.warn(`⚠️ Erro lendo arquivo ${file}:`, error.message);
      }
    }
    
    if (duplicates.size > 0) {
      console.log(`❌ Encontradas duplicações em ${duplicates.size} arquivos:`);
      duplicates.forEach((issues, file) => {
        console.log(`   📄 ${path.relative(this.srcPath, file)}: ${issues.length} problemas`);
      });
    } else {
      console.log('✅ Nenhuma duplicação detectada');
    }
  }

  // Corrigir erros comuns de TypeScript
  async fixCommonTSErrors() {
    console.log('\n🔧 Corrigindo erros comuns de TypeScript...');
    
    const fixes = [
      {
        name: 'Empty object pattern',
        pattern: /export const.*= \(\{\}\)/,
        replacement: 'export const $1 = ({ children })',
        description: 'Corrigindo empty object patterns'
      },
      {
        name: 'Any types em catch blocks',
        pattern: /catch \((\w+)\) \{[\s\S]*?console\.error.*?\1/g,
        replacement: 'catch ($1: unknown) {\n        console.error',
        description: 'Tipando catch blocks'
      },
      {
        name: 'Interfaces vazias',
        pattern: /interface \w+Props\s*extends[^{]*\{\s*\}/,
        replacement: '',
        description: 'Removendo interfaces vazias desnecessárias'
      }
    ];
    
    let fixedFiles = 0;
    const files = this.getAllTSFiles();
    
    for (const file of files) {
      try {
        let content = fs.readFileSync(file, 'utf8');
        let modified = false;
        
        fixes.forEach(fix => {
          if (fix.pattern.test(content)) {
            content = content.replace(fix.pattern, fix.replacement);
            modified = true;
            this.fixes.push(`${fix.description} em ${path.relative(this.srcPath, file)}`);
          }
        });
        
        if (modified) {
          fs.writeFileSync(file, content, 'utf8');
          fixedFiles++;
        }
        
      } catch (error) {
        this.errors.push(`Erro processando ${file}: ${error.message}`);
      }
    }
    
    console.log(`✅ ${fixedFiles} arquivos corrigidos automaticamente`);
  }

  // Otimizar imports
  async optimizeImports() {
    console.log('\n📦 Otimizando imports...');
    
    try {
      // Executar organização automática de imports
      execSync('npx organize-imports-cli src/**/*.{ts,tsx}', { 
        stdio: 'pipe',
        cwd: path.join(__dirname, '..')
      });
      console.log('✅ Imports organizados automaticamente');
    } catch (error) {
      console.log('⚠️ organize-imports-cli não disponível, pulando...');
    }
  }

  // Validar build
  async validateBuild() {
    console.log('\n🏗️ Validando build...');
    
    try {
      // Verificar TypeScript
      execSync('npx tsc --noEmit', { 
        stdio: 'pipe',
        cwd: path.join(__dirname, '..')
      });
      console.log('✅ TypeScript: Sem erros');
      
      // Verificar build
      execSync('npm run build', { 
        stdio: 'pipe',
        cwd: path.join(__dirname, '..')
      });
      console.log('✅ Build: Sucesso');
      
    } catch (error) {
      console.log('❌ Erros encontrados no build');
      this.errors.push('Build falhou após correções');
    }
  }

  // Obter todos os arquivos TypeScript
  getAllTSFiles() {
    const files = [];
    
    const walkDir = (dir) => {
      const items = fs.readdirSync(dir);
      
      items.forEach(item => {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          walkDir(fullPath);
        } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
          files.push(fullPath);
        }
      });
    };
    
    walkDir(this.srcPath);
    return files;
  }

  // Imprimir resumo
  printSummary() {
    console.log('\n📊 RESUMO DAS CORREÇÕES');
    console.log('========================');
    
    if (this.fixes.length > 0) {
      console.log(`✅ ${this.fixes.length} correções aplicadas:`);
      this.fixes.forEach(fix => console.log(`   • ${fix}`));
    }
    
    if (this.errors.length > 0) {
      console.log(`\n❌ ${this.errors.length} erros encontrados:`);
      this.errors.forEach(error => console.log(`   • ${error}`));
    }
    
    if (this.fixes.length === 0 && this.errors.length === 0) {
      console.log('✨ Código já está em ótima qualidade!');
    }
    
    console.log('\n🎯 PRÓXIMOS PASSOS RECOMENDADOS:');
    console.log('1. Execute: npm run build');
    console.log('2. Execute: npm run lint');
    console.log('3. Teste funcionalidades críticas');
    console.log('4. Considere adicionar testes unitários');
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const fixer = new CodeQualityFixer();
  fixer.fixAll().catch(console.error);
}

module.exports = { CodeQualityFixer }; 