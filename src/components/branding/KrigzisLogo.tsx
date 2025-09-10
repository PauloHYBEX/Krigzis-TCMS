import React from 'react';
import appIcon from '../../../assets/icon.svg';

type KrigzisLogoProps = {
  size?: number;
  className?: string;
  strokeWidth?: number; // mantido por compatibilidade, não é utilizado com <img>
  title?: string;
};

/**
 * KrigzisLogo
 * Agora utiliza o arquivo de ícone do diretório `assets/` para unificar a identidade visual
 * com o sistema desktop TO-DO. Mantém a mesma API (props).
 */
export const KrigzisLogo: React.FC<KrigzisLogoProps> = ({
  size = 28,
  className,
  // strokeWidth é ignorado com <img>, mantido apenas para compatibilidade
  title = 'Krigzis TCMS'
}) => {
  return (
    <img
      src={appIcon}
      width={size}
      height={size}
      alt={title}
      className={className}
      loading="lazy"
    />
  );
};

export default KrigzisLogo;
