import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { X, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SortableImageProps {
  id: string;
  url: string;
  index: number;
  onRemove: () => void;
}

export function SortableImage({ id, url, index, onRemove }: SortableImageProps) {
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
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group",
        isDragging && "z-50 opacity-80"
      )}
    >
      <div className={cn(
        "relative rounded-lg overflow-hidden border-2 transition-all",
        isDragging ? "border-primary shadow-lg" : "border-border"
      )}>
        <img
          src={url}
          alt={`Product image ${index + 1}`}
          className="w-full h-20 object-cover"
        />
        
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="absolute top-1 left-1 p-1 rounded bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-3 w-3 text-foreground" />
        </button>

        {/* Remove button */}
        <button
          type="button"
          onClick={onRemove}
          className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
        >
          <X className="h-3 w-3" />
        </button>

        {/* Main badge */}
        {index === 0 && (
          <span className="absolute bottom-1 left-1 text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
            Main
          </span>
        )}
      </div>
    </div>
  );
}