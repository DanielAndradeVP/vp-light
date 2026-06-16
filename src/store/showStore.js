/**
 * showStore.js — Estado global do show no renderer
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const ShowContext = createContext(null);
const FIXTURE_GRID_SIZE = 40;

function snapFixtureGridValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number / FIXTURE_GRID_SIZE) * FIXTURE_GRID_SIZE;
}

function normalizeFixturePositionData(data) {
  if (!data || typeof data !== 'object') return {};
  const next = { ...data };
  if ('posX' in next) next.posX = snapFixtureGridValue(next.posX);
  if ('posY' in next) next.posY = snapFixtureGridValue(next.posY);
  return next;
}

function normalizeShowFixturePositions(showData) {
  if (!showData || !Array.isArray(showData.fixtures)) return showData;
  return {
    ...showData,
    fixtures: showData.fixtures.map(fixture => ({
      ...fixture,
      posX: snapFixtureGridValue(fixture?.posX),
      posY: snapFixtureGridValue(fixture?.posY),
    })),
  };
}

function isFixtureEnabled(fixture) {
  return fixture?.enabled !== false;
}

function getFixtureDmxChannels(fixture) {
  if (!fixture) return [];
  const startChannel = Number(fixture.startChannel) || 1;
  const channelCount = Number(fixture.channelCount ?? (fixture.channels || []).length) || 0;
  return Array.from({ length: channelCount }, (_, i) => startChannel + i);
}

function getDisabledFixtureChannelSet(fixtures) {
  // Um canal só é bloqueado se nenhum fixture HABILITADO o cobre.
  // Se dois fixtures dividem o mesmo canal e um está desabilitado mas o outro não,
  // o canal permanece funcional.
  const enabledChannels = new Set();
  (fixtures || []).forEach(fixture => {
    if (isFixtureEnabled(fixture)) {
      getFixtureDmxChannels(fixture).forEach(ch => enabledChannels.add(ch));
    }
  });
  const disabledChannels = new Set();
  (fixtures || []).forEach(fixture => {
    if (!isFixtureEnabled(fixture)) {
      getFixtureDmxChannels(fixture).forEach(ch => {
        if (!enabledChannels.has(ch)) disabledChannels.add(ch);
      });
    }
  });
  return disabledChannels;
}

function filterDisabledFixtureChannels(channelMap, disabledChannels) {
  const filtered = {};
  Object.entries(channelMap || {}).forEach(([channel, value]) => {
    if (!disabledChannels.has(Number(channel))) filtered[channel] = value;
  });
  return filtered;
}

export function normalizePageId(pageId) {
  const number = Math.max(1, Number.parseInt(pageId, 10) || 1);
  return String(number);
}

export function sceneRefId(pageId, sceneKey) {
  return `${normalizePageId(pageId)}:${String(sceneKey || '').toUpperCase()}`;
}

export function parseSceneRef(value, fallbackPageId = '1') {
  if (value && typeof value === 'object') {
    return {
      pageId: normalizePageId(value.pageId ?? fallbackPageId),
      sceneKey: String(value.sceneKey ?? value.key ?? '').toUpperCase(),
    };
  }
  const raw = String(value || '');
  const separator = raw.indexOf(':');
  if (separator !== -1) {
    return {
      pageId: normalizePageId(raw.slice(0, separator)),
      sceneKey: raw.slice(separator + 1).toUpperCase(),
    };
  }
  return { pageId: normalizePageId(fallbackPageId), sceneKey: raw.toUpperCase() };
}

export function activeSceneMatches(value, pageId, sceneKey) {
  const ref = parseSceneRef(value, pageId);
  return ref.pageId === normalizePageId(pageId) && ref.sceneKey === String(sceneKey || '').toUpperCase();
}

function createDefaultPages() {
  const pages = {};
  for (let page = 1; page <= 10; page += 1) {
    pages[String(page)] = { name: `Pagina ${page}`, scenes: {} };
  }
  return pages;
}

function normalizeShowPages(showData) {
  const pages = { ...createDefaultPages(), ...(showData?.pages || {}) };
  for (const [pageId, pageData] of Object.entries(pages)) {
    pages[pageId] = {
      name: pageData?.name || `Pagina ${pageId}`,
      scenes: pageData?.scenes || {},
    };
  }
  return { ...showData, pages };
}

const DEFAULT_SHOW = {
  version: '1.0',
  fixtures: [],
  pages: createDefaultPages(),
};

export function ShowProvider({ children }) {
  const [show, setShow] = useState(DEFAULT_SHOW);
  const [currentPage, setCurrentPage] = useState('1');
  const [activeScenes, setActiveScenes] = useState([]);
  const [selectedFixtureId, setSelectedFixtureId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const result = await window.vp.getShow();
        if (result?.show) setShow(normalizeShowFixturePositions(normalizeShowPages(result.show)));
      } catch (e) {
        console.error('[showStore] init:', e);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const saveShow = useCallback(async (data) => {
    const target = normalizeShowFixturePositions(normalizeShowPages(data || show));
    return await window.vp.saveShow(target);
  }, [show]);

  const loadShow = useCallback(async () => {
    const result = await window.vp.loadShow();
    if (result.ok) {
      setShow(normalizeShowFixturePositions(normalizeShowPages(result.show)));
      setCurrentPage('1');
      setActiveScenes([]);
    }
    return result;
  }, []);

  const addFixture = useCallback((fixture) => {
    setShow(prev => ({ ...prev, fixtures: [...prev.fixtures, fixture] }));
  }, []);

  const updateFixture = useCallback((id, data) => {
    const normalizedData = normalizeFixturePositionData(data);
    setShow(prev => ({
      ...prev,
      fixtures: prev.fixtures.map(f => f.id === id ? { ...f, ...normalizedData } : f)
    }));
  }, []);

  const removeFixture = useCallback((id) => {
    setShow(prev => ({ ...prev, fixtures: prev.fixtures.filter(f => f.id !== id) }));
    setSelectedFixtureId(null);
  }, []);

  const duplicateFixture = useCallback((id) => {
    setShow(prev => {
      const original = prev.fixtures.find(f => f.id === id);
      if (!original) return prev;
      const nextStart = prev.fixtures.reduce((max, f) => {
        const end = (f.startChannel || 1) + (f.channelCount || 1);
        return end > max ? end : max;
      }, 1);
      const copy = {
        ...original,
        id: `fixture_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: original.name + ' (cópia)',
        startChannel: nextStart,
      };
      return { ...prev, fixtures: [...prev.fixtures, copy] };
    });
  }, []);

  const activateScene = useCallback(async (sceneKey) => {
    const pageId = normalizePageId(currentPage);
    const page = show?.pages?.[pageId];
    const scene = page?.scenes?.[sceneKey];
    if (!scene) return;
    const disabledChannels = getDisabledFixtureChannelSet(show.fixtures);
    const channels = filterDisabledFixtureChannels(scene.channels || {}, disabledChannels);
    const activeRef = sceneRefId(pageId, sceneKey);
    const scenesMap = { [activeRef]: { name: scene.name || sceneKey, channels } };
    window.vp.setActiveSceneChannels(channels);
    window.vp.setActiveScenes(scenesMap);
    await window.vp.restoreState(channels);
    setActiveScenes(prev => (prev.length === 1 && prev[0] === activeRef) ? prev : [activeRef]);
  }, [show, currentPage]);

  // Cena normal: sempre uma ativa. Clicar na cena atual nao desliga;
  // clicar em outra troca a cena ativa sem tocar na logica de scripts/page-scripts.
  const toggleScene = useCallback((sceneKey) => {
    const pageId = normalizePageId(currentPage);
    const page = show?.pages?.[pageId];
    const scene = page?.scenes?.[sceneKey];
    if (!scene?.channels || Object.keys(scene.channels).length === 0) return;
    const disabledChs = getDisabledFixtureChannelSet(show.fixtures);
    const channels = filterDisabledFixtureChannels(scene.channels, disabledChs);
    const activeRef = sceneRefId(pageId, sceneKey);
    const scenesMap = { [activeRef]: { name: scene.name || sceneKey, channels } };

    setActiveScenes(prev => {
      if (prev.some(item => item === activeRef || activeSceneMatches(item, pageId, sceneKey))) {
        if (prev.length === 1) return prev;
        window.vp.setActiveSceneChannels(channels);
        window.vp.setActiveScenes(scenesMap);
        window.vp.restoreState(channels);
        return [activeRef];
      }
      window.vp.setActiveSceneChannels(channels);
      window.vp.setActiveScenes(scenesMap);
      window.vp.restoreState(channels);
      return [activeRef];
    });
  }, [show, currentPage]);

  const blackout = useCallback(async () => {
    await window.vp.blackout();
    setActiveScenes([]);
  }, []);

  const updateScene = useCallback(async (pageId, sceneKey, sceneData) => {
    const normalizedPageId = normalizePageId(pageId);
    const shouldDelete = !sceneData.name
      && !sceneData.color
      && Object.keys(sceneData.channels || {}).length === 0
      && Object.keys(sceneData.customFunctions || {}).length === 0;
    setShow(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next.pages[normalizedPageId]) next.pages[normalizedPageId] = { name: `Pagina ${normalizedPageId}`, scenes: {} };
      if (shouldDelete) {
        delete next.pages[normalizedPageId].scenes[sceneKey];
      } else {
        next.pages[normalizedPageId].scenes[sceneKey] = sceneData;
      }
      return next;
    });
    if (shouldDelete) {
      setActiveScenes(prev => prev.filter(item => !activeSceneMatches(item, normalizedPageId, sceneKey)));
    }
    return window.vp.updateScene(normalizedPageId, sceneKey, sceneData);
  }, []);

  const disabledFixtureChannels = useMemo(() => getDisabledFixtureChannelSet(show.fixtures), [show.fixtures]);
  const selectedFixture = show.fixtures.find(f => f.id === selectedFixtureId && isFixtureEnabled(f)) || null;
  const pages = show.pages || {};
  const currentPageData = pages[normalizePageId(currentPage)] || { name: '', scenes: {} };

  return (
    <ShowContext.Provider value={{
      show, loading,
      currentPage, setCurrentPage,
      activeScenes, setActiveScenes,
      selectedFixtureId, setSelectedFixtureId,
      selectedFixture,
      disabledFixtureChannels,
      pages, currentPageData,
      saveShow, loadShow,
      addFixture, updateFixture, removeFixture, duplicateFixture,
      activateScene, toggleScene, blackout,
      updateScene,
      setShow,
    }}>
      {children}
    </ShowContext.Provider>
  );
}

export function useShow() {
  const ctx = useContext(ShowContext);
  if (!ctx) throw new Error('useShow fora do ShowProvider');
  return ctx;
}
