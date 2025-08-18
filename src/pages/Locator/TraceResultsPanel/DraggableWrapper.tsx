import React, { useEffect, useState } from 'react';
import { DndContext, useDraggable, useSensor, useSensors, PointerSensor, closestCenter } from '@dnd-kit/core';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';
import DraggableHeader from './DraggableHeader';

const PANEL_WIDTH_MARGIN = 600;
const PANEL_HEIGHT_MARGIN = 460;

interface Position {
  x: number;
  y: number;
}

interface DraggableWrapperProps {
  children: React.ReactNode;
  onPositionChange?: (position: Position) => void;
  initialPosition?: Position;
  containerRef?: React.RefObject<HTMLElement>;
  containerSelector?: string;
}

const DraggableWrapper: React.FC<DraggableWrapperProps> = ({
  children,
  onPositionChange,
  initialPosition = { x: 100, y: 230 },
  containerRef,
  containerSelector
}) => {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [containerBounds, setContainerBounds] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
    left: 0,
    top: 0,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  useEffect(() => {
    const updateBounds = () => {
      let bounds = {
        width: window.innerWidth,
        height: window.innerHeight,
        left: 0,
        top: 0,
      };

      // 优先使用 containerRef
      if (containerRef?.current) {
        const rect = containerRef.current.getBoundingClientRect();
        bounds = {
          width: rect.width,
          height: rect.height,
          left: rect.left,
          top: rect.top,
        };
      }
      // 其次使用 containerSelector
      else if (containerSelector) {
        const container = document.querySelector(containerSelector);
        if (container) {
          const rect = container.getBoundingClientRect();
          bounds = {
            width: rect.width,
            height: rect.height,
            left: rect.left,
            top: rect.top,
          };
        }
      }

      setContainerBounds(bounds);

      // 更新位置以确保面板在容器内
      setPosition((prev) => ({
        x: Math.max(0, Math.min(prev.x, bounds.width - PANEL_WIDTH_MARGIN)),
        y: Math.max(0, Math.min(prev.y, bounds.height - PANEL_HEIGHT_MARGIN)),
      }));
    };

    updateBounds();
    window.addEventListener('resize', updateBounds);
    return () => window.removeEventListener('resize', updateBounds);
  }, [containerRef, containerSelector]);

  const handleDragStart = () => setIsDragging(true);

  const handleDragEnd = ({ delta }: any) => {
    const newX = position.x + delta.x;
    const newY = position.y + delta.y;

    // 限制在容器边界内
    const clampedX = Math.max(0, Math.min(newX, containerBounds.width - PANEL_WIDTH_MARGIN));
    const clampedY = Math.max(0, Math.min(newY, containerBounds.height - PANEL_HEIGHT_MARGIN));

    const newPosition = { x: clampedX, y: clampedY };
    setPosition(newPosition);
    onPositionChange?.(newPosition);

    setTimeout(() => setIsDragging(false), 0);
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
      <DraggableItem
        position={position}
        isDragging={isDragging}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        containerBounds={containerBounds}
      >
        {!isCollapsed && children}
      </DraggableItem>
    </DndContext>
  );
};

interface DraggableItemProps {
  children: React.ReactNode;
  position: Position;
  isDragging: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  containerBounds: {
    width: number;
    height: number;
    left: number;
    top: number;
  };
}

const DraggableItem: React.FC<DraggableItemProps> = ({
  children,
  position,
  isDragging,
  isCollapsed,
  onToggleCollapse,
  containerBounds
}) => {
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';
  const { attributes, listeners, setNodeRef, transform, isDragging: dndIsDragging } = useDraggable({ id: 'trace-panel' });

  const style = {
    position: 'absolute' as const,
    left: containerBounds.left + position.x,
    top: containerBounds.top + position.y,
    zIndex: 10,
    transform: (isDragging || dndIsDragging) && transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : 'translate3d(0, 0, 0)',
    transition: isDragging || dndIsDragging ? 'none' : 'transform 0.2s ease-out',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={classNames(
        'w-[600px] rounded-lg shadow-2xl border overflow-hidden flex flex-col backdrop-blur-md',
        {
          'h-auto': isCollapsed,
          'max-h-[460px]': !isCollapsed,
          'shadow-3xl scale-[1.02]': isDragging || dndIsDragging,
          'hover:shadow-2xl': !(isDragging || dndIsDragging)
        },
        isDark
          ? 'bg-gray-800/90 border-gray-600/20' + (isDragging || dndIsDragging ? ' bg-gray-800/95' : '')
          : 'bg-blue-900/90 border-white/20' + (isDragging || dndIsDragging ? ' bg-blue-900/95' : '')
      )}
    >
      <DraggableHeader
        isCollapsed={isCollapsed}
        onToggleCollapse={onToggleCollapse}
        listeners={listeners}
        attributes={attributes}
      />
      {children}
    </div>
  );
};

export default DraggableWrapper;