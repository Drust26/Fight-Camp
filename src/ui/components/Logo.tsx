// The Fight Camp mark: a cage octagon with the FC monogram over a hand-wrap band (source: branding/make_logo.py).
import icon from '../../assets/brand/icon.svg';
import iconSmall from '../../assets/brand/icon-small.svg';

export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return <img src={size <= 40 ? iconSmall : icon} width={size} height={size} alt="Fight Camp" className={className} draggable={false} style={{ display: 'block', flexShrink: 0 }} />;
}
