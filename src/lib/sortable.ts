import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const orderSchema = z.array(
  z.object({
    id: z.string(),
    sortOrder: z.number().int(),
  }),
);

type Reorderable = {
  update(args: {
    where: { id: string };
    data: { sortOrder: number };
  }): Prisma.PrismaPromise<unknown>;
};

/**
 * Persist a drag-and-drop ordering submitted from a form. Parses and
 * validates the "order" field, then applies every position atomically —
 * either the whole new order lands or none of it does.
 */
export async function persistOrder(delegate: Reorderable, formData: FormData) {
  const order = orderSchema.parse(JSON.parse(formData.get("order") as string));

  await prisma.$transaction(
    order.map((item) =>
      delegate.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder },
      }),
    ),
  );
}
