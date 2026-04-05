"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { reorderGroups } from "@/app/actions/portfolio-group";

type GroupItem = {
  id: string;
  title: string;
  coverImageUrl: string | null;
  portfolioCount: number;
  sortOrder: number;
};

function SortableGroup({ group }: { group: GroupItem }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-4 p-4 hover:bg-accent-subtle transition-colors ${
        isDragging ? "opacity-50 bg-accent-subtle" : ""
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-stone-400 hover:text-stone-600 shrink-0 touch-none"
        aria-label={`Reorder ${group.title}`}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="3" r="1.5" />
          <circle cx="11" cy="3" r="1.5" />
          <circle cx="5" cy="8" r="1.5" />
          <circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="13" r="1.5" />
          <circle cx="11" cy="13" r="1.5" />
        </svg>
      </button>

      <Link
        href={`/admin/portfolio-groups/${group.id}`}
        className="flex items-center gap-4 flex-1 min-w-0"
      >
        <div className="w-12 h-12 shrink-0 bg-stone-100 overflow-hidden relative">
          {group.coverImageUrl ? (
            <Image
              src={group.coverImageUrl}
              alt=""
              fill
              sizes="48px"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-stone-300 text-xs">
              —
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{group.title}</p>
          <p className="text-xs text-stone-500 mt-1">
            {group.portfolioCount} portfolio
            {group.portfolioCount !== 1 ? "s" : ""} &middot; Order:{" "}
            {group.sortOrder}
          </p>
        </div>
      </Link>
    </div>
  );
}

export function GroupList({ groups: initialGroups }: { groups: GroupItem[] }) {
  const [groups, setGroups] = useState(initialGroups);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = groups.findIndex((g) => g.id === active.id);
    const newIndex = groups.findIndex((g) => g.id === over.id);

    const reordered = arrayMove(groups, oldIndex, newIndex).map((g, i) => ({
      ...g,
      sortOrder: i,
    }));
    setGroups(reordered);

    const fd = new FormData();
    fd.set(
      "order",
      JSON.stringify(
        reordered.map((g) => ({ id: g.id, sortOrder: g.sortOrder })),
      ),
    );

    try {
      await reorderGroups(fd);
      toast.success("Order saved");
    } catch {
      setGroups(initialGroups);
      toast.error("Failed to save order");
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={groups} strategy={verticalListSortingStrategy}>
        <div className="border border-stone-200 divide-y divide-stone-200">
          {groups.map((group) => (
            <SortableGroup key={group.id} group={group} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
