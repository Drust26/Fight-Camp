import { detectLang, setLang } from '../i18n';
import { UpdateNotice } from './components/UpdateNotice';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorBoundary, NavCtx, Toasts, type Nav, type Screen, type Tab } from './components/common';
import { store, useSettings, useStoreVersion } from '../game/store';
import { TitleScreen, CreditsScreen } from './screens/Title';
import { NewCareer } from './screens/NewCareer';
import { LoadScreen } from './screens/LoadGame';
import { SettingsScreen } from './screens/Settings';
import { Hub } from './screens/Hub';
import { FightPrep } from './screens/FightPrep';
import { FightScreen } from './screens/FightScreen';
import { Results } from './screens/Results';
import { FightNight } from './screens/FightNight';
import { LookScreen } from './screens/LookScreen';
import { Retirement } from './screens/Retirement';
import { QuickFightSetup } from './screens/QuickFight';
import { audio } from '../game/audio';

function uiStyle(screen: Screen, z: number): React.CSSProperties {
  if (z === 1 || screen === 'fight' || screen === 'practice' || screen === 'quickbout') return { height: '100%' };
  return { height: '100%', zoom: z, ['--app-h' as any]: `calc(100vh / ${z})` } as React.CSSProperties;
}

export default function App() {
  useStoreVersion();
  const settings = useSettings();
  const lang = settings.lang ?? detectLang();
  setLang(lang);
  const [screen, setScreen] = useState<Screen>('title');
  const [tab, setTab] = useState<Tab>('overview');
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: string }[]>([]);
  const tid = useRef(0);

  const toast = useCallback((msg: string, kind: 'ok' | 'err' | 'info' = 'info') => {
    const id = ++tid.current;
    setToasts((t) => [...t.slice(-3), { id, msg, kind }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  const go = useCallback((s: Screen) => {
    if (['hub', 'prep', 'fightnight', 'look', 'fight', 'results', 'retired'].includes(s) && !store.state) s = 'title';
    setScreen(s);
  }, []);

  const nav: Nav = useMemo(() => ({ screen, tab, go, setTab, toast }), [screen, tab, go, toast]);

  // first user gesture unlocks audio
  useEffect(() => {
    const unlock = () => audio.resume();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, []);
  useEffect(() => { audio.applyVolume(); }, [settings]);
  // save on tab close
  useEffect(() => {
    const h = () => { if (store.state) store.saveNow(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  let view: JSX.Element;
  switch (screen) {
    case 'title': view = <TitleScreen />; break;
    case 'credits': view = <CreditsScreen />; break;
    case 'new': view = <NewCareer />; break;
    case 'load': view = <LoadScreen />; break;
    case 'settings': view = <SettingsScreen standalone />; break;
    case 'hub': view = <Hub />; break;
    case 'prep': view = <FightPrep />; break;
    case 'fightnight': view = <FightNight />; break;
    case 'look': view = <LookScreen />; break;
    case 'fight': view = <FightScreen mode="career" />; break;
    case 'practice': view = <FightScreen mode="practice" />; break;
    case 'quick': view = <QuickFightSetup />; break;
    case 'quickbout': view = <FightScreen mode="quick" />; break;
    case 'results': view = <Results />; break;
    case 'retired': view = <Retirement />; break;
    default: view = <TitleScreen />;
  }
  return (
    <NavCtx.Provider value={nav}>
      <div key={lang} className={settings.reducedMotion ? 'reduced-motion' : ''} style={uiStyle(screen, settings.uiScale ?? 1)}>
        <ErrorBoundary onReset={() => setScreen('title')}>{view}</ErrorBoundary>
        <Toasts items={toasts} />
        <UpdateNotice />
      </div>
    </NavCtx.Provider>
  );
}
