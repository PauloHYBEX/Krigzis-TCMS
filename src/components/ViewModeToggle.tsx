
import { Grid, List } from 'lucide-react';
import { StandardButton } from './StandardButton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ViewModeToggleProps {
  viewMode: 'cards' | 'list';
  onViewModeChange: (mode: 'cards' | 'list') => void;
}

export const ViewModeToggle = ({ viewMode, onViewModeChange }: ViewModeToggleProps) => {
  return (
    <TooltipProvider>
      <div className="flex border rounded-md">
        <Tooltip>
          <TooltipTrigger asChild>
            <StandardButton
              variant={viewMode === 'cards' ? 'default' : 'outline'}
              size="sm"
              icon={Grid}
              onClick={() => onViewModeChange('cards')}
              className="rounded-r-none border-r-0"
            />
          </TooltipTrigger>
          <TooltipContent>
            <p>Visualização em Cards</p>
          </TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <StandardButton
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              icon={List}
              onClick={() => onViewModeChange('list')}
              className="rounded-l-none"
            />
          </TooltipTrigger>
          <TooltipContent>
            <p>Visualização em Lista</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};
