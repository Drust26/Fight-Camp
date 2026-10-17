import { WhatsNewOnUpdate } from '../components/WhatsNew';
import { native } from '../../game/storage';
import { LogoMark } from '../components/Logo';
import { useEffect, useMemo, useRef } from 'react';
import { Play, FolderOpen, Plus, Settings as Cog, Info, Swords, GraduationCap } from 'lucide-react';
import { useNav, Btn } from '../components/common';
import { lastSlot, readSlot, slotInfos } from '../../game/save';
import { store } from '../../game/store';
import { createFight, startNextRound, step, type FightState } from '../../combat/engine';
import { AIController } from '../../combat/ai';
import { FightRenderer } from '../../combat/renderer';
import { genAttrs } from '../../game/fighterGen';
import { RNG } from '../../game/rng';
import type { StyleId } from '../../game/types';
import { STYLE } from '../../data/world';
import { t } from '../../i18n';
import { LanguagePicker } from '../components/LanguagePicker';

function demoFight(seed: number) {
  const rng = new RNG(seed);
  const styles: StyleId[] = ['pressure', 'kickboxer', 'wrestler', 'counter', 'balanced', 'power'];
  const mk = (i: number) => {
    const style = rng.pick(styles);
    return {
      name: i ? t('Blue Corner') : t('Red Corner'), short: i ? t('Blue') : t('Red'), attrs: genAttrs(rng, 65, style), heightCm: 180, reachCm: 184, stance: 'orthodox' as const,
      style, plan: STYLE[style].plan, isPlayer: false,
      appearance: { skin: rng.int(0, 6), hair: rng.int(0, 5), hairColor: rng.int(0, 6), facialHair: rng.int(0, 3), shorts: i ? 1 : 0, gloves: i ? 2 : 0, accessory: rng.int(0, 3) },
    };
  };
  const a = mk(0), b = mk(1);
  const s = createFight({ rounds: 99, roundSeconds: 60, seed, title: false }, a, b);
  return { s, ai: [new AIController(0, a.style, 'normal', seed + 1), new AIController(1, b.style, 'normal', seed + 2)] };
}

export function TitleScreen() {
  const nav = useNav();
  const canvas = useRef<HTMLCanvasElement>(null);
  const last = useMemo(() => lastSlot(), []);
  const cont = useMemo(() => (last ? readSlot(last) : null), [last]);
  const hasAny = useMemo(() => slotInfos().some((s) => s.status === 'ok'), []);

  useEffect(() => {
    const c = canvas.current!;
    const r = new FightRenderer(c);
    r.showRange = false;
    r.reducedMotion = store.settings.reducedMotion;
    r.resize();
    let demo = demoFight(Date.now() & 0xffff);
    let raf = 0, lastT = performance.now(), acc = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      acc += dt;
      while (acc >= 1 / 60) {
        acc -= 1 / 60;
        const s: FightState = demo.s;
        if (s.phase === 'roundOver') startNextRound(s);
        if (s.phase === 'over' && s.phaseT > 0) { demo = demoFight((Date.now() & 0xffff) + 7); }
        step(s, [demo.ai[0].think(s, 1 / 60), demo.ai[1].think(s, 1 / 60)], 1 / 60);
        r.onEvents(s.events.splice(0), s);
        if (s.phase === 'over') s.phaseT += 1 / 60;
      }
      // render without HUD clutter: draw full then fade top
      r.render(demo.s, dt, { paused: false, hud: false });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const onR = () => r.resize();
    window.addEventListener('resize', onR);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onR); };
  }, []);

  const continueCareer = () => {
    if (!cont?.state) return;
    store.set(cont.state);
    nav.go(cont.state.player.retired ? 'retired' : 'hub');
  };

  return (
    <div className="title-screen">
      <WhatsNewOnUpdate />
      <div className="title-bg" />
      <div className="title-left">
        <div className="logo-lockup">
          <LogoMark size={148} className="logo-mark-big" />
          <div className="logo-big">
            <span className="l1">Fight</span>
            <span className="l2">Camp</span>
          </div>
        </div>
        <span className="logo-tagline">{t('MMA CAREER SIMULATOR')}</span>
        <div className="menu">
          {cont?.state && (
            <Btn variant="primary" onClick={continueCareer}>
              <Play size={18} /> {t('Continue')}
              <span className="small" style={{ marginLeft: 'auto', fontFamily: 'var(--body)', textTransform: 'none', letterSpacing: 0, opacity: 0.85 }}>{cont.info.name} · {cont.info.record}</span>
            </Btn>
          )}
          <Btn variant={cont?.state ? '' : 'primary'} onClick={() => nav.go('new')}><Plus size={18} /> {t('New Career')}</Btn>
          <Btn onClick={() => nav.go('load')} disabled={!hasAny}><FolderOpen size={18} /> {t('Load Career')}</Btn>
          <Btn onClick={() => nav.go('quick')}><Swords size={18} /> {t('Quick Fight')}</Btn>
          <Btn onClick={() => nav.go('practice')}><GraduationCap size={18} /> {t('Practice Arena')}</Btn>
          <Btn onClick={() => nav.go('settings')}><Cog size={18} /> {t('Settings')}</Btn>
          <Btn variant="ghost" onClick={() => nav.go('credits')}><Info size={18} /> {t('Credits')}</Btn>
        </div>
        <LanguagePicker compact />
        <div className="tiny dim">{t('All organisations, fighters and brands are fictional.')} v{__APP_VERSION__} · {native ? t('Saves: {dir}', { dir: native.savesDir() }) : t('Saves stay in this browser.')}</div>
      </div>
      <div className="title-art">
        <canvas ref={canvas} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, #07080b 0%, transparent 30%), linear-gradient(0deg, #07080b 0%, transparent 25%)', pointerEvents: 'none' }} />
      </div>
    </div>
  );
}

export function CreditsScreen() {
  const nav = useNav();
  return (
    <div style={{ height: 'var(--app-h, 100vh)', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="panel hero" style={{ maxWidth: 620 }}>
        <h1 style={{ marginBottom: 10 }}>{t('Credits')}</h1>
        <p className="muted">{t('Fight Camp: MMA Career Simulator — an original browser game.')}</p>
        <ul className="muted" style={{ lineHeight: 1.8 }}>
          <li>{t('Design, code, combat simulation and AI: built for this project.')}</li>
          <li>{t('All promotions (Hexagon Fighting Championship, Global Fight Championship, Continental MMA Series, Rising Fighters League, Independent Fight Circuit), fighters, gyms and sponsors are fictional.')}</li>
          <li>{t('Graphics: procedurally drawn on canvas/SVG. Audio: synthesized live with the Web Audio API.')}</li>
          <li>{t('Icons: Lucide (ISC licence). Fonts: Oswald & Inter (SIL Open Font Licence), with system fallbacks offline.')}</li>
        </ul>
        <Btn variant="primary" onClick={() => nav.go('title')}>{t('Back')}</Btn>
      </div>
    </div>
  );
}
