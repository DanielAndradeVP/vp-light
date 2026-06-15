/**
 * SceneEditor.jsx — Editor de cena com faders por canal
 *
 * Funcionalidades:
 *   - Faders para todos os canais dos fixtures
 *   - Preview ao vivo: cada fader envia window.vp.setChannel em tempo real
 *   - Salvar: persiste a cena no show.json via window.vp.updateScene
 *   - Nome editável da cena
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useShow } from '../store/showStore.js';
import theme from '../theme.js';

const styles = {
  root: {
    display: 'flex', flexDirection: 'column', height: '100vh',
    background: '#0a0a0a', color: '#e0e0e0',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '8px 16px', background: '#111', borderBottom: '1px solid #222', minHeight: 44,
  },
  logo: { fontWeight: 700, fontSize: 18, color: '#7c6aff', letterSpacing: 2 },
  title: { flex: 1, fontSize: 13, color: '#888' },
  nameInput: {
    padding: '4px 10px', borderRadius: 6, background: '#1a1a2e',
    border: '1px solid #2a2a4a', color: '#e0e0e0', fontSize: 14, width: 220,
  },
  btnSmall: (color) => ({
    minHeight: 36, padding: '0 16px', borderRadius: 4, cursor: 'pointer',
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.button.fontSize,
    fontWeight: theme.typography.button.fontWeight,
    background: color === 'purple' ? theme.colors.warn : color === 'green' ? theme.colors.primary : 'transparent',
    color: color === 'purple' ? '#ffffff' : color === 'green' ? '#ffffff' : theme.colors.primary,
    border: 'none',
    boxShadow: color === 'purple' || color === 'green' ? theme.elevation.z2 : 'none',
  }),
  body: { flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 20 },
  fixtureCard: {
    background: '#111', borderRadius: 10, border: '1px solid #1e1e2e', padding: 14,
  },
  fixtureName: { fontSize: 12, fontWeight: 700, color: '#7c6aff', marginBottom: 12, letterSpacing: 1 },
  channelRow: {
    display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
  },
  chanLabel: { width: 110, fontFamily: theme.typography.fontFamily, fontSize: '14px', color: theme.colors.textSecondary, flexShrink: 0 },
  chanNum: { width: 32, fontFamily: theme.typography.fontFamily, fontSize: 10, color: theme.colors.textDisabled, flexShrink: 0 },
  fader: { flex: 1, cursor: 'pointer', accentColor: theme.colors.primary, height: 6 },
  chanValue: { width: 32, textAlign: 'right', fontFamily: theme.typography.fontFamily, fontSize: theme.typography.sliderThumb.fontSize, fontWeight: theme.typography.sliderThumb.fontWeight, color: theme.colors.primary, flexShrink: 0 },
  zeroBtn: {
    width: 22, height: 22, borderRadius: 4, background: 'transparent',
    border: `1px solid ${theme.colors.textDisabled}`, color: theme.colors.primary, fontSize: 10, cursor: 'pointer',
    fontFamily: theme.typography.fontFamily,
    flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  fullBtn: {
    width: 22, height: 22, borderRadius: 4, background: 'transparent',
    border: `1px solid ${theme.colors.textDisabled}`, color: theme.colors.primary, fontSize: 10, cursor: 'pointer',
    fontFamily: theme.typography.fontFamily,
    flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  footer: {
    padding: '12px 16px', background: '#0f0f0f', borderTop: '1px solid #1a1a1a',
    display: 'flex', gap: 10, alignItems: 'center',
  },
  saveBtn: {
    flex: 1, minHeight: 36, padding: '0 16px', borderRadius: 4, cursor: 'pointer',
    background: theme.colors.primary,
    color: '#ffffff',
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.button.fontSize,
    fontWeight: theme.typography.button.fontWeight,
    border: 'none',
    boxShadow: theme.elevation.z2,
  },
};

export default function SceneEditor({ pageId, sceneKey, onClose }) {
  const { show, currentPageData, updateScene } = useShow();

  const existingScene = currentPageData?.scenes?.[sceneKey];
  const fixtures = show?.fixtures ?? [];

  // Estado local dos canais: { [dmxChannel]: value }
  const [channels, setChannels] = useState(() => {
    return existingScene?.channels ? { ...existingScene.channels } : {};
  });
  const [sceneName, setSceneName] = useState(existingScene?.name ?? `Cena ${sceneKey}`);

  // Ao mudar um fader: atualiza estado E envia ao hardware em tempo real
  const handleChange = useCallback((dmxChannel, value) => {
    const num = Number(value);
    setChannels(prev => ({ ...prev, [dmxChannel]: num }));
    window.vp.setChannel(dmxChannel, num);
  }, []);

  const setFixtureValue = useCallback((fixture, chanOffset, value) => {
    const dmxChannel = fixture.startChannel + chanOffset;
    handleChange(dmxChannel, value);
  }, [handleChange]);

  // Preview ao vivo: quando abre o editor, limpa o universo e reaplica apenas a cena
  useEffect(() => {
    if (existingScene?.channels) {
      window.vp.restoreState(existingScene.channels);
    }
  }, [existingScene?.channels]);

  // Blackout ao fechar (sem salvar)
  const handleClose = useCallback(() => {
    window.vp.blackout();
    onClose();
  }, [onClose]);

  const handleSave = useCallback(async () => {
    // Filtra canais com valor 0 (economiza espaço no JSON)
    const cleanChannels = {};
    for (const [ch, val] of Object.entries(channels)) {
      if (Number(val) > 0) cleanChannels[ch] = Number(val);
    }
    await updateScene(pageId, sceneKey, { name: sceneName, channels: cleanChannels });
    onClose();
  }, [channels, sceneName, pageId, sceneKey, updateScene, onClose]);

  const getVal = (dmxChannel) => channels[dmxChannel] ?? 0;

  return (
    <div style={styles.root}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.logo}>VP·LIGHT</span>
        <span style={styles.title}>
          Editor de Cena — Pág. {pageId} / Cena {sceneKey}
        </span>
        <input
          style={styles.nameInput}
          value={sceneName}
          onChange={e => setSceneName(e.target.value)}
          placeholder="Nome da cena…"
        />
        <button style={styles.btnSmall('purple')} onClick={() => window.vp.blackout()}>
          Blackout
        </button>
        <button style={styles.btnSmall()} onClick={handleClose}>
          Cancelar
        </button>
      </div>

      {/* Faders por fixture */}
      <div style={styles.body}>
        {fixtures.map(fixture => (
          <div key={fixture.id} style={styles.fixtureCard}>
            <div style={styles.fixtureName}>
              {fixture.name}
              <span style={{ color: '#444', fontWeight: 400, marginLeft: 8 }}>
                ch {fixture.startChannel}–{fixture.startChannel + fixture.channelCount - 1}
              </span>
            </div>

            {fixture.channels.map((chanName, offset) => {
              const dmxChannel = fixture.startChannel + offset;
              const val = getVal(dmxChannel);
              return (
                <div key={offset} style={styles.channelRow}>
                  <span style={styles.chanNum}>{dmxChannel}</span>
                  <span style={styles.chanLabel}>{chanName}</span>
                  <button style={styles.zeroBtn}
                    onClick={() => handleChange(dmxChannel, 0)} title="Zerar">0</button>
                  <input
                    type="range" min={0} max={255} value={val}
                    style={styles.fader}
                    onChange={e => handleChange(dmxChannel, e.target.value)}
                  />
                  <button style={styles.fullBtn}
                    onClick={() => handleChange(dmxChannel, 255)} title="Full">FF</button>
                  <span style={styles.chanValue}>{val}</span>
                </div>
              );
            })}
          </div>
        ))}

        {fixtures.length === 0 && (
          <div style={{ color: '#444', textAlign: 'center', padding: 40 }}>
            Nenhum fixture no show. Adicione fixtures ao show.json.
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <button style={styles.saveBtn} onClick={handleSave}>
          💾 SALVAR CENA
        </button>
      </div>
    </div>
  );
}
