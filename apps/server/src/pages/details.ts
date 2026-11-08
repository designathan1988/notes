import { enqueueProjection } from '../knowledge/queue.js';
import type { Database } from '../platform/database.js';
import { Access } from '../access/service.js';
import {
  DomainError,
  validateTitle,
  validateAppearance,
  type Actor,
  type PageCover,
  type PageUpdate,
  type PageProperties,
} from '@note/contracts';
import { toPage, type PageRow } from './model.js';
import { changePageProperties } from './properties.js';
import { changeDefaults } from '../templates/defaults.js';

const controls = /[\u0000-\u001f\u007f]/u;
export function validatePresentation(input: {
  icon?: unknown;
  cover?: unknown;
  tags?: unknown;
  appearance?: unknown;
}) {
  const result: Pick<PageUpdate, 'icon' | 'cover' | 'tags' | 'appearance'> = {};
  if (input.appearance !== undefined) result.appearance = validateAppearance(input.appearance);
  if (input.icon !== undefined) {
    if (
      input.icon !== null &&
      (typeof input.icon !== 'string' ||
        input.icon.length > 40 ||
        controls.test(input.icon) ||
        [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(input.icon)].length !== 1)
    )
      throw new DomainError('INVALID', 'Choose one character or emoji for the page icon.');
    result.icon = input.icon as string | null;
  }
  if (input.tags !== undefined) {
    if (
      !Array.isArray(input.tags) ||
      input.tags.length > 50 ||
      input.tags.some(
        (tag) => typeof tag !== 'string' || !tag.trim() || tag.length > 80 || controls.test(tag),
      )
    )
      throw new DomainError('INVALID', 'Use up to 50 tags, each with 1 to 80 characters.');
    result.tags = [
      ...new Set(
        input.tags.map((tag) =>
          (tag as string).trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US'),
        ),
      ),
    ];
  }
  if (input.cover !== undefined) {
    const cover = input.cover as PageCover | null;
    if (cover === null) result.cover = null;
    else if (
      cover &&
      typeof cover === 'object' &&
      !Array.isArray(cover) &&
      cover.type === 'color' &&
      /^#[\da-f]{6}$/iu.test(cover.color)
    )
      result.cover = { type: 'color', color: cover.color.toLowerCase() };
    else if (
      cover &&
      typeof cover === 'object' &&
      !Array.isArray(cover) &&
      cover.type === 'image' &&
      typeof cover.attachmentId === 'string' &&
      /^[\w-]{1,128}$/u.test(cover.attachmentId) &&
      typeof cover.positionY === 'number' &&
      Number.isFinite(cover.positionY) &&
      cover.positionY >= 0 &&
      cover.positionY <= 100
    )
      result.cover = {
        type: 'image',
        attachmentId: cover.attachmentId,
        positionY: cover.positionY,
      };
    else
      throw new DomainError(
        'INVALID',
        'Choose a cover color or a page image with a valid position.',
      );
  }
  return result;
}

/** Page metadata uses one optimistic revision, independent of collaborative body updates. */
export class PageDetails {
  constructor(readonly db: Database) {}
  async update(actor: Actor, id: string, input: PageUpdate & { revision: number }) {
    return this.write(actor, id, input);
  }
  async importProperties(actor: Actor, id: string, properties: PageProperties, revision: number) {
    return this.write(actor, id, { revision }, properties);
  }
  private async write(
    actor: Actor,
    id: string,
    input: PageUpdate & { revision: number },
    imported?: PageProperties,
  ) {
    return this.db.transaction(async (tx) => {
      const page = await new Access(tx).lockPage(actor, id);
      if (page.revision !== input.revision)
        throw new DomainError('CONFLICT', 'The page changed. Reload it before saving again.');
      const title = input.title === undefined ? page.title : validateTitle(input.title),
        description = input.description ?? page.description,
        presentation = validatePresentation(input);
      const properties = await changePageProperties(tx, actor, page, input, imported);
      const defaults = await changeDefaults(tx, actor, page, input.templateDefaults);
      if (
        typeof description !== 'string' ||
        description.length > 2000 ||
        description.includes('\0')
      )
        throw new DomainError('INVALID', 'Use a description up to 2,000 characters.');
      if (presentation.cover?.type === 'image') {
        const ready = await tx.query(
          "SELECT id FROM attachments WHERE id=$1 AND page_id=$2 AND status='ready' AND media_type=ANY($3::text[])",
          [
            presentation.cover.attachmentId,
            id,
            ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
          ],
        );
        if (!ready.length)
          throw new DomainError('INVALID', 'Choose an uploaded image belonging to this page.');
      }
      const [updated] = await tx.query<PageRow>(
        'UPDATE pages SET title=$2,description=$3,icon=$4,cover=$5,tags=$6,page_properties=$8,template_values=$9,appearance=$10,revision=revision+1,index_revision=index_revision+1,updated_at=now() WHERE id=$1 AND revision=$7 RETURNING *',
        [
          id,
          title,
          description,
          presentation.icon === undefined ? (page.icon ?? null) : presentation.icon,
          JSON.stringify(
            presentation.cover === undefined ? (page.cover ?? null) : presentation.cover,
          ),
          presentation.tags ?? page.tags ?? [],
          input.revision,
          JSON.stringify(properties),
          JSON.stringify(defaults),
          JSON.stringify(presentation.appearance ?? page.appearance ?? {}),
        ],
      );
      await enqueueProjection(tx, [id]);
      return toPage({
        ...updated,
        private_owner_id: page.accessOwnerId,
        visibility: page.visibility,
      });
    });
  }
}
