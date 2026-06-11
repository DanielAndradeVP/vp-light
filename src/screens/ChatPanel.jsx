/**
 * ChatPanel.jsx — Aba Chat do painel direito (Main.jsx)
 * Lista de mensagens (usuário/assistente) + input + envio.
 * Consome o backend de IA via window.vp.sendChat (a implementar no main/preload).
 * Mostra o estado "gerando…" enquanto aguarda a resposta.
 */
import React, { useState, useRef, useEffect } from 'react';
import theme from '../theme.js';

const skillModules = import.meta.glob('../../.agents/skills/*/SKILL.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const PROJECT_SKILLS = Object.entries(skillModules)
  .map(([path, content]) => {
    const folder = path.match(/skills\/([^/]+)\/SKILL\.md$/)?.[1] || '';
    const name = content.match(/^name:\s*"?([^"\n]+)"?/m)?.[1]?.trim() || folder;
    return {
      name,
      folder,
      mention: `[$${name}](C:\\vp-light\\.agents\\skills\\${folder}\\SKILL.md) `,
    };
  })
  .filter(skill => skill.name)
  .sort((a, b) => a.name.localeCompare(b.name));

const C = {
  surface:       theme.colors.panel,         // #35484f
  surfaceDark:   theme.colors.panelDark,     // #24343a
  bubbleUser:    theme.colors.selection,     // #4e6b73
  bubbleBot:     theme.colors.surfaceAlt,    // #2d3f45
  inputBg:       theme.colors.bgDark,        // #1d2b30
  border:        theme.colors.borderSoft,    // #5f8588
  borderStrong:  theme.colors.border,        // #8db8b8
  text:          theme.colors.text,          // #ffffff
  textMuted:     theme.colors.textMuted,     // #9bb4b7
  textSecondary: theme.colors.textSecondary, // #c8dddd
  textDisabled:  theme.colors.textDisabled,  // #6f8588
  btnBg:         theme.colors.buttonBg,      // #000000
  menuBg:        '#2e2e2e',
  menuBorder:    '#444',
};

