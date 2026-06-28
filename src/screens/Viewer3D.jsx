import React, { useEffect, useRef } from 'react';
import { createViewer3DScene } from '../viewer3d/scene.js';

/**
 * Viewer3D — tela da janela 3D.
 * Consome dmx-universe (fixtures) e viewer3d:active-scripts (rótulo acima da parede).
 */
export default function Viewer3D() {
  const canvasRef = useRef(null);
  const universeRef = useRef(new Array(512).fill(0));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const viewer = createViewer3DScene(canvas);
    viewer.dmxUniverseRef = universeRef;

    const handleResize = () => {
      viewer.handleResize(window.innerWidth, window.innerHeight);
    };

    handleResize();
    viewer.start();
    window.addEventListener('resize', handleResize);

    const unsubscribeDmxUniverse = window.vp?.onDmxUniverse?.((channels) => {
      universeRef.current = channels;
    });

    const unsubscribeActiveScripts = window.vp?.onActiveScripts?.((names) => {
      viewer.setActiveScriptNames(names);
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      unsubscribeDmxUniverse?.();
      unsubscribeActiveScripts?.();
      viewer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  );
}
