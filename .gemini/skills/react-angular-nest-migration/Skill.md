# Skill: Migração Segura de React/Lovable para Angular + NestJS

## Objetivo

Ajudar a migrar gradualmente um projeto gerado no Lovable, atualmente em React, para uma arquitetura mais fácil de manter pelo desenvolvedor, usando Angular no front-end e NestJS no back-end, sem perder funcionalidades já implementadas.

O projeto atual já possui muitas funcionalidades prontas, incluindo dashboard interno, Deusa Analytics, mapa de calor, tabela de leads, dados reais da Receita Federal, qualidade cadastral, importação de CNAE, filtros e componentes visuais.

A migração deve ser incremental, segura e documentada.

## Regras principais

1. Não reescrever o projeto inteiro de uma vez.
2. Não apagar o projeto React atual sem criar uma versão equivalente funcionando.
3. Não alterar regras de negócio sem justificar.
4. Não remover funcionalidades existentes.
5. Preservar o design visual criado no Lovable o máximo possível.
6. Preservar os dados reais já integrados da Receita Federal.
7. Preservar contratos de API quando existirem.
8. Preservar banco de dados, migrations, Prisma, CSVs e relatórios.
9. Criar uma branch de migração antes de qualquer alteração grande.
10. Validar build e funcionamento a cada etapa.

## Contexto do projeto

O projeto foi criado inicialmente no Lovable e o front-end veio em React.

O desenvolvedor principal tem mais facilidade com Angular e deseja migrar o front-end para Angular para manutenção futura.

O back-end deve ser NestJS, se ainda não estiver estruturado dessa forma. Caso o back-end já seja NestJS, apenas revisar e organizar a arquitetura.

O projeto possui ou pode possuir:

- React no front-end;
- Vite ou outra estrutura gerada pelo Lovable;
- dashboard interno da Deusa;
- Deusa Analytics / Bloco B;
- mapa de calor;
- dados reais da Receita Federal;
- CSV de CNAE 4712100;
- filtros;
- tabela de leads;
- detalhamento de lead;
- backend com NestJS;
- Prisma/PostgreSQL;
- serviços de importação;
- provider da Receita Federal;
- relatórios de qualidade.

## Primeiro passo obrigatório: auditoria

Antes de migrar qualquer coisa, analisar o projeto atual e gerar um relatório com:

1. Stack atual do front-end.
2. Stack atual do back-end.
3. Estrutura de pastas.
4. Rotas existentes.
5. Páginas principais.
6. Componentes React principais.
7. Serviços de API existentes.
8. Hooks e estados globais.
9. Bibliotecas de UI usadas.
10. Bibliotecas de mapa usadas.
11. Bibliotecas de gráficos usadas.
12. CSS/Tailwind/shadcn usados.
13. Endpoints consumidos.
14. Modelos de dados.
15. Funcionalidades críticas.
16. Arquivos que não podem ser removidos.
17. Riscos da migração.

Não implementar nada antes desse relatório.

## Estratégia recomendada

Usar migração por equivalência funcional.

Para cada tela React existente, criar a versão Angular equivalente, mantendo:

- layout;
- cores;
- textos;
- cards;
- filtros;
- comportamento;
- chamadas de API;
- dados exibidos;
- regras de validação;
- responsividade.

A migração deve seguir esta ordem:

1. Mapear funcionalidades existentes.
2. Congelar contrato de API.
3. Criar projeto Angular paralelo.
4. Migrar layout base.
5. Migrar componentes compartilhados.
6. Migrar dashboard.
7. Migrar tabela de leads.
8. Migrar filtros.
9. Migrar mapa de calor.
10. Migrar detalhe do lead.
11. Integrar com back-end NestJS.
12. Comparar React vs Angular.
13. Só depois remover React, se tudo estiver validado.

## Não fazer

Não converter automaticamente todos os arquivos `.tsx` para `.ts` sem entender a lógica.

Não tentar transformar componentes React em Angular de forma literal.

Não misturar React e Angular no mesmo app final sem necessidade.

Não apagar mocks, dados, serviços ou estilos antes de confirmar que não são usados.

Não modificar banco de dados durante a migração do front-end, a menos que seja necessário e documentado.

## Back-end NestJS

Se o back-end ainda não for NestJS:

1. Criar um projeto NestJS separado.
2. Implementar módulos por domínio:
   - companies;
   - leads;
   - imports;
   - analytics;
   - map-opportunities;
   - receita-federal;
   - geocoding, se existir;
   - auth, se necessário.
