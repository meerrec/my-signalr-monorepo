import { cn, getInitials } from '../../lib';
import styles from './Avatar.module.css';

export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps {
  name: string;
  size?: AvatarSize | undefined;
  className?: string | undefined;
}

function getNameHue(name: string): number {
  let hash = 0;

  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 360;
  }

  return hash;
}

export function Avatar({ name, size = 'md', className }: AvatarProps) {
  const hue = getNameHue(name);
  const accessibleName = name.trim().length > 0 ? name : 'Пользователь';

  return (
    <span
      className={cn(styles.avatar, styles[size], className)}
      role="img"
      aria-label={accessibleName}
      style={{
        backgroundColor: `hsl(${hue} 55% 30%)`,
        borderColor: `hsl(${hue} 60% 52% / 0.45)`,
        color: `hsl(${hue} 85% 92%)`,
      }}
    >
      {getInitials(name)}
    </span>
  );
}
