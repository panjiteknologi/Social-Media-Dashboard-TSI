import { asc, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { CurrentUser } from '../../shared/api';
import {
  canMoveToStage,
  CONTENT_PRIORITIES,
  CONTENT_STAGES,
  CONTENT_TYPES,
  STAGE_LABELS,
  type ContentEvent,
  type ContentInput,
  type ContentItem,
  type ContentStage,
  type TeamMember,
} from '../../shared/planner';
import { standardOf } from '../../shared/seo';
import type { Db } from '../db/client';
import { contentEvents, contentItems, users } from '../db/schema';

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .nullable()
    .transform((value) => (value && value.trim() !== '' ? value.trim() : null));

export const ContentInputSchema = z.object({
  title: z.string().trim().min(1, 'Give the content a title.').max(200),
  type: z.enum(CONTENT_TYPES),
  stage: z.enum(CONTENT_STAGES),
  keyword: optionalText(120),
  campaign: optionalText(120),
  priority: z.enum(CONTENT_PRIORITIES),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'The due date must be a date.')
    .nullable(),
  ownerId: z.uuid().nullable(),
  notes: optionalText(5000),
});

/** A content request the planner cannot carry out, with the HTTP status that says why. */
export class ContentError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404,
  ) {
    super(message);
    this.name = 'ContentError';
  }
}

type ItemRow = typeof contentItems.$inferSelect;

const FIELD_LABELS: Record<Exclude<keyof ContentInput, 'stage'>, string> = {
  title: 'title',
  type: 'type',
  keyword: 'keyword',
  campaign: 'campaign',
  priority: 'priority',
  dueDate: 'due date',
  ownerId: 'owner',
  notes: 'notes',
};

/** The fields other than the stage that an edit changes, named for the history. */
export function changedFields(before: ContentInput, after: ContentInput): string[] {
  return (Object.keys(FIELD_LABELS) as Array<keyof typeof FIELD_LABELS>)
    .filter((key) => before[key] !== after[key])
    .map((key) => FIELD_LABELS[key]);
}

const toInput = (row: ItemRow): ContentInput => ({
  title: row.title,
  type: row.type,
  stage: row.stage,
  keyword: row.keyword,
  campaign: row.campaign,
  priority: row.priority,
  dueDate: row.dueDate,
  ownerId: row.ownerId,
  notes: row.notes,
});

const toItem = (row: ItemRow, ownerName: string | null): ContentItem => ({
  id: row.id,
  ...toInput(row),
  cluster: standardOf(row.keyword ?? row.title),
  ownerName,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const withOwner = (db: Db) =>
  db
    .select({ item: contentItems, ownerName: users.name, ownerEmail: users.email })
    .from(contentItems)
    .leftJoin(users, eq(users.id, contentItems.ownerId));

export async function listContent(db: Db): Promise<ContentItem[]> {
  const rows = await withOwner(db).orderBy(asc(contentItems.dueDate), desc(contentItems.updatedAt));
  return rows.map((row) => toItem(row.item, row.ownerName ?? row.ownerEmail ?? null));
}

async function getContent(db: Db, id: string): Promise<ContentItem> {
  const [row] = await withOwner(db).where(eq(contentItems.id, id)).limit(1);
  if (!row) throw new ContentError('Content not found', 404);
  return toItem(row.item, row.ownerName ?? row.ownerEmail ?? null);
}

async function assertOwnerExists(db: Db, ownerId: string | null): Promise<void> {
  if (!ownerId) return;
  const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.id, ownerId)).limit(1);
  if (!owner) throw new ContentError('The owner is not a Content Machine user.', 400);
}

const approverOnly = (stage: ContentStage) =>
  new ContentError(`Only an approver can move content to ${STAGE_LABELS[stage]}.`, 403);

export async function createContent(db: Db, input: ContentInput, user: CurrentUser): Promise<ContentItem> {
  if (!canMoveToStage(user.role, input.stage)) throw approverOnly(input.stage);
  await assertOwnerExists(db, input.ownerId);

  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(contentItems)
      .values({ ...input, createdBy: user.id })
      .returning({ id: contentItems.id });
    await tx.insert(contentEvents).values({ itemId: row.id, kind: 'created', toStage: input.stage, userId: user.id });
    return row.id;
  });
  return getContent(db, id);
}

/** Saves an edit, recording a stage move and the other changed fields in the history. */
export async function updateContent(db: Db, id: string, input: ContentInput, user: CurrentUser): Promise<ContentItem> {
  const [existing] = await db.select().from(contentItems).where(eq(contentItems.id, id)).limit(1);
  if (!existing) throw new ContentError('Content not found', 404);

  const stageChanged = existing.stage !== input.stage;
  if (stageChanged && !canMoveToStage(user.role, input.stage)) throw approverOnly(input.stage);
  if (input.ownerId !== existing.ownerId) await assertOwnerExists(db, input.ownerId);
  const fields = changedFields(toInput(existing), input);

  await db.transaction(async (tx) => {
    await tx
      .update(contentItems)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(contentItems.id, id));
    if (stageChanged) {
      await tx.insert(contentEvents).values({
        itemId: id,
        kind: 'stage_changed',
        fromStage: existing.stage,
        toStage: input.stage,
        userId: user.id,
      });
    }
    if (fields.length > 0) {
      await tx
        .insert(contentEvents)
        .values({ itemId: id, kind: 'edited', note: `Changed ${fields.join(', ')}`, userId: user.id });
    }
  });
  return getContent(db, id);
}

export async function deleteContent(db: Db, id: string): Promise<void> {
  const deleted = await db.delete(contentItems).where(eq(contentItems.id, id)).returning({ id: contentItems.id });
  if (deleted.length === 0) throw new ContentError('Content not found', 404);
}

export async function listContentEvents(db: Db, id: string): Promise<ContentEvent[]> {
  const rows = await db
    .select({ event: contentEvents, userName: users.name, userEmail: users.email })
    .from(contentEvents)
    .leftJoin(users, eq(users.id, contentEvents.userId))
    .where(eq(contentEvents.itemId, id))
    .orderBy(desc(contentEvents.createdAt));
  return rows.map(({ event, userName, userEmail }) => ({
    id: event.id,
    kind: event.kind,
    fromStage: event.fromStage,
    toStage: event.toStage,
    note: event.note,
    userName: userName ?? userEmail ?? null,
    createdAt: event.createdAt.toISOString(),
  }));
}

/** Active users, for choosing an owner. */
export async function listTeam(db: Db): Promise<TeamMember[]> {
  return db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.active, true))
    .orderBy(asc(users.email));
}
