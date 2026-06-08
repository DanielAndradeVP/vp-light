/**
 * FixturePanel.jsx — Painel de Identidades dos Aparelhos
 * Tabela + botões Novo/Remover/Duplicar/Confirmar
 * Abre modal FixtureEditor ao clicar em um aparelho
 */
import React, { useState, useEffect } from 'react';
import { useShow } from '../store/showStore.js';
import FixtureEditor from './FixtureEditor.jsx';

const C = {
  bg: '#1a1a1a', surface: '#242424', border: '#383838',
  text: '#e0e0e0', textMuted: '#888', white: '#ffffff',
  btnBg: '#2e2e2e', btnBorder: '#444', rowHover: '#2e2e2e', rowSelected: '#383838',
};

export default function FixturePanel({ onClose }) {
  const { show, addFixture, removeFixture, duplicateFixture, saveShow } = useShow();
  const [selectedId, setSelectedId] = useState(null);
  const [editorFixtureId, setEditorFixtureId] = useState(null); // null = fechado, 'new' = novo, id = editar

  const fixtures = show.fixtures || [];
  const selectedFixture = fixtures.find(f => f.id === selectedId);

  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape' && !editorFixtureId) onClose();
    }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [editorFixtureId, onClose]);

  function handleNew() {
    const id = `fixture_${Date.now()}`;
    addFixture({
      id,
      name: 'Novo Aparelho',
      startChannel: 1,
      channelCount: 1,
      channels: ['Canal 1'],
    });
    setEditorFixtureId(id);
  }

  function handleRemove() {
    if (!selectedId) return;
    removeFixture(selectedId);
    setSelectedId(null);
  }

  function handleDuplicate() {
    if (!selectedId) return;
    duplicateFixture(selectedId);
  }

  function handleConfirm() {
    saveShow();
    onClose();
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:C.bg, color:C.text, fontFamily:'Segoe UI, system-ui, sans-serif' }}>

      {/* Topo */}
      <div style={{ padding:'8px 14px', background:C.surface, borderBottom:`1px solid ${C.border}`, fontSize:14, fontWeight:600, color:C.white, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span>Aparelhos</span>
        <button onClick={onClose} style={{ background:'none', border:'none', color:C.textMuted, fontSize:18, cursor:'pointer', lineHeight:1 }}>✕</button>
      </div>

      {/* Tabela */}
      <div style={{ flex:1, overflowY:'auto', padding:14 }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${C.border}` }}>
              {['Id','Nome','Canal','QTD Canais'].map(h => (
                <th key={h} style={{ textAlign:'left', padding:'6px 10px', color:C.textMuted, fontWeight:400 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fixtures.length === 0 && (
              <tr><td colSpan={4} style={{ padding:'20px 10px', color:C.textMuted, fontSize:12 }}>Nenhum aparelho cadastrado.</td></tr>
            )}
            {fixtures.map((f, i) => (
              <tr
                key={f.id}
                onClick={() => setSelectedId(f.id)}
                onDoubleClick={() => setEditorFixtureId(f.id)}
                style={{
                  background: selectedId === f.id ? C.rowSelected : i % 2 === 0 ? C.surface : C.bg,
                  cursor:'pointer', borderBottom:`1px solid ${C.border}`,
                }}
              >
                <td style={{ padding:'7px 10px', color:C.textMuted }}>{f.id}</td>
                <td style={{ padding:'7px 10px' }}>{f.name}</td>
                <td style={{ padding:'7px 10px' }}>{f.startChannel}</td>
                <td style={{ padding:'7px 10px' }}>{f.channelCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop:8, fontSize:11, color:C.textMuted }}>Clique para selecionar · Duplo-clique para editar</div>
      </div>

      {/* Botões */}
      <div style={{ padding:'10px 14px', background:C.surface, borderTop:`1px solid ${C.border}`, display:'flex', gap:8 }}>
        <Btn onClick={handleNew}>Novo aparelho</Btn>
        <Btn onClick={handleRemove} disabled={!selectedId}>Remover aparelho</Btn>
        <Btn onClick={handleDuplicate} disabled={!selectedId}>Duplicar aparelho</Btn>
        <div style={{ flex:1 }} />
        <Btn onClick={handleConfirm} primary>Confirmar</Btn>
      </div>

      {/* Modal editor */}
      {editorFixtureId && (
        <FixtureEditor
          fixtureId={editorFixtureId}
          onClose={() => setEditorFixtureId(null)}
        />
      )}
    </div>
  );
}

function Btn({ onClick, children, disabled, primary }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        padding:'5px 14px', borderRadius:3, fontSize:12, cursor: disabled ? 'not-allowed' : 'pointer',
        background: primary ? '#383838' : '#2e2e2e',
        color: disabled ? '#555' : '#e0e0e0',
        border:`1px solid ${disabled ? '#333' : '#444'}`,
      }}
    >{children}</button>
  );
}
