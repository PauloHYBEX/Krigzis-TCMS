import { Button } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react';
import { ReactNode, forwardRef, ButtonHTMLAttributes } from 'react';

interface StandardButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  icon?: LucideIcon;
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  /** Quando true, renderiza o botão apenas com ícone, ocultando o label visual. */
  iconOnly?: boolean;
  /** Rótulo acessível para leitores de tela e tooltips externos. */
  ariaLabel?: string;
  /** Quando true, reduz a altura mínima para um botão mais compacto (lista). */
  compact?: boolean;
}

export const StandardButton = forwardRef<HTMLButtonElement, StandardButtonProps>(({ 
  children, 
  onClick, 
  variant = 'default', 
  size = 'default',
  icon: Icon,
  disabled = false,
  loading = false,
  type = 'button',
  className = '',
  iconOnly = false,
  ariaLabel,
  compact = false,
  ...rest
}, ref) => {
  const resolvedSize = iconOnly ? 'icon' : size;
  const showLabel = !iconOnly;
  const computedAriaLabel = ariaLabel || (typeof children === 'string' ? children : undefined);

  return (
    <Button
      ref={ref}
      onClick={onClick}
      variant={variant}
      size={resolvedSize}
      disabled={disabled || loading}
      type={type}
      aria-label={computedAriaLabel}
      className={`${compact ? 'min-h-[32px]' : 'min-h-[40px]'} font-medium transition-all duration-200 ${className}`}
      {...rest}
    >
      {loading ? (
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
      ) : Icon ? (
        <Icon className={`h-4 w-4 ${showLabel && children ? 'mr-2' : ''}`} />
      ) : null}
      {showLabel ? children : null}
    </Button>
  );
});

StandardButton.displayName = 'StandardButton';
