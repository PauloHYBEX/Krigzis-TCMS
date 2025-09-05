import React from 'react';

type KrigzisLogoProps = {
  size?: number;
  className?: string;
  strokeWidth?: number;
  title?: string;
};

/**
 * KrigzisLogo
 * Ícone "K" com bordas em gradiente dentro de um quadrado com cantos arredondados.
 * Ideal para marca (logo mark). Suporta light/dark de forma neutra via gradiente.
 */
export const KrigzisLogo: React.FC<KrigzisLogoProps> = ({
  size = 28,
  className,
  strokeWidth = 3,
  title = 'Krigzis web'
}) => {
  const id = React.useId();
  const gradId = `krigzis-grad-${id}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#60A5FA"/>{/* blue-400 */}
          <stop offset="60%" stopColor="#8B5CF6"/>{/* violet-500 */}
          <stop offset="100%" stopColor="#F59E0B"/>{/* amber-500 */}
        </linearGradient>
      </defs>

      {/* Borda externa com cantos arredondados */}
      <rect x="4" y="4" width="56" height="56" rx="12" stroke={`url(#${gradId})`} strokeWidth={strokeWidth} />

      {/* Letra K estilizada (traços) */}
      <g stroke={`url(#${gradId})`} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        {/* haste vertical do K */}
        <path d="M20 16 L20 48" />
        {/* perna superior */}
        <path d="M20 32 L44 16" />
        {/* perna inferior */}
        <path d="M20 32 L44 48" />
      </g>
    </svg>
  );
};

export default KrigzisLogo;
