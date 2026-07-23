# Bateamento — Paginação de scripts (F1–F12), macros e classificação lento/rápido

## Origem

Pedido do Dan em 2026-07-18: auditoria técnica sênior read-only sobre a área de
execução de scripts do VP-LIGHT, como preparação para uma implementação futura
(não incluída neste pedido).

## Escopo bruto do pedido

Hoje existem 12 botões de execução de scripts, associados às teclas F1–F12.
O objetivo futuro (não implementar agora) é evoluir essa área para suportar:

- 50 novos scripts funcionais.
- 20 macros (macro = sequência ou combinação de vários scripts).
- 5 páginas de scripts, cada uma reaproveitando os slots F1–F12 (capacidade
  teórica de 60 slots de script, sem virar 60 implementações hardcoded).
- Troca de página clara, sem quebrar atalhos, engine DMX, estados, presets,
  blackout, freeze, cenas ou regras de negócio atuais.
- Indicação visual, nos próprios botões F-Key, de scripts lentos/suaves vs.
  rápidos/intensos — classificação que não pode depender só do nome do
  arquivo nem só de cor (acessibilidade).
- Ainda em aberto: se macros compartilham os slots das páginas de script ou
  têm área/modo próprio — a auditoria deve recomendar.

## Fases pedidas (auditoria, sem implementação)

1. Auditoria completa do sistema (estrutura, Electron, engine DMX, show,
   fixtures, canais, scripts, blackout, freeze, cenas, presets, atalhos,
   persistência, logs, testes, build, dependências, acoplamento,
   concorrência, arquitetura já existente de macros/cues/timelines).
2. Auditoria focada nos botões F1–F12 (origem dos 12 slots, hardcode,
   fluxo tecla→script→DMX, botão vs. teclado, estado de script ativo,
   cores/labels, conflitos de atalho).
3. Regras de negócio atuais confirmadas por código (exclusividade por
   fixture/canal, prioridade, cancelamento, fades, blackout, freeze,
   calibração, scripts contínuos/temporários, dependências entre scripts).
4. Classificação lento/rápido dos scripts — modelo de metadados recomendado
   (sem implementar).
5. Paginação — comparação de abordagens (arrays hardcoded, config central,
   registro global + layout, geração automática, config no show.json) com
   recomendação decisiva.
6. Macros — o que já existe reaproveitável, e recomendação arquitetural
   sobre slots compartilhados vs. área própria.
7. Registro de riscos + plano futuro de implementação em etapas pequenas
   (sem executar) + plano de testes.

## Papéis de execução

- **Fable 5** — mente da auditoria: raciocina, decide o foco, cruza
  evidências, identifica riscos, conclui os problemas.
- **codex-xhigh** — executor/apoio: lê arquivos, busca trechos, coleta
  evidências, mapeia fluxos, devolve achados organizados para o Fable 5
  analisar. Não decide escopo sozinho.

## Restrições

- Somente leitura e análise. Nenhuma implementação, alteração, formatação ou
  refatoração de código-fonte do projeto.
- Nenhuma conclusão baseada só no visual da interface — tudo confirmado no
  código, com referência de arquivo e linha/trecho.

## Contexto relevante já existente no repositório

- `docs/auditorias/exploracao/v2-atual/05-07-2026-auditoria-completa-vp-light-v2.md`
  — auditoria geral anterior (2026-07-05), cobre arquitetura geral, engine,
  riscos de scripts travando a engine, macros quebradas no show, etc. Deve
  ser usada como ponto de partida, mas **revalidada contra o código atual**
  (13 dias de diferença, com trabalho recente de "fire 2026"/50 scripts).
- `docs/auditorias/bateamento/auditoria-fable5-fire-scripts.md` — auditoria
  Fable 5 anterior sobre o plano dos 50 scripts fire, já toca no mecanismo de
  injeção de preset em `main.js` e nos 14 scripts atuais.
- `docs/planejamentos/fire-2026/` — planejamento em andamento do pacote de
  50 scripts fire (relacionado, mas não é o mesmo escopo desta auditoria).

## Mina definida

`paginacao-fkeys-macros` → `docs/auditorias/exploracao/paginacao-fkeys-macros/`
