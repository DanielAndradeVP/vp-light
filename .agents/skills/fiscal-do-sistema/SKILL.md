---
name: fiscal-do-sistema
description: "Sincronizador de documentação do vp-light. Analisa os arquivos alterados e os em preparação (working tree + staged no git) e atualiza os dois READMEs do projeto: o README_SKILL.md (linguagem de máquina, para agentes/skills) e o README.md (linguagem humana, documentação do sistema). Cada um no seu estilo. Use quando o usuário mexeu no código e disser: 'sincroniza a documentação', 'atualiza os READMEs', 'reflete as mudanças', 'rodei umas alterações, atualiza os docs', 'fiscal-do-sistema', ou após criar/alterar fixture, contrato IPC, tela, script ou token visual. NÃO altera código-fonte — só os dois READMEs."
---

# fiscal-do-sistema

Mantém a documentação do vp-light em dia com o código. Você olha **o que mudou** (arquivos
alterados e os que estão em preparação no git) e **reflete essas mudanças estruturais** nos
dois READMEs do projeto — cada um na sua linguagem.

```
código alterado / em preparação
        │
        ▼
   [ fiscal-do-sistema ]
        ├──► README_SKILL.md   (linguagem de máquina — para o agente/skill)
        └──► README.md         (linguagem humana — documentação do sistema)
```

Você **não** edita código. Você lê o diff e atualiza apenas os dois READMEs.

---

## O que significa "alterados e em preparação"

Detecte o conjunto de mudanças via git, na pasta `C:\vp-light`:

- **Em preparação (staged):** `git diff --cached` / `git status` (index) — o que foi `git add`.
- **Alterados (working tree):** `git diff` / `git status` — modificados ainda não staged.
- **Novos (untracked):** arquivos novos relevantes (ex.: nova tela, novo script).

Considere os três conjuntos. Leia o conteúdo real dos arquivos mudados (não só o nome) para
entender **a mudança estrutural**, não só que houve mudança.

Se não houver mudanças relevantes, diga isso e não toque em nada.

---

## O que conta como mudança estrutural (o que vale documentar)

Foque no que altera a "forma" do sistema:

- Novo/renomeado/removido arquivo em `electron/`, `src/screens/`, `src/store/`, `scripts/`.
- Mudança em contrato IPC: `electron/preload.js` (`window.vp.*`) ou handlers `ipcMain` em `electron/main.js`.
- Mudança no modelo do `show.json` (novos blocos/campos, fixtures, scripts).
- Mudança nas specs da engine (`engine/*.js`): tick, porta, broadcast, universo.
- Mudança no contrato dos scripts de efeito (`OnStart/OnExecute/OnTerminate`, `SetChannel`).
- Novo equipamento/fixture, nova convenção de canais.
- Mudança de tokens visuais em `src/theme.js` (paleta, tipografia, espaçamento).
- Mudança em `package.json` (versão, scripts npm, dependências, build/files).
- Mudança de convenções: SCENE_KEYS, atalhos, F-keys.

**Ignore** mudança puramente cosmética de código que não altera contrato nem estrutura
(refactor interno, renomear variável local, comentário).

---

## Como atualizar cada README — estilos diferentes

### `README_SKILL.md` — linguagem de máquina (para o agente)

Fonte da verdade estrutural. Mantenha o estilo denso e factual já existente:

- Tabelas e blocos de contrato; frases curtas; sem narrativa.
- Só estrutura — **nunca** descreva bugs, pendências ou "o que está quebrado".
- Atualize a seção exata afetada (ex.: §7 IPC, §8 show.json, §12 paleta).
- Se mudar um contrato citado na **§14 (Checklist de validação)**, atualize o checklist também.
- **Sempre** suba a *Versão do documento* e adicione uma linha no *Histórico de mudanças*
  (mais recente no topo), com data absoluta.

### `README.md` — linguagem humana (documentação do sistema)

Documento para pessoas. Mantenha o estilo e as seções já existentes:

- Tom explicativo, instruções de uso, exemplos, troubleshooting.
- Respeite as seções atuais: Instalação, Rodar em desenvolvimento, Estrutura de arquivos,
  Fluxo de dados, Atalhos, Formato do `.show.json`, Scripts de efeito, Agentes de IA,
  Hardware, Troubleshooting.
- Ao refletir uma mudança, edite a seção correspondente em prosa/markdown amigável — não cole
  tabela crua de contrato IPC aqui (isso é coisa do README_SKILL).
- Se a mudança cria um passo de uso novo (ex.: novo atalho, novo fluxo), explique como usar.
- Não precisa de versionamento nem changelog formal aqui (é doc humano), a menos que a seção já exista.

> **Mesma verdade, dois registros.** O fato é o mesmo nos dois arquivos; o que muda é a forma:
> o README_SKILL guarda o contrato seco, o README.md explica para a pessoa.

---

## Processo

1. Rode o git para levantar arquivos alterados + em preparação + novos em `C:\vp-light`.
2. Leia o diff/conteúdo real de cada arquivo relevante e identifique as mudanças **estruturais**.
3. Leia `README_SKILL.md` e `README.md` atuais.
4. Para cada mudança estrutural:
   - aplique edição pontual no `README_SKILL.md` (seção certa + §14 se for contrato);
   - aplique edição pontual no `README.md` (seção certa, em linguagem humana).
5. No `README_SKILL.md`: suba a versão e adicione a linha de histórico.
6. Faça edições cirúrgicas (Edit), não reescreva os arquivos inteiros.
7. Relatório final curto: liste **o que mudou no código → o que foi atualizado em cada README**.

---

## Formato do relatório final

```
Mudanças detectadas: <n> arquivo(s) (alterados/em preparação)

<arquivo de código alterado>
  → README_SKILL.md §<N>: <o que foi atualizado>
  → README.md "<seção>": <o que foi atualizado>
```

Feche com 1 frase: versão nova do README_SKILL e se algo precisa de revisão humana.
Sem postâmbulo longo.

---

## Regras

- Não edita código-fonte. Só `README_SKILL.md` e `README.md`.
- README_SKILL = só estrutura, sem bugs. README.md = doc humano.
- Edições cirúrgicas; preserve tudo que não mudou.
- Em divergência entre código e README, o **código** é a verdade — atualize os READMEs para bater com o código.
- Não invente mudança que não está no diff.
- Sempre data absoluta no histórico do README_SKILL.
