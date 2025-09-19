import React from 'react';

export type InfoPillProps = {
  icon: React.ComponentType<{ className?: string }>;
  value: number | string;
  title?: string;
  variant?: 'default' | 'attention';
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  ariaLabel?: string;
};

/**
 * Pequeno componente de pílula com ícone + valor, usado em cards/tabelas para contagens.
 * Mantém o estilo utilitário atual e permite realce quando houver atenção.
 */
export const InfoPill: React.FC<InfoPillProps> = ({ icon: Icon, value, title, variant = 'default', className, onClick, disabled, ariaLabel }) => {
  // Ultra-compacto: sem borda/fundo, apenas ícone+valor, altura mínima.
  const base = 'inline-flex items-center gap-0.5 h-3 px-0 rounded-sm text-[10px] font-medium justify-center whitespace-nowrap';
  const tone = variant === 'attention'
    ? 'text-foreground/90'
    : 'text-foreground/80';
  const interactivity = onClick && !disabled ? 'cursor-pointer hover:opacity-90 focus:outline-none focus:ring-1 focus:ring-border/50 rounded-xs' : disabled ? 'opacity-50 pointer-events-none' : '';

  return (
    <span
      role={onClick ? 'button' : undefined}
      tabIndex={onClick && !disabled ? 0 : -1}
      aria-label={ariaLabel}
      onClick={onClick && !disabled ? onClick : undefined}
      onKeyDown={(e) => {
        if (!onClick || disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={[base, tone, interactivity, className].filter(Boolean).join(' ')} title={title}
    >
      <Icon className={`h-3 w-3 ${Number(value) > 0 ? 'opacity-90' : 'opacity-50'}`} />
      <span className="font-mono">{value}</span>
    </span>
  );
};

export default InfoPill;
