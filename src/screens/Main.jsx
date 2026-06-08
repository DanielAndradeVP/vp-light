/**
 * Main.jsx — Tela principal
 * Mesa de aparelhos + painel direito com faders ao vivo + cenas A-M + páginas
 */
import React, { useEffect, useCallback, useState } from 'react';
import { useShow } from '../store/showStore.js';

const SCENE_KEYS = ['A','B','C','D','E','F','G','H','I','J','K','L','M'];

const C = {
  bg: '#1a1a1a', surface: '#242424', border: '#383838',
  text: '#e0e0e0', textMuted: '#888', white: '#ffffff',
  btnBg: '#2e2e2e', btnBorder: '#444',
  rowSelected: '#383838', fixtureBg: '#2e2e2e', fixtureSelected: '#484848',
  sceneActive: '#505050',
};

export default function Main({ onOpenFixtures }) {
  const {
    show, currentPage, setCurrentPage,
    selectedFixtureId, setSelectedFixtureId,
    selectedFixture, pages, saveShow, loadShow,
    updateScene, updateFixture,
  } = useShow();

  const [activeScenes, setActiveScenes] = useState([]);

  function handleActivateScene(key) {
    const scene = scenes[key];
    setActiveScenes(prev => {
      if (prev.includes(key)) {
        // desmarcando — zera faders se nenhuma cena ativa sobrar
        const next = prev.filter(k => k !== key);
        if (next.length === 0) {
          setLiveValues({});
          window.vp.blackout();
        }
        return next;
      }
      if (prev.length >= 3) return prev;
      if (scene?.channels) {
        window.vp.activateScene(scene.channels);
        setLiveValues(() => {
          const newLive = {};
          Object.entries(scene.channels).forEach(([ch, val]) => {
            newLive[Number(ch)] = Number(val);
          });
          return newLive;
        });
      }
      return [...prev, key];
    });
  }

  function handleBlackout() {
    setActiveScenes([]);
    window.vp.blackout();
  }

  const [liveValues, setLiveValues] = useState({});
  const [testPanelOpen, setTestPanelOpen] = useState(false);
  const [testValues, setTestValues] = useState({});
  const [testPanelPos, setTestPanelPos] = useState({ x: null, y: 56 });
  const [testPanelDrag, setTestPanelDrag] = useState(null); // { offsetX, offsetY }

  function handleTestPanelMouseDown(e) {
    const rect = e.currentTarget.parentElement.getBoundingClientRect();
    setTestPanelDrag({ offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top });
  }

  useEffect(() => {
    if (!testPanelDrag) return;
    function handleMove(e) {
      setTestPanelPos({ x: e.clientX - testPanelDrag.offsetX, y: e.clientY - testPanelDrag.offsetY });
    }
    function handleUp() { setTestPanelDrag(null); }
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [testPanelDrag]);

  useEffect(() => {
    if (!testPanelOpen) return;
    let active = true;
    const interval = setInterval(async () => {
      const snapshot = await window.vp.getUniverse();
      if (active) setTestValues(snapshot || {});
    }, 100);
    return () => { active = false; clearInterval(interval); };
  }, [testPanelOpen]);

  useEffect(() => {
    if (!selectedFixture) setTestPanelOpen(false);
  }, [selectedFixture]);
  const [dragging, setDragging] = useState(null); // { id, offsetX, offsetY }
  const [selection, setSelection] = useState(null); // { startX, startY, endX, endY }
  const [multiSelected, setMultiSelected] = useState([]);
  const [scripts, setScripts] = useState({});
  const [scriptMenu, setScriptMenu] = useState(null); // { x, y, fkey }
  const [createModal, setCreateModal] = useState(null); // { fkey }
  const [scriptName, setScriptName] = useState('');
  const [createModalTab, setCreateModalTab] = useState('novo');
  const [existingScripts, setExistingScripts] = useState([]);
  const [selectedExisting, setSelectedExisting] = useState(null);

  const FKEYS = ['F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12'];

  useEffect(() => {
    const load = async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
      const result = await window.vp.getAllScripts();
      setScripts(result);
    };
    load();
  }, []);

  useEffect(() => {
    if (createModalTab !== 'existentes' || !createModal) return;
    window.vp.listScripts().then(r => setExistingScripts(r.ok ? r.files : []));
  }, [createModalTab, createModal]);

  async function handleScriptRightClick(e, fkey) {
    e.preventDefault();
    setScriptMenu({ x: e.clientX, y: e.clientY, fkey });
  }

  async function handleToggleScript(fkey) {
    if (!scripts[fkey]) return;
    const result = await window.vp.toggleScript(fkey);
    if (result.ok) {
      setScripts(prev => ({
        ...prev,
        [fkey]: { ...prev[fkey], running: result.running }
      }));
    }
  }

  async function handleCreateScript() {
    if (!scriptName.trim() || !createModal) return;
    const result = await window.vp.createScript(createModal.fkey, scriptName.trim());
    if (result.ok) {
      setScripts(prev => ({
        ...prev,
        [createModal.fkey]: { name: result.name, file: result.file, running: false }
      }));
    }
    setCreateModal(null);
    setScriptName('');
  }

  async function handleClearScript(fkey) {
    await window.vp.clearScript(fkey);
    setScripts(prev => { const next = { ...prev }; delete next[fkey]; return next; });
    setScriptMenu(null);
  }
  const [contextMenu, setContextMenu] = useState(null); // { x, y, sceneKey }
  const [saveModal, setSaveModal] = useState(null); // { sceneKey }
  const [modalName, setModalName] = useState('');
  const [modalColor, setModalColor] = useState('#000000');

  const COLORS = ['#000000','#cc0000','#00aa00','#0000cc','#cccc00','#00cccc','#aa00aa','#cc6600'];

  function handleSceneRightClick(e, key) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, sceneKey: key });
  }

  function openSaveModal() {
    if (!contextMenu) return;
    const existing = scenes[contextMenu.sceneKey];
    setModalName(existing?.name || '');
    setModalColor(existing?.color || '#000000');
    setSaveModal({ sceneKey: contextMenu.sceneKey });
    setContextMenu(null);
  }

  function handleConfirmSave() {
    if (!saveModal) return;
    const channels = {};
    Object.entries(liveValues).forEach(([ch, val]) => {
      channels[Number(ch)] = Number(val);
    });
    updateScene(currentPage, saveModal.sceneKey, {
      name: modalName,
      color: modalColor,
      channels,
    });
    setSaveModal(null);
  }

  function handleClearScene() {
    if (!contextMenu) return;
    updateScene(currentPage, contextMenu.sceneKey, { name: '', color: '', channels: {} });
    setContextMenu(null);
  }

  useEffect(() => {
    function handleClick() { setContextMenu(null); }
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    if (!selectedFixtureId) {
      setLiveValues({});
      return;
    }
    // Se há cenas ativas, preenche os faders com os valores das cenas ativas
    if (activeScenes.length > 0) {
      const merged = {};
      activeScenes.forEach(key => {
        const scene = scenes[key];
        if (scene?.channels) {
          Object.entries(scene.channels).forEach(([ch, val]) => {
            merged[Number(ch)] = Number(val);
          });
        }
      });
      setLiveValues(merged);
    } else {
      setLiveValues({});
    }
  }, [selectedFixtureId]);

  useEffect(() => {
    function handleEsc(e) {
      if (e.key !== 'Escape') return;
      if (saveModal)   { setSaveModal(null); return; }
      if (createModal) { setCreateModal(null); setScriptName(''); return; }
      if (contextMenu) { setContextMenu(null); return; }
      if (scriptMenu)  { setScriptMenu(null); return; }
    }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [saveModal, createModal, contextMenu, scriptMenu]);

  const pageIds = Object.keys(pages).sort();
  const currentIdx = pageIds.indexOf(currentPage);
  const scenes = (pages[currentPage] || {}).scenes || {};

  const handleKey = useCallback((e) => {
    if (e.target.tagName === 'INPUT') return;
    const key = e.key.toUpperCase();
    if (SCENE_KEYS.includes(key)) { handleActivateScene(key); return; }
    if (e.code === 'Space') { e.preventDefault(); handleBlackout(); return; }
  }, [handleActivateScene, handleBlackout]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  function pgUp() { if (currentIdx > 0) setCurrentPage(pageIds[currentIdx - 1]); }
  function pgDw() { if (currentIdx < pageIds.length - 1) setCurrentPage(pageIds[currentIdx + 1]); }

  async function handleFader(dmxChannel, value) {
    const val = Number(value);
    setLiveValues(prev => ({ ...prev, [dmxChannel]: val }));
    await window.vp.setChannel(dmxChannel, val);
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:C.bg, color:C.text, fontFamily:'Segoe UI, system-ui, sans-serif' }}>

      {/* TOPO */}
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', background:C.surface, borderBottom:`1px solid ${C.border}`, minHeight:40 }}>
        <span style={{ fontWeight:700, fontSize:15, color:C.white, letterSpacing:2, marginRight:8 }}>VP·LIGHT</span>
        <TopBtn onClick={saveShow}>Salvar</TopBtn>
        <TopBtn onClick={loadShow}>Abrir</TopBtn>
        <TopBtn onClick={onOpenFixtures}>Aparelhos</TopBtn>
        <TopBtn onClick={() => setTestPanelOpen(true)} disabled={!selectedFixture}>Painel de Teste</TopBtn>
        <div style={{ flex:1 }} />
        <TopBtn onClick={handleBlackout} danger>BLACKOUT</TopBtn>
      </div>

      {/* CORPO */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* MESA DE APARELHOS */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', borderRight:`1px solid ${C.border}` }}>
          <div style={{ padding:'5px 10px', fontSize:11, color:C.textMuted, borderBottom:`1px solid ${C.border}` }}>Aparelhos</div>
          <div
            onClick={() => setSelectedFixtureId(null)}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                setSelection({ startX: x, startY: y, endX: x, endY: y });
                setMultiSelected([]);
              }
            }}
            onMouseMove={(e) => {
              const container = e.currentTarget.getBoundingClientRect();
              if (dragging) {
                const x = e.clientX - container.left - dragging.offsetX;
                const y = e.clientY - container.top - dragging.offsetY;
                updateFixture(dragging.id, { posX: Math.max(0, x), posY: Math.max(0, y) });
                return;
              }
              if (selection) {
                const x = e.clientX - container.left;
                const y = e.clientY - container.top;
                setSelection(prev => ({ ...prev, endX: x, endY: y }));
              }
            }}
            onMouseUp={(e) => {
              if (selection) {
                const minX = Math.min(selection.startX, selection.endX);
                const maxX = Math.max(selection.startX, selection.endX);
                const minY = Math.min(selection.startY, selection.endY);
                const maxY = Math.max(selection.startY, selection.endY);
                const selected = show.fixtures.filter(f => {
                  const x = f.posX ?? 10;
                  const y = f.posY ?? 10;
                  return x + 80 > minX && x < maxX && y + 60 > minY && y < maxY;
                }).map(f => f.id);
                setMultiSelected(selected);
                setSelection(null);
              }
              setDragging(null);
            }}
            onMouseLeave={() => { setDragging(null); setSelection(null); }}
            style={{ flex:1, position:'relative', overflowY:'auto' }}
          >
            {show.fixtures.length === 0 && (
              <div style={{ color:C.textMuted, fontSize:12, padding:16, position:'absolute' }}>Nenhum aparelho. Clique em "Aparelhos" para adicionar.</div>
            )}
            {show.fixtures.map(f => {
              const isSelected = f.id === selectedFixtureId || multiSelected.includes(f.id);
              return (
              <div
                key={f.id}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setDragging({ id: f.id, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top });
                }}
                onClick={(e) => { e.stopPropagation(); setSelectedFixtureId(f.id === selectedFixtureId ? null : f.id); }}
                style={{
                  position:'absolute',
                  left: f.posX ?? 10,
                  top: f.posY ?? 10,
                  width:80, height:60,
                  background: isSelected ? C.fixtureSelected : C.fixtureBg,
                  border:`1px solid ${isSelected ? C.white : C.border}`,
                  borderRadius:4, cursor: dragging?.id === f.id ? 'grabbing' : 'grab',
                  display:'flex', flexDirection:'column',
                  alignItems:'center', justifyContent:'center', gap:2,
                  userSelect:'none',
                }}
              >
                <div style={{ fontSize:10, color:C.textMuted }}>ch {f.startChannel}</div>
                <div style={{ fontSize:11, color:C.text, textAlign:'center', lineHeight:1.2, padding:'0 4px', overflow:'hidden', maxWidth:76 }}>{f.name}</div>
              </div>
              );
            })}
            {selection && (
              <div style={{
                position:'absolute', pointerEvents:'none',
                left: Math.min(selection.startX, selection.endX),
                top: Math.min(selection.startY, selection.endY),
                width: Math.abs(selection.endX - selection.startX),
                height: Math.abs(selection.endY - selection.startY),
                border:'1px solid #888',
                background:'rgba(255,255,255,0.05)',
              }} />
            )}
          </div>
        </div>

        {/* PAINEL DIREITO: FADERS */}
        <div style={{ width:260, display:'flex', flexDirection:'column', borderRight:`1px solid ${C.border}` }}>
          <div style={{ padding:'5px 10px', fontSize:11, color:C.textMuted, borderBottom:`1px solid ${C.border}` }}>
            {selectedFixture ? selectedFixture.name : 'Selecione um aparelho'}
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:'8px 10px' }}>
            {!selectedFixture && (
              <div style={{ color:C.textMuted, fontSize:11, padding:'12px 0' }}>Clique em um aparelho para ver os faders.</div>
            )}
            {selectedFixture && (selectedFixture.channels || []).map((chanName, i) => {
              const dmxCh = selectedFixture.startChannel + i;
              const val = liveValues[dmxCh] ?? 0;
              return (
                <div key={i} style={{ marginBottom:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                    <span style={{ fontSize:11, color:C.textMuted }}>{dmxCh} · {chanName || `Canal ${i+1}`}</span>
                    <span style={{ fontSize:11, color:C.text, minWidth:28, textAlign:'right' }}>{val}</span>
                  </div>
                  <input
                    type="range" min={0} max={255} value={val}
                    onChange={e => handleFader(dmxCh, e.target.value)}
                    style={{ width:'100%', accentColor:C.white, cursor:'pointer', height:4 }}
                  />
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* CENAS — barra inferior */}
      <div style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 8px', background:C.surface, borderTop:`1px solid ${C.border}` }}>
        <PageBtn onClick={pgUp}>PgUp</PageBtn>
        <span style={{ fontSize:13, color:C.text, minWidth:20, textAlign:'center' }}>{currentPage}</span>
        <PageBtn onClick={pgDw}>PgDw</PageBtn>
        <div style={{ width:1, height:24, background:C.border, margin:'0 6px' }} />
        {SCENE_KEYS.map(key => {
          const scene = scenes[key];
          const isActive = activeScenes.includes(key);
          return (
            <button
              key={key}
              onClick={() => scene && handleActivateScene(key)}
              onContextMenu={(e) => handleSceneRightClick(e, key)}
              style={{
                flex:1, padding:'8px 4px', borderRadius:3, cursor:'pointer',
                background: isActive
                  ? `color-mix(in srgb, ${scene?.color || C.sceneActive} 70%, white 30%)`
                  : scene?.color || C.surface,
                border:`1px solid ${isActive ? C.white : scene ? C.white : C.border}`,
                color: scene ? C.white : C.textMuted,
                fontSize:13, fontWeight: isActive ? 700 : 400,
                display:'flex', flexDirection:'column', alignItems:'center', gap:1, minWidth:0,
              }}
            >
              <span>{key}</span>
              {scene && <span style={{ fontSize:8, color:C.white, overflow:'hidden', maxWidth:'100%' }}>{scene.name}</span>}
            </button>
          );
        })}
      </div>

      {/* F-KEYS */}
      <div style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 8px', background:'#1a1a1a', borderTop:`1px solid ${C.border}` }}>
        {FKEYS.map(fkey => {
          const script = scripts[fkey];
          const isRunning = script?.running;
          return (
            <button
              key={fkey}
              onClick={() => handleToggleScript(fkey)}
              onContextMenu={(e) => handleScriptRightClick(e, fkey)}
              style={{
                flex:1, padding:'6px 4px', borderRadius:3, cursor:'pointer',
                background: isRunning ? '#2a3a2a' : script ? '#2a2a2a' : '#1a1a1a',
                border:`1px solid ${isRunning ? '#4a7a4a' : script ? '#444' : '#2a2a2a'}`,
                color: isRunning ? '#4afa4a' : script ? C.text : C.textMuted,
                fontSize:11, display:'flex', flexDirection:'column', alignItems:'center', gap:1, minWidth:0,
              }}
            >
              <span style={{ fontSize:10, color: isRunning ? '#4afa4a' : C.textMuted }}>{fkey}</span>
              {script && <span style={{ fontSize:8, overflow:'hidden', maxWidth:'100%', color: isRunning ? '#4afa4a' : C.text }}>{script.name}</span>}
            </button>
          );
        })}
      </div>

      {/* MENU DE CONTEXTO F-KEY */}
      {scriptMenu && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position:'fixed',
            top: Math.min(scriptMenu.y, window.innerHeight - 80),
            left: Math.min(scriptMenu.x, window.innerWidth - 160),
            background:'#2e2e2e', border:'1px solid #444', borderRadius:4,
            zIndex:1000, minWidth:140, boxShadow:'0 4px 12px rgba(0,0,0,0.5)',
          }}
        >
          <div
            onClick={() => { setCreateModal({ fkey: scriptMenu.fkey }); setCreateModalTab('novo'); setSelectedExisting(null); setScriptName(''); setScriptMenu(null); }}
            style={{ padding:'8px 14px', fontSize:12, cursor:'pointer', color:'#e0e0e0' }}
            onMouseEnter={e => e.currentTarget.style.background='#383838'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}
          >
            {scripts[scriptMenu.fkey] ? 'Editar Script' : 'Criar Script'}
          </div>
          <div
            onClick={() => scripts[scriptMenu.fkey] ? handleClearScript(scriptMenu.fkey) : setScriptMenu(null)}
            style={{
              padding:'8px 14px', fontSize:12,
              cursor: scripts[scriptMenu.fkey] ? 'pointer' : 'not-allowed',
              color: scripts[scriptMenu.fkey] ? '#e0e0e0' : '#555',
            }}
            onMouseEnter={e => { if (scripts[scriptMenu.fkey]) e.currentTarget.style.background='#383838'; }}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}
          >
            Limpar
          </div>
        </div>
      )}

      {/* MODAL CRIAR SCRIPT */}
      {createModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
          <div style={{ background:'#242424', border:'1px solid #444', borderRadius:6, width:360, fontFamily:'Segoe UI, system-ui, sans-serif', color:'#e0e0e0' }}>

            {/* Header */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', borderBottom:'1px solid #383838' }}>
              <span style={{ fontSize:13, fontWeight:600 }}>
                {scripts[createModal.fkey] ? 'Editar Script' : 'Script'} — {createModal.fkey}
              </span>
              <button onClick={() => { setCreateModal(null); setScriptName(''); setSelectedExisting(null); }} style={{ background:'none', border:'none', color:'#888', fontSize:18, cursor:'pointer' }}>✕</button>
            </div>

            {/* Abas */}
            <div style={{ display:'flex', borderBottom:'1px solid #383838' }}>
              {[['novo', 'Novo Script'], ['existentes', 'Scripts Existentes']].map(([tab, label]) => (
                <button
                  key={tab}
                  onClick={() => setCreateModalTab(tab)}
                  style={{
                    flex:1, padding:'7px 0', fontSize:12, cursor:'pointer', border:'none',
                    background: createModalTab === tab ? '#2e2e2e' : '#1e1e1e',
                    color: createModalTab === tab ? '#fff' : '#888',
                    borderBottom: createModalTab === tab ? '2px solid #e0e0e0' : '2px solid transparent',
                  }}
                >{label}</button>
              ))}
            </div>

            {/* Conteúdo — Novo Script */}
            {createModalTab === 'novo' && (
              <div style={{ padding:16 }}>
                <div style={{ fontSize:11, color:'#888', marginBottom:6 }}>Nome do script</div>
                <input
                  value={scripts[createModal.fkey] ? scripts[createModal.fkey].name : scriptName}
                  onChange={e => setScriptName(e.target.value)}
                  disabled={!!scripts[createModal.fkey]}
                  placeholder="Nome do script..."
                  style={{ width:'100%', padding:'6px 8px', borderRadius:3, background:'#1a1a1a', border:'1px solid #444', color:'#e0e0e0', fontSize:12, boxSizing:'border-box' }}
                />
              </div>
            )}

            {/* Conteúdo — Scripts Existentes */}
            {createModalTab === 'existentes' && (
              <div style={{ padding:'10px 14px', maxHeight:220, overflowY:'auto' }}>
                {existingScripts.length === 0
                  ? <div style={{ fontSize:12, color:'#555', padding:'8px 0' }}>Nenhum script encontrado em /scripts/</div>
                  : existingScripts.map(s => (
                    <div
                      key={s.file}
                      onClick={() => setSelectedExisting(s)}
                      style={{
                        padding:'7px 10px', borderRadius:3, marginBottom:4, cursor:'pointer', fontSize:12,
                        background: selectedExisting?.file === s.file ? '#383838' : '#1e1e1e',
                        border: `1px solid ${selectedExisting?.file === s.file ? '#555' : '#2a2a2a'}`,
                        color: selectedExisting?.file === s.file ? '#fff' : '#bbb',
                      }}
                    >{s.name}</div>
                  ))
                }
              </div>
            )}

            {/* Footer */}
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, padding:'10px 14px', borderTop:'1px solid #383838' }}>
              <button
                onClick={() => { setCreateModal(null); setScriptName(''); setSelectedExisting(null); }}
                style={{ padding:'5px 16px', borderRadius:3, fontSize:12, cursor:'pointer', background:'#2e2e2e', color:'#e0e0e0', border:'1px solid #444' }}
              >Cancelar</button>

              {createModalTab === 'novo' && (
                <button
                  onClick={async () => {
                    if (scripts[createModal.fkey]) {
                      await window.vp.editScript(createModal.fkey);
                      setCreateModal(null);
                    } else {
                      handleCreateScript();
                    }
                  }}
                  disabled={!scripts[createModal.fkey] && !scriptName.trim()}
                  style={{ padding:'5px 16px', borderRadius:3, fontSize:12, cursor:'pointer', background:'#383838', color: (!scripts[createModal.fkey] && !scriptName.trim()) ? '#555' : '#fff', border:'1px solid #555' }}
                >
                  {scripts[createModal.fkey] ? 'Abrir no VS Code' : 'Criar e Abrir'}
                </button>
              )}

              {createModalTab === 'existentes' && (
                <>
                  <button
                    onClick={async () => {
                      if (!selectedExisting) return;
                      await window.vp.editScript(createModal.fkey).catch(() =>
                        window.open(`vscode://file/${selectedExisting.file}`)
                      );
                      // Registra o script no fkey sem criar arquivo novo
                      const result = await window.vp.createScript(createModal.fkey, selectedExisting.name);
                      if (result.ok) {
                        setScripts(prev => ({
                          ...prev,
                          [createModal.fkey]: { name: selectedExisting.name, file: selectedExisting.file, running: false }
                        }));
                      }
                    }}
                    disabled={!selectedExisting}
                    style={{ padding:'5px 16px', borderRadius:3, fontSize:12, cursor: selectedExisting ? 'pointer' : 'not-allowed', background:'#2e2e2e', color: selectedExisting ? '#e0e0e0' : '#555', border:'1px solid #444' }}
                  >Abrir no VS Code</button>

                  <button
                    onClick={async () => {
                      if (!selectedExisting) return;
                      const result = await window.vp.createScript(createModal.fkey, selectedExisting.name);
                      if (result.ok) {
                        setScripts(prev => ({
                          ...prev,
                          [createModal.fkey]: { name: selectedExisting.name, file: selectedExisting.file, running: false }
                        }));
                      }
                      setCreateModal(null);
                      setSelectedExisting(null);
                    }}
                    disabled={!selectedExisting}
                    style={{ padding:'5px 16px', borderRadius:3, fontSize:12, cursor: selectedExisting ? 'pointer' : 'not-allowed', background:'#383838', color: selectedExisting ? '#fff' : '#555', border:'1px solid #555' }}
                  >Usar este script</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PAINEL DE TESTE — canais ao vivo do fixture selecionado */}
      {testPanelOpen && selectedFixture && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position:'fixed',
            top: testPanelPos.y,
            left: testPanelPos.x != null ? testPanelPos.x : undefined,
            right: testPanelPos.x != null ? undefined : 16,
            width:300, maxHeight:'70vh',
            background:'#242424', border:'1px solid #444', borderRadius:6,
            zIndex:1500, boxShadow:'0 4px 16px rgba(0,0,0,0.5)',
            display:'flex', flexDirection:'column', fontFamily:'Segoe UI, system-ui, sans-serif', color:'#e0e0e0',
          }}
        >
          <div
            onMouseDown={handleTestPanelMouseDown}
            style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', borderBottom:'1px solid #383838', cursor:'move', userSelect:'none' }}
          >
            <span style={{ fontSize:13, fontWeight:600 }}>{selectedFixture.name}</span>
            <button onClick={() => setTestPanelOpen(false)} style={{ background:'none', border:'none', color:'#888', fontSize:18, cursor:'pointer', lineHeight:1 }}>✕</button>
          </div>
          <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:8, overflowY:'auto' }}>
            {Array.from({ length: selectedFixture.channelCount || 0 }, (_, i) => {
              const dmxChannel = (selectedFixture.startChannel || 1) + i;
              const chName = (selectedFixture.channels && selectedFixture.channels[i]) || `Canal ${i + 1}`;
              const value = testValues[dmxChannel] || 0;
              const active = value > 0;
              return (
                <div key={dmxChannel} style={{ display:'flex', flexDirection:'column', gap:3 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11 }}>
                    <span style={{ color:C.textMuted }}>CH {dmxChannel} — {chName}</span>
                    <span style={{ color: active ? C.white : '#555', fontWeight:600 }}>{value}</span>
                  </div>
                  <div style={{ width:'100%', height:6, borderRadius:3, background:'#1a1a1a', overflow:'hidden' }}>
                    <div style={{ width:`${(value / 255) * 100}%`, height:'100%', background: active ? C.white : '#3a3a3a' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {contextMenu && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position:'fixed', top: contextMenu.y, left: contextMenu.x,
            background:'#2e2e2e', border:'1px solid #444', borderRadius:4,
            zIndex:1000, minWidth:140, boxShadow:'0 4px 12px rgba(0,0,0,0.5)',
          }}
        >
          <div
            onClick={openSaveModal}
            style={{ padding:'8px 14px', fontSize:12, cursor:'pointer', color:'#e0e0e0' }}
            onMouseEnter={e => e.currentTarget.style.background='#383838'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}
          >
            Salvar Cena...
          </div>
          <div
            onClick={scenes[contextMenu.sceneKey] ? handleClearScene : undefined}
            style={{
              padding:'8px 14px', fontSize:12,
              cursor: scenes[contextMenu.sceneKey] ? 'pointer' : 'not-allowed',
              color: scenes[contextMenu.sceneKey] ? '#e0e0e0' : '#555',
            }}
            onMouseEnter={e => { if (scenes[contextMenu.sceneKey]) e.currentTarget.style.background='#383838'; }}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}
          >
            Limpar Cena
          </div>
        </div>
      )}

      {saveModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
          <div style={{ background:'#242424', border:'1px solid #444', borderRadius:6, width:320, fontFamily:'Segoe UI, system-ui, sans-serif', color:'#e0e0e0' }}>

            {/* Header */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', borderBottom:'1px solid #383838' }}>
              <span style={{ fontSize:13, fontWeight:600 }}>Salvar Cena</span>
              <button onClick={() => setSaveModal(null)} style={{ background:'none', border:'none', color:'#888', fontSize:18, cursor:'pointer', lineHeight:1 }}>✕</button>
            </div>

            {/* Body */}
            <div style={{ padding:16, display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <div style={{ fontSize:11, color:'#888', marginBottom:6 }}>Nome da cena</div>
                <input
                  value={modalName}
                  onChange={e => setModalName(e.target.value)}
                  placeholder="Nome da cena..."
                  style={{ width:'100%', padding:'6px 8px', borderRadius:3, background:'#1a1a1a', border:'1px solid #444', color:'#e0e0e0', fontSize:12, boxSizing:'border-box' }}
                />
              </div>
              <div>
                <div style={{ fontSize:11, color:'#888', marginBottom:8 }}>Cor</div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {COLORS.map(color => (
                    <div
                      key={color}
                      onClick={() => setModalColor(color)}
                      style={{
                        width:32, height:32, borderRadius:4, background:color, cursor:'pointer',
                        border: modalColor === color ? '2px solid #ffffff' : '2px solid transparent',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, padding:'10px 14px', borderTop:'1px solid #383838' }}>
              <button onClick={() => setSaveModal(null)} style={{ padding:'5px 16px', borderRadius:3, fontSize:12, cursor:'pointer', background:'#2e2e2e', color:'#e0e0e0', border:'1px solid #444' }}>
                Cancelar
              </button>
              <button onClick={handleConfirmSave} style={{ padding:'5px 16px', borderRadius:3, fontSize:12, cursor:'pointer', background:'#383838', color:'#ffffff', border:'1px solid #555' }}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function TopBtn({ onClick, children, danger, disabled }) {
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} style={{
      padding:'4px 12px', borderRadius:3, fontSize:12,
      cursor: disabled ? 'not-allowed' : 'pointer',
      background: disabled ? '#222' : danger ? '#3a2020' : C.btnBg,
      color: disabled ? '#555' : danger ? '#cc4444' : C.text,
      border:`1px solid ${disabled ? '#333' : danger ? '#552222' : C.btnBorder}`,
    }}>{children}</button>
  );
}

function PageBtn({ onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding:'2px 6px', borderRadius:3, cursor:'pointer', fontSize:11,
      background:C.btnBg, color:C.text, border:`1px solid ${C.btnBorder}`,
    }}>{children}</button>
  );
}