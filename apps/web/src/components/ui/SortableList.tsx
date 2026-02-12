"use client";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DragHandle } from "./DragHandle";

// ============================================================
// Types
// ============================================================

type SortableListProps<T> = {
  items: T[];
  keyExtractor: (item: T) => string;
  renderItem: (
    item: T,
    index: number,
    dragHandleProps: React.HTMLAttributes<HTMLButtonElement>,
  ) => React.ReactNode;
  onReorder: (items: T[]) => void;
  className?: string;
};

type SortableItemProps = {
  id: string;
  children: (
    dragHandleProps: React.HTMLAttributes<HTMLButtonElement>,
  ) => React.ReactNode;
};

// ============================================================
// SortableItem
// ============================================================

function SortableItem({ id, children }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
    position: "relative" as const,
  };

  const dragHandleProps = {
    ...attributes,
    ...listeners,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children(dragHandleProps)}
    </div>
  );
}

// ============================================================
// SortableList
// ============================================================

export function SortableList<T>({
  items,
  keyExtractor,
  renderItem,
  onReorder,
  className = "",
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const ids = items.map(keyExtractor);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    const reordered = arrayMove(items, oldIndex, newIndex);
    onReorder(reordered);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {items.map((item, index) => {
            const id = keyExtractor(item);
            return (
              <SortableItem key={id} id={id}>
                {(dragHandleProps) => renderItem(item, index, dragHandleProps)}
              </SortableItem>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}

export { DragHandle };
