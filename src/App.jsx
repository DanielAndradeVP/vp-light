import React, { useState } from 'react';
import { ShowProvider } from './store/showStore.js';
import Main from './screens/Main.jsx';
import FixturePanel from './screens/FixturePanel.jsx';

export default function App() {
  const [screen, setScreen] = useState('main'); // 'main' | 'fixtures'

  return (
    <ShowProvider>
      {screen === 'main' && <Main onOpenFixtures={() => setScreen('fixtures')} />}
      {screen === 'fixtures' && <FixturePanel onClose={() => setScreen('main')} />}
    </ShowProvider>
  );
}
