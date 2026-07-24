/**
 * FixturePanel.jsx - Configuracao de aparelhos
 * Tela de lista + acoes, preservando callbacks atuais.
 */
import React, { useState, useEffect } from 'react';
import { useShow } from '../store/showStore.js';
import FixtureEditor from './FixtureEditor.jsx';

const TABS = [
  'Aparelhos',
  'Matriz',
  'Extras',
  'Ordem dos parâmetros',
  'Wizards',
  'Processamento de universos DMX/Sequencia de processamento das janelas',
  'FPS do show (frames por segundo)',
];

const COLUMNS = [
  { key: 'name', label: 'Nome', width: '18%' },
  { key: 'model', label: 'Fabricante/Modelo', width: '19%' },
  { key: 'universe', label: 'Universo', width: '8%' },
  { key: 'channel', label: 'Canal', width: '8%' },
  { key: 'count', label: 'Qtd can...', width: '9%' },
  { key: 'group', label: 'Grupo', width: '9%' },
  { key: 'par', label: 'Par', width: '7%' },
  { key: 'rdm', label: 'RDM', width: '7%' },
  { key: 'note', label: 'Observação', width: '15%' },
];

const MIN_VISUAL_ROWS = 32;

export default function FixturePanel({ onClose }) {
  const { show, addFixture, removeFixture, duplicateFixture, saveShow } = useShow();
  const [selectedId, setSelectedId] = useState(null);
  const [editorFixtureId, setEditorFixtureId] = useState(null); // null = fechado, 'new' = novo, id = editar
  const [newFixtureDraft, setNewFixtureDraft] = useState(null);
  const [filterText, setFilterText] = useState('');

  const fixtures = show.fixtures || [];
  const selectedFixture = fixtures.find(f => f.id === selectedId);
  const normalizedFilter = filterText.trim().toLowerCase();
  const filteredFixtures = normalizedFilter
    ? fixtures.filter(f => {
        const haystack = [
          f.name,
          f.manufacturer,
          f.model,
          f.fixtureType,
          f.startChannel,
          f.channelCount,
          f.universe,
        ].filter(value => value !== undefined && value !== null).join(' ').toLowerCase();
        return haystack.includes(normalizedFilter);
      })
    : fixtures;
  const emptyRows = Math.max(MIN_VISUAL_ROWS - filteredFixtures.length, 0);

  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape' && !editorFixtureId) onClose();
    }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [editorFixtureId, onClose]);

  function handleNew() {
    const id = `fixture_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const nextStart = fixtures.reduce((max, f) => {
      const end = (f.startChannel || 1) + (f.channelCount || 1);
      return end > max ? end : max;
    }, 1);
    setNewFixtureDraft({
      id,
      name: 'Novo Aparelho',
      startChannel: nextStart,
      channelCount: 1,
      channels: ['Canal 1'],
      manufacturer: '',
      model: '',
      note: '',
    });
    setEditorFixtureId('new');
  }

  function handleEditorClose() {
    setEditorFixtureId(null);
    setNewFixtureDraft(null);
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

  async function handleConfirm() {
    const result = await saveShow();
    if (result && result.ok === false) {
      window.alert(result.message || result.error || 'Erro ao salvar aparelhos');
      return;
    }
    onClose();
  }

  return (
    <div style={{ background:'#1d2b30', color:'#ffffff', fontFamily:'Arial, Helvetica, sans-serif', height:'100vh', width:'100%', overflow:'hidden', display:'flex', flexDirection:'column' }}>

      <div style={{ height:24, minHeight:24, background:'#24343a', color:'#ffffff', borderBottom:'1px solid #8db8b8', display:'flex', alignItems:'center', padding:'0 6px', fontSize:13, fontWeight:700, boxSizing:'border-box' }}>
        <span style={{ flex:1, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>Configuração de aparelhos</span>
        <button
          onClick={onClose}
          style={{ width:22, height:22, background:'#000000', color:'#ffffff', border:'1px solid #8db8b8', borderRadius:0, boxShadow:'none', outline:'none', fontFamily:'Arial, Helvetica, sans-serif', fontSize:13, fontWeight:700, lineHeight:1, cursor:'pointer', padding:0 }}
        >
          x
        </button>
      </div>

      <div style={{ height:24, minHeight:24, background:'#24343a', borderBottom:'1px solid #5f8588', display:'flex', alignItems:'center', overflow:'hidden' }}>
        {TABS.map((tab, index) => {
          const active = index === 0;
          return (
            <button
              key={tab}
              type="button"
              disabled={!active}
              style={{
                background: active ? '#35484f' : '#24343a',
                color: active ? '#ffffff' : '#c8dddd',
                border: active ? '1px solid #8db8b8' : 'none',
                borderBottom: active ? 'none' : 'none',
                padding:'3px 8px',
                fontSize:11,
                fontWeight: active ? 700 : 400,
                borderRadius:0,
                boxShadow:'none',
                outline:'none',
                cursor:'default',
                height:24,
                minHeight:24,
                fontFamily:'Arial, Helvetica, sans-serif',
                whiteSpace:'nowrap',
              }}
            >
              {tab}
            </button>
          );
        })}
      </div>

      <div style={{ height:28, minHeight:28, background:'#35484f', borderBottom:'1px solid #8db8b8', display:'flex', alignItems:'center', padding:'3px 6px', gap:6, boxSizing:'border-box' }}>
        <label style={{ color:'#ffffff', fontSize:11, fontWeight:400, fontFamily:'Arial, Helvetica, sans-serif', whiteSpace:'nowrap' }}>Busca/filtro</label>
        <input
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          style={{ background:'#1d2b30', color:'#ffffff', border:'1px solid #5f8588', borderRadius:0, height:20, padding:'2px 5px', fontSize:12, fontWeight:400, fontFamily:'Arial, Helvetica, sans-serif', outline:'none', flex:1, boxSizing:'border-box' }}
        />
      </div>

      <div style={{ flex:1, display:'flex', minHeight:0, background:'#26363c' }}>
        <div style={{ flex:1, background:'#4a5d64', overflow:'hidden', display:'flex', flexDirection:'column', borderRight:'1px solid #8db8b8', minWidth:0 }}>
          <div style={{ flex:1, overflow:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', tableLayout:'fixed', background:'#4a5d64', color:'#ffffff', fontFamily:'Arial, Helvetica, sans-serif' }}>
              <colgroup>
                {COLUMNS.map(column => <col key={column.key} style={{ width:column.width }} />)}
              </colgroup>
              <thead>
                <tr>
                  {COLUMNS.map(column => (
                    <th key={column.key} style={{ background:'#1d2b30', color:'#ffffff', fontSize:14, fontWeight:400, height:24, border:'1px solid #b7c7c9', padding:'2px 6px', textAlign:'left', boxSizing:'border-box', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredFixtures.map(f => {
                  const selected = selectedId === f.id;
                  const enabled = f.enabled !== false;
                  const modelText = [f.manufacturer, f.model || f.fixtureType].filter(Boolean).join(' / ');
                  const universeText = f.universe ?? '';
                  return (
                    <tr
                      key={f.id}
                      onClick={() => setSelectedId(f.id)}
                      onDoubleClick={() => setEditorFixtureId(f.id)}
                      style={{ cursor:'pointer', opacity: enabled ? 1 : 0.45 }}
                    >
                      <Cell selected={selected} enabled={enabled}>{f.name}{!enabled ? ' (OFF)' : ''}</Cell>
                      <Cell selected={selected} enabled={enabled}>{modelText}</Cell>
                      <Cell selected={selected} enabled={enabled}>{universeText}</Cell>
                      <Cell selected={selected} enabled={enabled}>{f.startChannel ?? ''}</Cell>
                      <Cell selected={selected} enabled={enabled}>{f.channelCount ?? ''}</Cell>
                      <Cell selected={selected} enabled={enabled}>{f.group ?? ''}</Cell>
                      <Cell selected={selected} enabled={enabled}>{f.par ?? ''}</Cell>
                      <Cell selected={selected} enabled={enabled}>{f.rdm ? 'Sim' : ''}</Cell>
                      <Cell selected={selected} enabled={enabled}>{f.note || f.observation || ''}</Cell>
                    </tr>
                  );
                })}
                {Array.from({ length: emptyRows }).map((_, rowIndex) => (
                  <tr key={`empty-${rowIndex}`}>
                    {COLUMNS.map(column => <Cell key={column.key} />)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ width:170, minWidth:170, maxWidth:170, background:'#24343a', color:'#ffffff', borderLeft:'1px solid #8db8b8', display:'flex', flexDirection:'column', padding:6, gap:4, overflow:'hidden', fontFamily:'Arial, Helvetica, sans-serif', boxSizing:'border-box' }}>
          <SideButton disabled>Novo aparelho/localizar canais</SideButton>
          <SideButton onClick={handleNew}>Criar novo aparelho (Manual)</SideButton>
          <SideButton onClick={() => window.vp.openFixtureTemplate()}>Criar novo aparelho (AI)</SideButton>
          <SideButton onClick={selectedId ? () => setEditorFixtureId(selectedId) : undefined} disabled={!selectedId}>Editar aparelho...</SideButton>
          <SideButton onClick={handleRemove} disabled={!selectedId}>Remover aparelho</SideButton>
          <SideButton onClick={handleDuplicate} disabled={!selectedId}>Duplicar aparelho</SideButton>
          <SideButton disabled>Copiar propriedades...</SideButton>
          <SideButton disabled>Substituir aparelho...</SideButton>
          <SideButton disabled>Alterar nome...</SideButton>
          <SideButton disabled>Mudar endereços DMX...</SideButton>
          <SideButton disabled>Vincular aparelho RDM...</SideButton>

          <div style={{ height:1, background:'#5f8588', margin:'4px 0' }} />

          <SideButton disabled>Importar de .show...</SideButton>
          <SideButton disabled>Importar aparelho...</SideButton>
          <SideButton disabled>Importar aparelho da WEB...</SideButton>
          <SideButton disabled>Exportar aparelho</SideButton>
          <SideButton disabled>Exportar aparelho p/ WEB...</SideButton>
          <SideButton disabled>Acima</SideButton>
          <SideButton disabled>Abaixo</SideButton>
        </div>
      </div>

      <div style={{ minHeight:96, background:'#26363c', borderTop:'1px solid #8db8b8', display:'flex', flexDirection:'column', gap:6, padding:6, color:'#ffffff', boxSizing:'border-box' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, minHeight:24 }}>
          <FooterField label="Universo" value={selectedFixture?.universe ?? ''} />
          <FooterField label="Canal de início" value={selectedFixture?.startChannel ?? ''} />
          <FooterField label="Grupo" value={selectedFixture?.group ?? ''} />
          <FooterField label="Par" value={selectedFixture?.par ?? ''} />
          <div style={{ flex:1 }} />
          <span style={{ color:'#9bb4b7', fontSize:11, fontWeight:400, whiteSpace:'nowrap' }}>
            {filteredFixtures.length} aparelho{filteredFixtures.length === 1 ? '' : 's'}
          </span>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:6, minHeight:28 }}>
          <FooterButton disabled>Mapa de canais DMX...</FooterButton>
          <FooterButton disabled>Limpar SHOW</FooterButton>
          <FooterButton disabled>Definir senha...</FooterButton>
          <FooterButton disabled>Exportar</FooterButton>
          <FooterButton disabled>RDM...</FooterButton>
          <div style={{ flex:1 }} />
          <button
            onClick={handleConfirm}
            style={{ background:'#000000', color:'#ffffff', border:'1px solid #b7dede', borderRadius:0, boxShadow:'none', outline:'none', height:24, padding:'3px 12px', fontSize:11, fontWeight:700, fontFamily:'Arial, Helvetica, sans-serif', cursor:'pointer' }}
          >
            Confirmar
          </button>
        </div>
      </div>

      {editorFixtureId && (
        <FixtureEditor
          fixtureId={editorFixtureId}
          draftFixture={editorFixtureId === 'new' ? newFixtureDraft : null}
          onCreate={fixture => {
            addFixture(fixture);
            setSelectedId(fixture.id);
          }}
          onClose={handleEditorClose}
        />
      )}
    </div>
  );
}

function Cell({ children, selected, enabled = true }) {
  const bg = selected ? '#35484f' : (enabled ? '#4a5d64' : '#2d3d43');
  const color = enabled ? '#ffffff' : '#7a9a9e';
  return (
    <td style={{ background: bg, color, fontSize:13, fontWeight:400, height:22, border:'1px solid #b7c7c9', padding:'2px 6px', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', boxSizing:'border-box', fontFamily:'Arial, Helvetica, sans-serif' }}>
      {children}
    </td>
  );
}

function SideButton({ onClick, children, disabled }) {
  const isDisabled = disabled || !onClick;
  return (
    <button
      type="button"
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      style={{
        background:isDisabled ? '#1d2b30' : '#000000',
        color:isDisabled ? '#6f8588' : '#ffffff',
        border:isDisabled ? '1px solid #35484f' : '1px solid #5f8588',
        borderRadius:0,
        boxShadow:'none',
        outline:'none',
        minHeight:22,
        padding:'3px 5px',
        fontSize:11,
        fontWeight:700,
        textAlign:'left',
        fontFamily:'Arial, Helvetica, sans-serif',
        cursor:isDisabled ? 'default' : 'pointer',
        overflow:'hidden',
        whiteSpace:'nowrap',
        textOverflow:'ellipsis',
      }}
    >
      {children}
    </button>
  );
}

function FooterButton({ children, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      style={{ background:disabled ? '#1d2b30' : '#000000', color:disabled ? '#6f8588' : '#ffffff', border:disabled ? '1px solid #35484f' : '1px solid #8db8b8', borderRadius:0, boxShadow:'none', outline:'none', fontFamily:'Arial, Helvetica, sans-serif', fontSize:11, fontWeight:700, minHeight:22, padding:'3px 8px', cursor:disabled ? 'default' : 'pointer' }}
    >
      {children}
    </button>
  );
}

function FooterField({ label, value }) {
  return (
    <label style={{ display:'flex', alignItems:'center', gap:4, color:'#ffffff', fontSize:11, fontWeight:400, fontFamily:'Arial, Helvetica, sans-serif', whiteSpace:'nowrap' }}>
      <span>{label}</span>
      <input
        value={value}
        readOnly
        style={{ width:86, height:20, background:'#1d2b30', color:value ? '#ffffff' : '#6f8588', border:'1px solid #5f8588', borderRadius:0, boxShadow:'none', outline:'none', padding:'2px 5px', fontSize:11, fontWeight:400, fontFamily:'Arial, Helvetica, sans-serif', boxSizing:'border-box' }}
      />
    </label>
  );
}
