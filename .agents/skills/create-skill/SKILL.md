---
name: create-skill
description: Guide the user to turn a conversation workflow or decision process into a reusable SKILL.md file. Use when a user wants to define a new agent skill, document a pattern, or create an agent customization workflow.
---

# create-skill

Ajuda o usuário a criar uma nova habilidade (`SKILL.md`) para agentes personalizados.

## Quando usar

- O usuário quer transformar um fluxo de conversa em um skill reutilizável.
- O usuário precisa documentar um processo ou checklist como uma habilidade do agente.
- O usuário está criando ou refinando `SKILL.md` para um workspace personalizado.

## O que este skill faz

1. Revisa a conversa e identifica se há um fluxo de trabalho claro.
2. Extrai passos, decisões e critérios de qualidade.
3. Decide se a habilidade deve ser workspace-scoped ou pessoal.
4. Pede esclarecimentos quando o resultado não estiver claro.
5. Gera um rascunho de `SKILL.md` com estrutura e instruções precisas.
6. Sugere exemplos de prompts de uso e possíveis customizações relacionadas.

## Passo a passo

1. Leia o histórico de conversa completo e anote o objetivo do usuário.
2. Identifique se já existe um processo multi-etapa ou apenas um pedido simples.
3. Se não houver clareza, pergunte:
   - Qual resultado exato o skill deve produzir?
   - Isto é para um workspace específico ou para uso pessoal?
   - Precisa de checklist rápido ou de um workflow completo?
4. Crie um rascunho de `SKILL.md` com:
   - cabeçalho YAML `name` e `description`
   - explicação de quando usar o skill
   - instruções passo a passo
   - critérios de aceitação ou verificação
   - exemplos de prompts de teste
5. Revise o rascunho e peça feedback sobre ambiguidades.
6. Finalize o `SKILL.md` e confirme onde o arquivo deve ser salvo.

## Critérios de qualidade

- A habilidade deve ser clara e acionável.
- Deve conter instruções específicas em linguagem natural.
- Deve indicar quando e como solicitar esclarecimentos.
- Deve incluir exemplos simples de uso.
- Deve evitar dependências externas não solicitadas.

## Exemplo de prompts para usar este skill

- "Ajude-me a criar um SKILL.md para documentar o fluxo de revisão de código deste projeto."
- "Transforme nosso método de implementação de scripts de efeito em um novo skill para o workspace."
- "Preciso de um skill que explique como extrair a lógica de um ticket em etapas e critérios de aceitação."

## Observações

- Sempre verifique se o skill está sendo escrito com base no contexto da conversa atual.
- Se o usuário quer criar uma nova habilidade para este projeto, salve em `.agents/skills/<nome-da-skill>/SKILL.md`.
