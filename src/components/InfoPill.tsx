import React from 'react';

export type InfoPillProps = {
  icon: React.ComponentType<{ className?: string }>;
  value: number | string;
  title?: string;
  variant?: 'default' | 'attention';
  className?: string;
};

/**
 * Pequeno componente de pílula com ícone + valor, usado em cards/tabelas para contagens.
 * Mantém o estilo utilitário atual e permite realce quando houver atenção.
 */
export const InfoPill: React.FC<InfoPillProps> = ({ icon: Icon, value, title, variant = 'default', className }) => {
  const base = 'inline-flex items-center gap-1 h-5 px-1.5 rounded-sm text-[11px] font-medium min-w-[52px] justify-center transition-colors border';
  const tone = variant === 'attention'
    ? 'bg-muted/60 border-border/60 text-foreground/90'
    : 'bg-muted/60 border-border/40 text-foreground/80';

  return (
    <span className={[base, tone, className].filter(Boolean).join(' ')} title={title}>
      <Icon className={`h-3 w-3 ${Number(value) > 0 ? 'opacity-90' : 'opacity-50'}`} />
      <span className="font-mono">{value}</span>
    </span>
  );
};

export default InfoPill;
