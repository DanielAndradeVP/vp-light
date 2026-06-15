import React, { useState } from 'react';
import { ShowProvider } from './store/showStore.js';
import Main from './screens/Main.jsx';
import FixturePanel from './screens/FixturePanel.jsx';
import PainelOperacao from './screens/PainelOperacao.jsx';

export default function App() {
  const [screen, setScreen] = useState('main'); // 'main' | 'fixtures' | 'painel'

  return (
    <ShowProvider>
      {screen === 'main' && (
        <Main
          onOpenFixtures={() => setScreen('fixtures')}
          onOpenPainel={() => setScreen('painel')}
        />
      )}
      {screen === 'fixtures' && <FixturePanel onClose={() => setScreen('main')} />}
      {screen === 'painel' && <PainelOperacao onClose={() => setScreen('main')} />}
    </ShowProvider>
  );
}