3. Preservar contratos usados pelo front.
4. Usar DTOs.
5. Usar services.
6. Usar controllers.
7. Usar Prisma/PostgreSQL, se já existir ou for necessário.
8. Criar documentação dos endpoints.

Se o back-end já for NestJS:

1. Não recriar o back-end.
2. Apenas organizar módulos existentes.
3. Verificar controllers, services, providers e DTOs.
4. Garantir que o Angular consiga consumir os endpoints atuais.

## Front-end Angular

Criar uma aplicação Angular com:

- Angular standalone components, se fizer sentido;
- Angular Router;
- Services para chamadas HTTP;
- Interfaces TypeScript para modelos;
- Guards, se houver autenticação;
- Componentes reutilizáveis;
- Separação por features.

Estrutura sugerida:

src/app/
  core/
    services/
    models/
    interceptors/
    guards/
  shared/
    components/
    pipes/
    utils/
  features/
    dashboard/
    analytics/
    leads/
    map/
    imports/
    settings/

## Componentes Angular esperados

Criar equivalentes Angular para:

1. Layout interno.
2. Sidebar.
3. Header.
4. Cards de indicadores.
5. Dashboard da Deusa.
6. Mapa de calor.
7. Tabela de leads.
8. Filtros.
9. Badges de qualidade.
10. Detalhe do lead.
11. Funil comercial.
12. Importação de CNPJs.
13. Relatórios de qualidade.

## Mapa de calor

Preservar a lógica atual:

- dados reais da Receita Federal;
- coordenada aproximada por município;
- jitter determinístico por CNPJ, se já existir;
- origemCoordenada;
- statusVerificacaoEndereco;
- confiancaVerificacao;
- aviso de localização aproximada;
- popup com detalhes;
- filtros por cidade, oportunidade e status.

Nunca apresentar coordenada aproximada como endereço real.

## Dados reais

Preservar integração com:

dadosCNAE/sp_4712100_estabelecimentos.csv

ou outro caminho já usado no projeto.

Preservar:

- ReceitaFederalProvider;
- relatório de qualidade;
- leads_para_validacao_manual.csv;
- validação de CNPJ;
- pontuação de oportunidade;
- confiança cadastral;
- pendências de validação.

## Contrato de API

Antes de migrar o front, documentar os endpoints usados pelo React atual.

Para cada endpoint, registrar:

- método;
- rota;
- query params;
- body;
- response;
- tela que usa;
- componente que consome;
- exemplo de resposta.

Criar arquivo:

docs/api-contracts.md

O Angular deve consumir esses mesmos contratos sempre que possível.

## Plano de execução

A execução deve ser feita em fases.

### Fase 1 — Auditoria

Gerar relatório completo do projeto atual.

### Fase 2 — Contratos

Documentar rotas, telas, componentes e APIs.

### Fase 3 — Angular base

Criar estrutura Angular sem remover React.

### Fase 4 — Design system

Migrar cores, layout, tipografia, sidebar, header, cards e badges.

### Fase 5 — Dashboard

Migrar dashboard com indicadores reais.

### Fase 6 — Leads

Migrar tabela de leads, filtros e detalhe.

### Fase 7 — Mapa

Migrar mapa de calor e popups.

### Fase 8 — Integração

Conectar Angular ao back-end/NestJS.

### Fase 9 — Testes

Comparar telas React e Angular lado a lado.

### Fase 10 — Corte final

Só remover React quando Angular estiver completo e validado.

## Critérios de aceite

A migração só pode ser considerada concluída quando:

1. Angular roda sem erro.
2. Backend roda sem erro.
3. Dashboard Angular mostra os mesmos dados do React.
4. Mapa Angular mostra os mesmos dados do React.
5. Tabela Angular mostra os mesmos leads.
6. Filtros funcionam.
7. Detalhe do lead funciona.
8. Dados reais continuam sendo usados.
9. Nenhum mock volta para o sistema.
10. Build do Angular passa.
11. Build do NestJS passa.
12. Documentação da migração foi criada.
13. React só foi removido depois de validação.

## Relatório final obrigatório

Ao final de cada fase, entregar:

1. O que foi analisado.
2. O que foi criado.
3. O que foi modificado.
4. O que ainda falta.
5. Riscos encontrados.
6. Arquivos impactados.
7. Comandos executados.
8. Resultado do build.
9. Próxima etapa recomendada.

## Comandos esperados

Sempre que possível, executar:

Backend:
npm run build

Frontend React atual:
npm run build

Frontend Angular novo:
npm run build

Se houver testes:
npm test

## Princípio principal

Migrar para Angular e NestJS sem perder o que já foi construído.

A prioridade é preservar valor, dados reais e funcionamento antes de trocar tecnologia.