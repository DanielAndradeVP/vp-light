import React, { useEffect, useRef } from 'react';
import { createViewer3DScene } from '../viewer3d/scene.js';

/**
 * Viewer3D — tela da janela 3D (Fase 3).
 *
 * Responsabilidade: montar um <canvas> em tela cheia, inicializar a cena
 * estática (palco, treliça, fixtures) via src/viewer3d/scene.js, manter o
 * tamanho do renderer sincronizado com a janela e limpar tudo ao desmontar.
 *
 * Fase 3: recebe o universo DMX (512 canais) via window.vp.onDmxUniverse,
 * armazenado em uma ref (sem state React, sem re-render por frame) e
 * exposto no objeto do viewer como fonte de leitura para uma fase futura.
 * Os fixtures ainda NÃO reagem visualmente aos valores DMX nesta fase.
 */
export default function Viewer3D() {
  const canvasRef = useRef(null);
  const universeRef = useRef(new Array(512).fill(0));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const viewer = createViewer3DScene(canvas);
    // Expõe a ref do universo no próprio objeto do viewer — fonte de leitura
    // pronta para o loop de animação Three.js consumir em fase futura.
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

    // Log temporário de desenvolvimento — valida a chegada do universo
    // exibindo o canal 1 a cada 500ms. Remover quando a Fase 4 (reação
    // visual dos fixtures) estiver implementada.
    const debugLogInterval = setInterval(() => {
      console.log('[viewer3d] canal 1 =', universeRef.current[0]);
    }, 500);

    return () => {
      window.removeEventListener('resize', handleResize);
      unsubscribeDmxUniverse?.();
      clearInterval(debugLogInterval);
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