export default function ChatPanel() {
  const [messages, setMessages] = useState([]); // { role: 'user' | 'assistant', text }
  const [input, setInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const menuRef = useRef(null);
  const conversationVersionRef = useRef(0);

  // Auto-scroll para a última mensagem
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, generating]);

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(e) {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false);
    }

    function handleEsc(e) {
      if (e.key === 'Escape') setMenuOpen(false);
    }

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [menuOpen]);

  async function handleSend() {
    const text = input.trim();
    if (!text || generating) return;
    const requestVersion = conversationVersionRef.current;
    setMessages(prev => [...prev, { role: 'user', text }]);
    setInput('');
    setGenerating(true);
    try {
      const result = window.vp?.sendChat
        ? await window.vp.sendChat(text)
        : null;
      const reply = result?.ok
        ? result.reply
        : (result?.error || 'Chat ainda não conectado ao backend (window.vp.sendChat).');
      if (conversationVersionRef.current !== requestVersion) return;
      setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
    } catch (e) {
      if (conversationVersionRef.current !== requestVersion) return;
      setMessages(prev => [...prev, { role: 'assistant', text: `Erro: ${e.message}` }]);
    } finally {
      if (conversationVersionRef.current === requestVersion) setGenerating(false);
    }
  }

  function handleSkillClick(skill) {
    const el = inputRef.current;
    const start = el?.selectionStart ?? input.length;
    const end = el?.selectionEnd ?? input.length;
    const next = `${input.slice(0, start)}${skill.mention}${input.slice(end)}`;
    const nextCursor = start + skill.mention.length;
    setInput(next);
    setMenuOpen(false);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  }

  function handleClearConversation() {
    conversationVersionRef.current += 1;
    setMessages([]);
    setGenerating(false);
    setMenuOpen(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const sendDisabled = generating || !input.trim();

  return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', background:C.surface, fontFamily:theme.typography.fontFamily }}>

      {/* Barra do chat */}
      <div style={{ height:30, minHeight:30, display:'flex', alignItems:'center', gap:6, padding:'3px 6px', borderBottom:`1px solid ${C.borderStrong}`, background:C.surfaceDark, boxSizing:'border-box', position:'relative' }}>
        <button
          type="button"
          onMouseDown={e => e.stopPropagation()}
          onClick={() => setMenuOpen(prev => !prev)}
          style={{
            width:22, height:22, minWidth:22,
            background:C.btnBg,
            color:C.text,
            border:`1px solid ${menuOpen ? C.borderStrong : C.border}`,
            borderRadius:0,
            outline:'none',
            boxShadow:'none',
            fontFamily:theme.typography.fontFamily,
            fontSize:16,
            fontWeight:700,
            lineHeight:1,
            cursor:'pointer',
            padding:0,
          }}
        >
          +
        </button>
        <span style={{ fontSize:12, fontWeight:700, color:C.textSecondary, minWidth:0, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
          Chat
        </span>

        {menuOpen && (
          <div
            ref={menuRef}
            style={{
              position:'absolute',
              top:28,
              left:6,
              width:260,
              maxWidth:'calc(100% - 12px)',
              background:C.menuBg,
              border:`1px solid ${C.menuBorder}`,
              boxShadow:theme.elevation.modal,
              zIndex:20,
              color:C.text,
              fontFamily:theme.typography.fontFamily,
              fontSize:12,
            }}
          >
            <div style={{ padding:'7px 8px 5px', color:C.textMuted, fontSize:11, fontWeight:700, textTransform:'uppercase' }}>
              Habilidades
            </div>
            <div style={{ maxHeight:220, overflowY:'auto', paddingBottom:4 }}>
              {PROJECT_SKILLS.map(skill => (
                <button
                  key={skill.folder || skill.name}
                  type="button"
                  onClick={() => handleSkillClick(skill)}
                  style={{
                    width:'100%',
                    minHeight:30,
                    display:'flex',
                    alignItems:'center',
                    gap:7,
                    background:'transparent',
                    color:C.textSecondary,
                    border:'none',
                    borderRadius:0,
                    outline:'none',
                    boxShadow:'none',
                    padding:'4px 8px',
                    fontFamily:theme.typography.fontFamily,
                    fontSize:12,
                    textAlign:'left',
                    cursor:'pointer',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#383838'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ width:18, height:20, minWidth:18, display:'flex', alignItems:'center', justifyContent:'center', background:'#242424', border:`1px solid ${C.menuBorder}`, color:C.textMuted, fontSize:8, fontWeight:700, boxSizing:'border-box' }}>
                    MD
                  </span>
                  <span style={{ minWidth:0, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                    {skill.name}
                  </span>
                </button>
              ))}
            </div>
            <div style={{ height:1, background:C.menuBorder, margin:'3px 0' }} />
            <button
              type="button"
              onClick={handleClearConversation}
              style={{
                width:'100%',
                minHeight:30,
                background:'transparent',
                color:C.text,
                border:'none',
                borderRadius:0,
                outline:'none',
                boxShadow:'none',
                padding:'5px 8px',
                fontFamily:theme.typography.fontFamily,
                fontSize:12,
                fontWeight:700,
                textAlign:'left',
                cursor:'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#383838'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              Limpar conversa
            </button>
          </div>
        )}
      </div>

      {/* Lista de mensagens */}
      <div ref={listRef} style={{ flex:1, overflowY:'auto', padding:8, display:'flex', flexDirection:'column', gap:6 }}>
        {messages.length === 0 && !generating && (
          <div style={{ color:C.textMuted, fontSize:11, textAlign:'center', marginTop:12 }}>
            Comece uma conversa…
          </div>
        )}

        {messages.map((m, i) => {
          const mine = m.role === 'user';
          return (
            <div key={i} style={{ display:'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth:'85%',
                background: mine ? C.bubbleUser : C.bubbleBot,
                color: mine ? C.text : C.textSecondary,
                border:`1px solid ${C.border}`,
                borderRadius: theme.radius.md,
                padding:'5px 8px',
                fontSize:12, lineHeight:1.35,
                whiteSpace:'pre-wrap', wordBreak:'break-word',
              }}>
                {m.text}
              </div>
            </div>
          );
        })}

        {generating && (
          <div style={{ display:'flex', justifyContent:'flex-start' }}>
            <div style={{
              background:C.bubbleBot, color:C.textMuted, border:`1px solid ${C.border}`,
              borderRadius:theme.radius.md, padding:'5px 8px', fontSize:12, fontStyle:'italic',
            }}>
              gerando…
            </div>
          </div>
        )}
      </div>

      {/* Input + envio */}
      <div style={{ display:'flex', gap:4, padding:6, borderTop:`1px solid ${C.borderStrong}`, background:C.surfaceDark }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Mensagem…"
          style={{
            flex:1, height:28, background:C.inputBg, color:C.text,
            border:`1px solid ${C.border}`, borderRadius:0, outline:'none',
            padding:'4px 6px', fontSize:12, fontFamily:theme.typography.fontFamily, boxSizing:'border-box',
          }}
        />
        <button
          onClick={handleSend}
          disabled={sendDisabled}
          style={{
            height:28, padding:'0 12px', borderRadius:0,
            cursor: sendDisabled ? 'default' : 'pointer',
            background:C.btnBg,
            color: sendDisabled ? C.textDisabled : C.text,
            border:`1px solid ${sendDisabled ? C.border : C.borderStrong}`,
            fontFamily:theme.typography.fontFamily, fontSize:12, fontWeight:700, outline:'none', boxShadow:'none',
          }}
        >
          Enviar
        </button>
      </div>
    </div>
  );
}
