import { t } from '../i18n';
import { Btn, useNav, type Tab } from './components/common';
import { store, useGame } from '../game/store';

const STEPS: { tab: Tab; title: string; body: string }[] = [
  { tab: 'overview', title: 'Welcome to camp', body: 'This is your career hub. Your condition, money, next fight and news live here. The most important next action is always the orange button in the top bar.' },
  { tab: 'training', title: 'Training plan', body: 'Each day has a morning and evening slot. Click a slot, then pick a session from the library. Every session shows the attributes it improves, its fatigue cost and injury risk. Your plan repeats every week.' },
  { tab: 'training', title: 'Fatigue & injuries', body: 'Fatigue builds with hard sessions and slows your gains. Train exhausted and your injury risk climbs fast. Rest days (empty slots), Active Recovery and Mobility keep you healthy. Injuries block certain sessions until healed.' },
  { tab: 'offers', title: 'Fight offers', body: 'Promoters send offers with an opponent, date and purse. Check the difficulty and the scouting report, then accept and choose a camp focus. You can only have one fight booked at a time.' },
  { tab: 'overview', title: 'Advancing time', body: 'Use Next Day or Advance Week. Time stops automatically for fight night, injuries, offers and decisions. Monthly bills are paid on the 1st — watch your bank balance.' },
  { tab: 'overview', title: 'Learn to fight', body: 'Before your first bout, try the Practice Arena: it walks you through movement, striking, defense, stamina, takedowns, ground work and submissions against a training partner. Nothing there affects your career.' },
];

export function CoachTour() {
  const st = useGame();
  const nav = useNav();
  const step = st.tutorialStep;
  if (step < 0 || step >= STEPS.length) return null;
  const s = STEPS[step];
  const next = () => {
    const n = step + 1;
    store.act((g) => { g.tutorialStep = n >= STEPS.length ? -1 : n; });
    if (n < STEPS.length) nav.setTab(STEPS[n].tab);
  };
  return (
    <div className="coach" role="dialog" aria-label={t('Tutorial')}>
      <div className="who"><div className="av">RD</div><div><div style={{ fontWeight: 700 }}>Coach Ray Dunn</div><div className="tiny dim">{t('Tutorial {n}/{m}', { n: step + 1, m: STEPS.length })}</div></div></div>
      <h3 style={{ marginBottom: 6 }}>{t(s.title)}</h3>
      <p className="small muted" style={{ marginTop: 0 }}>{t(s.body)}</p>
      <div className="row between">
        <Btn variant="ghost" size="sm" onClick={() => store.act((g) => { g.tutorialStep = -1; })}>{t('Skip tour')}</Btn>
        <div className="row">
          {step === STEPS.length - 1 && <Btn size="sm" onClick={() => { store.act((g) => { g.tutorialStep = -1; }); nav.go('practice'); }}>{t('Open Practice Arena')}</Btn>}
          <Btn variant="primary" size="sm" onClick={next}>{step === STEPS.length - 1 ? t('Done') : t('Next')}</Btn>
        </div>
      </div>
    </div>
  );
}

/** Scripted combat lessons for the practice arena; each completes when the sim reports the matching event. */
export const PRACTICE_LESSONS: { id: string; title: string; body: string; done: (ctx: { pos: string; events: string[]; pressed: Set<string>; moved: boolean; guarded: boolean; lowGuard: boolean }) => boolean }[] = [
  { id: 'move', title: '1 · Movement', body: 'Use W/S to move toward and away from your partner, A/D to circle. Watch the RANGE bar at the bottom: purple = clinch, red = punching, yellow = kicking.', done: (c) => c.moved },
  { id: 'jab', title: '2 · Strike', body: 'Get into punching range and throw a JAB (J) and a CROSS (K). Strikes only land inside their range and when the opponent isn\'t defending.', done: (c) => c.pressed.has('jab') && c.pressed.has('cross') },
  { id: 'land', title: '3 · Land clean', body: 'Land a few strikes. Combine punches quickly for faster follow-ups (combos). Hold Shift for a slower, harder power shot.', done: (c) => c.events.filter((e) => e === 'hit' || e === 'counter').length >= 3 },
  { id: 'kick', title: '4 · Kicks', body: 'From a little further out, throw a LOW KICK (N) or BODY KICK (M). Kicks cost more stamina and leave you exposed if they miss.', done: (c) => c.pressed.has('lowkick') || c.pressed.has('bodykick') || c.pressed.has('headkick') },
  { id: 'guard', title: '5 · Defend', body: 'Hold Q for a high guard (absorbs head shots) or C to guard the body and check leg kicks. Tap Space to slip — a successful slip opens a counter window. Watch the warning above your opponent: it tells you what\'s coming.', done: (c) => c.guarded && c.pressed.has('evade') },
  { id: 'stamina', title: '6 · Stamina', body: 'Every strike, shot and burst drains the green stamina bar. Below a third your speed, power and defense fall off a cliff. Breathe at range to recover. Got it? Throw anything to continue.', done: (c) => c.events.length > 0 && c.pressed.size >= 4 },
  { id: 'td', title: '7 · Takedowns', body: 'Close to range and press R to shoot a takedown. If the opponent shoots on you, press R or Space DURING the shot to sprawl. E enters the clinch.', done: (c) => c.events.includes('td') || c.pos !== 'standing' },
  { id: 'ground', title: '8 · Ground game', body: 'On top: J/K strike, F advances position (half guard → side → mount → back), E stands up. On bottom: Q covers up, F escapes, Space sweeps, E wall-walks up. Advance to a dominant position.', done: (c) => ['side', 'mount', 'back'].includes(c.pos) || c.events.includes('pos') },
  { id: 'sub', title: '9 · Submissions', body: 'From side control or mount press G for an armbar (back = rear-naked choke). Then press G each time the marker crosses the pink zone. When defending, press Space in the green zone.', done: (c) => c.events.includes('sub') },
  { id: 'win', title: '10 · Winning', body: 'Finish by KO, TKO or submission — or win rounds on the judges\' cards with damage, knockdowns, takedowns and control. That\'s the basics. Press Esc and leave the practice arena whenever you\'re ready.', done: () => false },
];
