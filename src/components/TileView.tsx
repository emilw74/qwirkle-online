import React from 'react';
import { Tile, TileColor, TileShape } from '../game/types';
import { cn } from '../utils/cn';

const COLOR_MAP: Record<TileColor, string> = {
  red: '#e63946',
  orange: '#f77f00',
  yellow: '#fcbf49',
  green: '#2db84d',
  blue: '#3a7bd5',
  purple: '#7b2cbf',
};

const COLOR_BG_MAP: Record<TileColor, string> = {
  red: 'bg-red-500/10 dark:bg-red-500/20',
  orange: 'bg-orange-500/10 dark:bg-orange-500/20',
  yellow: 'bg-yellow-500/10 dark:bg-yellow-500/20',
  green: 'bg-emerald-500/10 dark:bg-emerald-500/20',
  blue: 'bg-blue-500/10 dark:bg-blue-500/20',
  purple: 'bg-purple-500/10 dark:bg-purple-500/20',
};

function ShapeSVG({ shape, color, size }: { shape: TileShape; color: string; size: number }) {
  const s = size * 0.65;
  const cx = size / 2;
  const cy = size / 2;

  switch (shape) {
    case 'circle':
      return <circle cx={cx} cy={cy} r={s * 0.4} fill={color} />;
    case 'diamond':
      return (
        <polygon
          points={`${cx},${cy - s * 0.45} ${cx + s * 0.4},${cy} ${cx},${cy + s * 0.45} ${cx - s * 0.4},${cy}`}
          fill={color}
        />
      );
    case 'square':
      return (
        <rect
          x={cx - s * 0.33}
          y={cy - s * 0.33}
          width={s * 0.66}
          height={s * 0.66}
          fill={color}
          rx={2}
        />
      );
    case 'star': {
      const points = [];
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8 - Math.PI / 2;
        const r = i % 2 === 0 ? s * 0.42 : s * 0.2;
        points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
      }
      return <polygon points={points.join(' ')} fill={color} />;
    }
    case 'clover': {
      const r = s * 0.16;
      const d = s * 0.2;
      return (
        <g>
          <circle cx={cx} cy={cy - d} r={r} fill={color} />
          <circle cx={cx} cy={cy + d} r={r} fill={color} />
          <circle cx={cx - d} cy={cy} r={r} fill={color} />
          <circle cx={cx + d} cy={cy} r={r} fill={color} />
          <circle cx={cx} cy={cy} r={r * 0.7} fill={color} />
        </g>
      );
    }
    case 'cross':
      return (
        <g>
          <rect x={cx - s * 0.1} y={cy - s * 0.38} width={s * 0.2} height={s * 0.76} fill={color} rx={1.5} />
          <rect x={cx - s * 0.38} y={cy - s * 0.1} width={s * 0.76} height={s * 0.2} fill={color} rx={1.5} />
        </g>
      );
    default:
      return null;
  }
}

interface TileViewProps {
  tile: Tile;
  size?: number;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  showShadow?: boolean;
  style?: React.CSSProperties;
}

export function TileView({
  tile, size = 48, selected, onClick, disabled, className, showShadow = true, style,
}: TileViewProps) {
  const color = COLOR_MAP[tile.color];

  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={cn(
        'relative rounded-lg border-2 flex items-center justify-center transition-all duration-150',
        'bg-white dark:bg-gray-800',
        showShadow && 'shadow-md',
        selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background -translate-y-1',
        !disabled && onClick && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
      style={{
        width: size,
        height: size,
        borderColor: color,
        minWidth: size,
        minHeight: size,
        ...style,
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <ShapeSVG shape={tile.shape} color={color} size={size} />
      </svg>
    </div>
  );
}

interface EmptyTileProps {
  size?: number;
  onClick?: () => void;
  isValid?: boolean;
  className?: string;
}

export function EmptyCell({ size = 48, onClick, isValid, className }: EmptyTileProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-lg border-2 border-dashed flex items-center justify-center transition-all duration-150',
        isValid
          ? 'border-accent/50 bg-accent/10 cursor-pointer hover:bg-accent/20 hover:border-accent'
          : 'border-border/30 bg-muted/20',
        onClick && 'cursor-pointer',
        className,
      )}
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
    >
      {isValid && (
        <div className="w-2 h-2 rounded-full bg-accent/40" />
      )}
    </div>
  );
}

export { COLOR_MAP };
