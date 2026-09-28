'use client';

import { GripVerticalIcon } from 'lucide-react';
import {
  Group,
  Panel,
  Separator,
  type GroupProps,
  type PanelProps,
  type SeparatorProps,
} from 'react-resizable-panels';

import { cn } from '@/lib/utils';

function ResizablePanelGroup({
  className,
  orientation = 'horizontal',
  ...props
}: GroupProps) {
  return (
    <Group
      data-slot="resizable-panel-group"
      data-panel-group-direction={orientation}
      orientation={orientation}
      className={cn(
        'flex h-full w-full data-[panel-group-direction=vertical]:flex-col',
        className,
      )}
      {...props}
    />
  );
}

function ResizablePanel({ ...props }: PanelProps) {
  return <Panel data-slot="resizable-panel" {...props} />;
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: SeparatorProps & {
  withHandle?: boolean;
}) {
  return (
    <Separator
      data-slot="resizable-handle"
      className={cn(
        'bg-border focus-visible:ring-ring relative flex w-4 hover:w-5 items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden data-[panel-group-direction=vertical]:h-4 data-[panel-group-direction=vertical]:hover:h-5 data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:translate-x-0 data-[panel-group-direction=vertical]:after:-translate-y-1/2 [&[data-panel-group-direction=vertical]>div]:rotate-90 transition-all duration-150 cursor-col-resize hover:bg-accent data-[panel-group-direction=vertical]:cursor-row-resize',
        className,
      )}
      {...props}
    >
      {withHandle && (
        <div className="bg-muted-foreground/45 hover:bg-muted-foreground/70 z-10 flex h-8 w-3 items-center justify-center rounded-md transition-colors">
          <GripVerticalIcon className="size-3" />
        </div>
      )}
    </Separator>
  );
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
