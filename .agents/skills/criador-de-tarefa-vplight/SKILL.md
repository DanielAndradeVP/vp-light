---
name: criador-de-tarefa-vplight
description: "Cria tarefas do vp-light diretamente no banco de dados do Notion (base de tarefas VPLight). Use SEMPRE que Dan descrever um bug, funcionalidade nova, melhoria ou qualquer trabalho a ser feito no vp-light e quiser registrar como tarefa. Ativar quando mencionar: 'cria a tarefa', 'adiciona no notion', 'registra isso', 'salva como tarefa', 'anota isso', 'cria um card', ou descrever uma mudança no sistema pedindo para registrar. A skill usa o engenheiro-de-prompt-vplight internamente para formatar o conteúdo da tarefa antes de criar no Notion."
---
 
# criador-de-tarefa-vplight
 
Cria tarefas no banco de dados **base de tarefas VPLight** no Notion, no formato padrão estabelecido com Dan. Usa a lógica do `engenheiro-de-prompt-vplight` para formatar o conteúdo antes de persistir.
 
---
 
## Banco de dados Notion
 
- **ID do banco:** `e8de6057-6be1-427e-ab27-f597941a58b8`
- **URL:** `https://app.notion.com/p/e8de60576be1427eab27f597941a58b8`
- **Data source:** `collection://567fddec-94ac-46f7-b942-6abb4df19298`
- **Template ID:** `0968fe4f-cbed-4ded-9824-945242a293b0`
- **Propriedades:**
  - `Tarefa` (título)
  - `Status`: `🔴 Pendente` | `✅ Concluída`
---
 
## Skill correta por tipo de tarefa
 
Antes de escrever a descrição, identifica qual skill deve executar a tarefa:
 
| Tipo de trabalho | Skill |
|---|---|
| Engine DMX, IPC, scripts, show.json, Art-Net, preload | `/desenvolvedor-backend-vplight` |
| Interface, componentes visuais, layout, CSS, React UI | `/desenvolvedor-frontend-vplight` |
| Scripts de efeito DMX, chases, fades, strobos | `/engenheiro-de-script-vplight` |
| Banco de conhecimento de fixtures (.md) | `/engenheiro-de-banco-de-conhecimento-vplight` |
| Tarefas mistas (backend + frontend) | lista as duas skills |
 
---
 
## Formato da descrição da tarefa
 
A descrição vai dentro de um bloco `<details>` (toggle recolhível) e segue esta estrutura:
 
```
**Skill que você deve utilizar para desenvolver esta tarefa:** /nome-da-skill
 
**Arquivos:** lista dos arquivos envolvidos
 
**Problema atual:** o que está errado ou o que falta
 
**Implementar:**
1. ...
2. ...
3. ...
 
**Critério de sucesso:** como saber que está pronto
 
**Restrições:** o que não pode ser alterado / cuidados
```
 
### Estilo do conteúdo (regras do engenheiro-de-prompt-vplight)
 
- Tom de tech lead passando tarefa para desenvolvedor sênior
- Descreve o problema e o comportamento esperado — sem código inline, sem localização linha a linha
- Menciona arquivos apenas quando não for óbvio
- Objetivo e direto — sem explicação de motivação
---
 
## Estrutura Notion da página de tarefa
 
Cada tarefa criada deve ter este conteúdo exato:
 
```
[callout ⚙️ cinza]
  **Como usar esta tarefa**
  - Use **Status** para marcar: 🔴 Pendente / ✅ Concluída.
  - A descrição abaixo é recolhível (toggle).
  - Ao final do desenvolvimento, atualize o status para ✅ Concluída
    (a capa da tarefa deve mudar para o ✅ verde).
 
[toggle] Ver descrição
  [conteúdo da tarefa no formato acima]
```
 
---
 
## Passo a passo de execução
 
1. **Entender o pedido** — extrair da descrição de Dan: qual é o problema, qual é o comportamento esperado, quais arquivos estão envolvidos.
2. **Identificar a skill correta** — com base na tabela acima.
3. **Redigir a descrição** — no estilo do `engenheiro-de-prompt-vplight`: direto, sem código, sem linha a linha. Preencher todos os campos: Skill, Arquivos, Problema atual, Implementar, Critério de sucesso, Restrições.
4. **Criar a página no Notion** — usando `notion-create-pages` com:
   - `parent.data_source_id`: `567fddec-94ac-46f7-b942-6abb4df19298`
   - `properties.Tarefa`: título da tarefa
   - `properties.Status`: `🔴 Pendente`
   - `icon`: `🔴`
   - `content`: callout + toggle com a descrição
5. **Confirmar para Dan** — informar o título da tarefa criada e o link da página no Notion.
---
 
## Exemplo de conteúdo Notion (Markdown)
 
```markdown
> [!NOTE] ⚙️ Como usar esta tarefa
> - Use **Status** para marcar: 🔴 Pendente / ✅ Concluída.
> - A descrição abaixo é recolhível (toggle).
> - Ao final do desenvolvimento, atualize o status para ✅ Concluída (a capa da tarefa deve mudar para o ✅ verde).
 
<details>
<summary>Ver descrição</summary>
 
**Skill que você deve utilizar para desenvolver esta tarefa:** /desenvolvedor-backend-vplight
 
**Arquivos:** electron/main.js, electron/preload.js
 
**Problema atual:** ...
 
**Implementar:**
1. ...
 
**Critério de sucesso:** ...
 
**Restrições:** ...
 
</details>
```
 
---
 
## Marcar tarefa como concluída
 
Quando Dan disser "tarefa X concluída":
 
1. Buscar a tarefa no Notion com `notion-search` pelo nome
2. Atualizar com `notion-update-page` → `update_properties`:
   - `Status`: `✅ Concluída`
   - `icon`: `✅`
3. Confirmar para Dan
---
 
## O que esta skill não faz
 
- Não implementa código
- Não gera prompts para copiar — cria direto no Notion
- Não altera tarefas já concluídas sem confirmação de Dan