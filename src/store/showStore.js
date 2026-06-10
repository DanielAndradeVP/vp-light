/**
 * showStore.js — Estado global do show no renderer
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ShowContext = createContext(null);

const DEFAULT_SHOW = {
  version: '1.0',
  fixtures: [],
  pages: {
    '1': { name: 'Página 1', scenes: {} }
  }
};

export function ShowProvider({ children }) {
  const [show, setShow] = useState(DEFAULT_SHOW);
  const [currentPage, setCurrentPage] = useState('1');
  const [activeScene, setActiveScene] = useState(null);
  const [selectedFixtureId, setSelectedFixtureId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const result = await window.vp.getShow();
        if (result?.show) setShow(result.show);
      } catch (e) {
        console.error('[showStore] init:', e);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const saveShow = useCallback(async (data) => {
    const target = data || show;
    return await window.vp.saveShow(target);
  }, [show]);

  const loadShow = useCallback(async () => {
    const result = await window.vp.loadShow();
    if (result.ok) {
      setShow(result.show);
      setCurrentPage('1');
      setActiveScene(null);
    }
    return result;
  }, []);

  const addFixture = useCallback((fixture) => {
    setShow(prev => ({ ...prev, fixtures: [...prev.fixtures, fixture] }));
  }, []);

  const updateFixture = useCallback((id, data) => {
    setShow(prev => ({
      ...prev,
      fixtures: prev.fixtures.map(f => f.id === id ? { ...f, ...data } : f)
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
      const copy = {
        ...original,
        id: `fixture_${Date.now()}`,
        name: original.name + ' (cópia)',
      };
      return { ...prev, fixtures: [...prev.fixtures, copy] };
    });
  }, []);

  const activateScene = useCallback(async (sceneKey) => {
    const page = show?.pages?.[currentPage];
    const scene = page?.scenes?.[sceneKey];
    if (!scene) return;
    await window.vp.activateScene(scene.channels || {});
    setActiveScene(sceneKey);
  }, [show, currentPage]);

  const blackout = useCallback(async () => {
    await window.vp.blackout();
    setActiveScene(null);
  }, []);

  const updateScene = useCallback((pageId, sceneKey, sceneData) => {
    setShow(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next.pages[pageId]) next.pages[pageId] = { name: `Página ${pageId}`, scenes: {} };
      if (!sceneData.name && !sceneData.color && Object.keys(sceneData.channels || {}).length === 0) {
        delete next.pages[pageId].scenes[sceneKey];
      } else {
        next.pages[pageId].scenes[sceneKey] = sceneData;
      }
      return next;
    });
    window.vp.updateScene(pageId, sceneKey, sceneData);
  }, []);

  const selectedFixture = show.fixtures.find(f => f.id === selectedFixtureId) || null;
  const pages = show.pages || {};
  const currentPageData = pages[currentPage] || { name: '', scenes: {} };

  return (
    <ShowContext.Provider value={{
      show, loading,
      currentPage, setCurrentPage,
      activeScene, setActiveScene,
      selectedFixtureId, setSelectedFixtureId,
      selectedFixture,
      pages, currentPageData,
      saveShow, loadShow,
      addFixture, updateFixture, removeFixture, duplicateFixture,
      activateScene, blackout,
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
