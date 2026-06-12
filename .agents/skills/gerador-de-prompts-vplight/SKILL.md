---
name: gerador-de-prompts-vplight
description: "Gera prompts formatados para o CoWork executar modificações no código do vp-light. Use quando o usuário descrever uma funcionalidade, correção de bug ou alteração de comportamento no vp-light e precisar de um prompt pronto para enviar ao CoWork. Ativar quando mencionar \"prompt\", \"CoWork\", \"gerar instrução\", \"como falar pro CoWork\", ou descrever uma mudança no sistema sem pedir código diretamente."
---

## Contexto do projeto

O vp-light é um software DMX desktop para operação ao vivo, construído em Electron + Node.js + React. O CoWork é o agente que executa modificações diretas no código.

Arquivos principais (mapa rápido para mirar o prompt no lugar certo):

- `electron/main.js` — IPC handlers, engine, execução de scripts
- `electron/preload.js` — bridge `window.vp.*`
- `electron/show.js` — lê/salva o `shows/vp.show.json`
- `electron/engine/engine.js` — loop 40ms (start/stop)
- `electron/engine/universe.js` — `Uint8Array[512]` dos canais DMX
- `electron/engine/artnet.js` — pacote ArtDMX + UDP broadcast
- `src/screens/Main.jsx` — tela principal (mesa, faders, cenas, scripts, páginas)
- `src/screens/FixturePanel.jsx` — tabela/CRUD de aparelhos
- `src/screens/FixtureEditor.jsx` — modal de edição de fixture
- `src/screens/SceneEditor.jsx` — editor de cena (existe, não roteado)
- `src/store/showStore.js` — estado global (React Context)
- `src/theme.js` — tokens visuais
- `scripts/*.js` — scripts de efeito (F1–F12)
- `shows/vp.show.json` — fonte da verdade dos fixtures e cenas

Reinicialização:

- `electron/` → reiniciar `npm run dev`
- `src/` → hot reload automático

## Estilo do prompt

Escreva como um tech lead passando uma tarefa para um desenvolvedor sênior. O desenvolvedor conhece o código — não precisa de localização detalhada, não precisa de código pronto. Precisa entender o problema e o comportamento esperado.

**Formato:**
- 3 a 6 linhas no máximo
- Descreva o que está errado e o que deve acontecer
- Mencione os arquivos envolvidos apenas se não for óbvio
- Sem código, sem localização linha a linha, sem explicação de motivo

**Exemplo de prompt bom:**
```
Em Main.jsx, ao desmarcar uma cena quando há outra ainda ativa, o universo está sendo zerado em vez de reaplicar os canais das cenas restantes. Ao desmarcar qualquer cena, o estado deve sempre refletir a combinação das cenas que ainda estão ativas.
```

**Exemplo de prompt ruim:**
```
No arquivo src/screens/Main.jsx, localize a função handleActivateScene, dentro do bloco const next = prev.filter... substitua por [50 linhas de código]
```

## O que você entrega

Sempre uma caixa de texto com botão de copiar usando este widget HTML:

```html
<style>
  .prompt-box { background: var(--color-background-secondary); border: 0.5px solid var(--color-border-tertiary); border-radius: var(--border-radius-lg); padding: 1rem 1.25rem; margin: 0.5rem 0; }
  .prompt-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .prompt-label { font-size: 12px; color: var(--color-text-secondary); font-family: var(--font-mono); }
  .copy-btn { display: flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: var(--border-radius-md); border: 0.5px solid var(--color-border-secondary); background: var(--color-background-primary); color: var(--color-text-primary); font-size: 12px; cursor: pointer; }
  .copy-btn:hover { background: var(--color-background-secondary); }
  textarea { width: 100%; box-sizing: border-box; background: var(--color-background-primary); border: 0.5px solid var(--color-border-tertiary); border-radius: var(--border-radius-md); color: var(--color-text-primary); font-size: 12px; font-family: var(--font-mono); padding: 10px 12px; resize: vertical; line-height: 1.6; min-height: 120px; }
</style>
<div class="prompt-box">
  <div class="prompt-header">
    <span class="prompt-label">[arquivo(s) envolvido(s)]</span>
    <button class="copy-btn" onclick="copyPrompt()">
      <i class="ti ti-copy" aria-hidden="true"></i> Copiar
    </button>
  </div>
  <textarea id="prompt-text" readonly>[prompt aqui]</textarea>
</div>
<script>
function copyPrompt() {
  const text = document.getElementById('prompt-text').value;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('.copy-btn');
    btn.innerHTML = '<i class="ti ti-check" aria-hidden="true"></i> Copiado!';
    setTimeout(() => { btn.innerHTML = '<i class="ti ti-copy" aria-hidden="true"></i> Copiar'; }, 2000);
  });
}
</script>
```

## O que você não faz

- Não inclui código no prompt
- Não localiza linha por linha
- Não explica motivação
- Não sugere abordagens alternativas
