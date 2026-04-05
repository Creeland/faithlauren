"use client";

import { useState } from "react";
import Image from "next/image";
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
import {
  assignPortfolioToGroup,
  removePortfolioFromGroup,
} from "@/app/actions/portfolio-group";
import { reorderPortfolios } from "@/app/actions/portfolio";

type PortfolioItem = {
  id: string;
  title: string;
  coverPhotoUrl: string | null;
  photoCount: number;
  sortOrder: number;
};

function SortablePortfolio({
  portfolio,
  groupId,
  onRemoved,
}: {
  portfolio: PortfolioItem;
  groupId: string;
  onRemoved: (id: string) => void;
}) {
  const [removing, setRemoving] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: portfolio.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  async function handleRemove() {
    setRemoving(true);
    try {
      const fd = new FormData();
      fd.set("portfolioId", portfolio.id);
      await removePortfolioFromGroup(fd);
      onRemoved(portfolio.id);
      toast.success(`Removed "${portfolio.title}" from group`);
    } catch {
      toast.error("Failed to remove portfolio");
      setRemoving(false);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 hover:bg-accent-subtle transition-colors ${
        isDragging ? "opacity-50 bg-accent-subtle" : ""
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-stone-400 hover:text-stone-600 shrink-0 touch-none"
        aria-label={`Reorder ${portfolio.title}`}
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

      <div className="w-10 h-10 shrink-0 bg-stone-100 overflow-hidden relative">
        {portfolio.coverPhotoUrl ? (
          <Image
            src={portfolio.coverPhotoUrl}
            alt=""
            fill
            sizes="40px"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-300 text-xs">
            —
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{portfolio.title}</p>
        <p className="text-xs text-stone-500">
          {portfolio.photoCount} photo{portfolio.photoCount !== 1 ? "s" : ""}
        </p>
      </div>

      <button
        type="button"
        onClick={handleRemove}
        disabled={removing}
        className="text-xs text-stone-400 hover:text-red-600 transition-colors disabled:opacity-50 shrink-0"
      >
        {removing ? "Removing..." : "Remove"}
      </button>
    </div>
  );
}

export function GroupPortfolios({
  groupId,
  portfolios: initialPortfolios,
  ungroupedPortfolios: initialUngrouped,
}: {
  groupId: string;
  portfolios: PortfolioItem[];
  ungroupedPortfolios: PortfolioItem[];
}) {
  const [portfolios, setPortfolios] = useState(initialPortfolios);
  const [ungrouped, setUngrouped] = useState(initialUngrouped);
  const [adding, setAdding] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = portfolios.findIndex((p) => p.id === active.id);
    const newIndex = portfolios.findIndex((p) => p.id === over.id);

    const reordered = arrayMove(portfolios, oldIndex, newIndex).map((p, i) => ({
      ...p,
      sortOrder: i,
    }));
    setPortfolios(reordered);

    const fd = new FormData();
    fd.set(
      "order",
      JSON.stringify(
        reordered.map((p) => ({ id: p.id, sortOrder: p.sortOrder })),
      ),
    );

    try {
      await reorderPortfolios(fd);
      toast.success("Order saved");
    } catch {
      setPortfolios(initialPortfolios);
      toast.error("Failed to save order");
    }
  }

  function handleRemoved(id: string) {
    const removed = portfolios.find((p) => p.id === id);
    setPortfolios((prev) => prev.filter((p) => p.id !== id));
    if (removed) {
      setUngrouped((prev) =>
        [...prev, removed].sort((a, b) => a.title.localeCompare(b.title)),
      );
    }
  }

  async function handleAdd(portfolioId: string) {
    const portfolio = ungrouped.find((p) => p.id === portfolioId);
    if (!portfolio) return;

    setAdding(true);
    try {
      const fd = new FormData();
      fd.set("portfolioId", portfolioId);
      fd.set("groupId", groupId);
      await assignPortfolioToGroup(fd);

      setUngrouped((prev) => prev.filter((p) => p.id !== portfolioId));
      setPortfolios((prev) => [
        ...prev,
        { ...portfolio, sortOrder: prev.length },
      ]);
      toast.success(`Added "${portfolio.title}" to group`);
    } catch {
      toast.error("Failed to add portfolio");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-4">
      {portfolios.length === 0 ? (
        <p className="text-sm text-stone-500">
          No portfolios in this group yet.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={portfolios}
            strategy={verticalListSortingStrategy}
          >
            <div className="border border-stone-200 divide-y divide-stone-200">
              {portfolios.map((portfolio) => (
                <SortablePortfolio
                  key={portfolio.id}
                  portfolio={portfolio}
                  groupId={groupId}
                  onRemoved={handleRemoved}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {ungrouped.length > 0 && (
        <div>
          <label
            htmlFor="add-portfolio"
            className="block text-sm text-stone-600 mb-1.5"
          >
            Add portfolio
          </label>
          <div className="flex gap-2">
            <select
              id="add-portfolio"
              disabled={adding}
              className="flex-1 border border-stone-300 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-background focus:border-accent"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  handleAdd(e.target.value);
                  e.target.value = "";
                }
              }}
            >
              <option value="" disabled>
                Select a portfolio...
              </option>
              {ungrouped.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.photoCount} photo
                  {p.photoCount !== 1 ? "s" : ""})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
