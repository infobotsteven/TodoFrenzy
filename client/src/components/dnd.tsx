import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  type SortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { t } from '../i18n';

/**
 * Element zajmuje miejsce tej karty, nad którą jest kursor. Domyślne closestCenter porównuje środki kart, a przy
 * wysokich listach środek jest daleko od kursora, więc upuszczenie lądowało gdzie indziej, niż wskazywała ręka.
 * Gdy kursor jest w odstępie między kartami (albo przy sterowaniu klawiaturą) wracamy do closestCenter.
 */
const collisionDetection: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args);
  return underPointer.length > 0 ? underPointer : closestCenter(args);
};

const FLIP_MS = 240;

/**
 * Wykonuje `update` (zmianę kolejności) i płynnie dosuwa pozostałe elementy z ich ostatniej widocznej pozycji
 * do nowej (FLIP). W siatce o nierównych wysokościach układ po zmianie kolejności przelicza się inaczej, niż
 * zakładały przesunięcia z czasu przeciągania, więc bez tego sąsiednie karty przeskakiwałyby w jednej klatce.
 */
function flipSiblings(ids: string[], skipId: string, update: () => void) {
  const find = (id: string) => document.querySelector<HTMLElement>(`[data-sortable-id="${id}"]`);
  const siblings = ids.filter((id) => id !== skipId);
  const before = new Map<string, DOMRect>();
  for (const id of siblings) {
    const el = find(id);
    if (el) before.set(id, el.getBoundingClientRect());
  }

  update();

  for (const id of siblings) {
    // po zmianie kolejności karta mogła trafić do innej kolumny - wtedy React podstawia nowy element, więc szukamy go od nowa
    const el = find(id);
    const from = before.get(id);
    if (!el || !from) continue;
    const to = el.getBoundingClientRect();
    const dx = from.left - to.left;
    const dy = from.top - to.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
    el.style.transition = 'none';
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    el.getBoundingClientRect(); // wymusza przeliczenie stylów, żeby animacja ruszyła od pozycji startowej
    el.style.transition = `transform ${FLIP_MS}ms ease`;
    el.style.transform = '';
    setTimeout(() => {
      el.style.transition = '';
    }, FLIP_MS + 50);
  }
}
type SortableListProps = {
  ids: string[];
  strategy: SortingStrategy;
  /** Wywoływane po upuszczeniu z pełną listą id w nowej kolejności. */
  onReorder: (ids: string[]) => void;
  /**
   * Wygląd elementu "w ręku" podczas przeciągania. Jest to osobna warstwa (DragOverlay), która po upuszczeniu
   * płynnie dojeżdża do nowego miejsca - bez niej element przeskakiwałby w jednej klatce.
   */
  renderOverlay: (id: string) => ReactNode;
  children: ReactNode;
};

/** Kontekst przeciągania dla jednej grupy rodzeństwa (projekty / listy / zadania). */
export function SortableList({ ids, strategy, onReorder, renderOverlay, children }: SortableListProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    // Przeciąganie startuje dopiero po kilku pikselach ruchu, żeby zwykłe kliknięcie nie było drag'iem
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragStart = ({ active }: DragStartEvent) => setActiveId(String(active.id));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    // Nowa kolejność i koniec przeciągania muszą trafić do JEDNEGO renderu - inaczej warstwa "w ręku"
    // dojedzie do starego miejsca, a element dopiero potem pojawi się w nowym.
    flipSiblings(ids, String(active.id), () =>
      flushSync(() => {
        if (over && active.id !== over.id) {
          const from = ids.indexOf(String(active.id));
          const to = ids.indexOf(String(over.id));
          if (from >= 0 && to >= 0) onReorder(arrayMove(ids, from, to));
        }
        setActiveId(null);
      }),
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={ids} strategy={strategy}>
        {children}
      </SortableContext>
      <DragOverlay>{activeId ? renderOverlay(activeId) : null}</DragOverlay>
    </DndContext>
  );
}

type SortableItemProps = {
  id: string;
  as?: 'div' | 'li' | 'section';
  className?: string;
  /** Gdy true, element nie ma uchwytu (np. przy aktywnym filtrowaniu). */
  disabled?: boolean;
  /** Kolor elementu (atrybut data-color, z którego CSS bierze --accent). */
  color?: string | null;
  /** Dostaje gotowy uchwyt do przeciągania - element decyduje, gdzie go wstawić. */
  children: (handle: ReactNode) => ReactNode;
};

export function SortableItem({ id, as = 'div', className = '', disabled, color, children }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
    // Po upuszczeniu kolejność zmienia się w DOM, a przesunięcia (transform) znikają w tej samej klatce, więc
    // elementy już stoją na swoich miejscach. Wbudowana animacja układu liczyłaby przesunięcie drugi raz
    // i elementy startowałyby ~1 slot od celu, a potem "wskakiwały" na miejsce. Płynność zapewnia DragOverlay.
    animateLayoutChanges: () => false,
  });
  const Tag = as as 'div';

  const handle = disabled ? null : (
    <button
      type="button"
      ref={setActivatorNodeRef}
      className="drag-handle"
      aria-label={t('dnd.handle')}
      {...attributes}
      {...listeners}
    >
      ⋮⋮
    </button>
  );

  return (
    <Tag
      ref={setNodeRef}
      data-sortable-id={id}
      data-color={color ?? undefined}
      // oryginał zostaje w liście jako półprzezroczysty "cień" pokazujący, gdzie wyląduje element
      className={isDragging ? `${className} drag-source` : className}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      {children(handle)}
    </Tag>
  );
}



