import { useRef, useState } from 'react';
import { Image, Smile, Tag, X, MoreHorizontal, SlidersHorizontal } from 'lucide-react';
import type { Page, PageUpdate } from '@note/contracts';
import { useWorkspace } from '../state/store.js';
import { Popover } from '../ui/Popover.js';
import { uploadFile } from '../documents/capture.js';

const icons = [
  ['🧭', 'Compass'],
  ['📚', 'Books'],
  ['💡', 'Idea'],
  ['🔬', 'Research'],
  ['🌱', 'Seedling'],
  ['✍️', 'Writing'],
  ['🎯', 'Target'],
  ['🗂️', 'Files'],
  ['🚀', 'Rocket'],
  ['🔖', 'Bookmark'],
  ['🎨', 'Palette'],
  ['🔒', 'Lock'],
];
const colors = [
  ['#e9e4db', 'Sand'],
  ['#dde5e0', 'Sage'],
  ['#e0e5ec', 'Slate'],
  ['#e8dfde', 'Clay'],
  ['#e5e0ea', 'Lavender'],
  ['#d6dedf', 'Mist'],
];

export function PagePresentation({
  page,
  readOnly,
  showProperties,
  showDescription,
}: {
  page: Page;
  readOnly: boolean;
  showProperties?: () => void;
  showDescription?: () => void;
}) {
  const [menu, setMenu] = useState<'appearance' | 'icon' | 'cover' | null>(null),
    [anchor, setAnchor] = useState<HTMLElement | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [position, setPosition] = useState<{ value: number; revision: number } | null>(null);
  const dragging = useRef<{ y: number; position: number } | null>(null);
  const save = async (patch: PageUpdate, revision?: number) => {
    setBusy(true);
    setError('');
    try {
      await useWorkspace.getState().updatePage(page.id, patch, revision);
      setMenu(null);
      setPosition(null);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const cover = page.cover;
  return (
    <>
      {cover && (
        <div
          className={`page-cover ${position ? 'repositioning' : ''}`}
          style={cover.type === 'color' ? { backgroundColor: cover.color } : undefined}
          onPointerDown={(event) => {
            if (!position || busy || (event.target as HTMLElement).closest('button,input,label'))
              return;
            event.currentTarget.setPointerCapture(event.pointerId);
            dragging.current = { y: event.clientY, position: position.value };
          }}
          onPointerMove={(event) => {
            if (!dragging.current) return;
            const value = Math.max(
              0,
              Math.min(
                100,
                dragging.current.position -
                  ((event.clientY - dragging.current.y) / event.currentTarget.clientHeight) * 100,
              ),
            );
            setPosition((current) => (current ? { ...current, value } : null));
          }}
          onPointerUp={() => {
            dragging.current = null;
          }}
          onPointerCancel={() => {
            dragging.current = null;
          }}
        >
          {cover.type === 'image' && (
            <img
              src={`/api/attachments/${cover.attachmentId}/content`}
              alt="Page cover"
              draggable={false}
              style={{ objectPosition: `50% ${position?.value ?? cover.positionY}%` }}
            />
          )}
          {!readOnly && (
            <div className="page-cover-actions">
              {position && cover.type === 'image' ? (
                <>
                  <span>Drag image to reposition</span>
                  <input
                    type="range"
                    aria-label="Cover vertical position"
                    min={0}
                    max={100}
                    value={position.value}
                    onChange={(event) =>
                      setPosition({ ...position, value: Number(event.target.value) })
                    }
                  />
                  <button
                    disabled={busy}
                    onClick={() =>
                      void save(
                        { cover: { ...cover, positionY: position.value } },
                        position.revision,
                      )
                    }
                  >
                    Save cover position
                  </button>
                  <button disabled={busy} onClick={() => setPosition(null)}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    disabled={busy}
                    onClick={(event) => {
                      setAnchor(event.currentTarget);
                      setMenu('cover');
                    }}
                  >
                    Change cover
                  </button>
                  {cover.type === 'image' && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        setPosition({ value: cover.positionY, revision: page.revision })
                      }
                    >
                      Reposition cover
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
      {!readOnly && (
        <div className="page-presentation-tools">
          <button
            className="page-customize-trigger icon-button"
            aria-label="Customize page"
            title="Customize page"
            aria-haspopup="menu"
            disabled={busy}
            onClick={(event) => {
              setAnchor(event.currentTarget);
              setMenu('appearance');
            }}
          >
            <MoreHorizontal size={18} />
          </button>
        </div>
      )}
      {menu && (
        <Popover
          key={menu}
          anchor={anchor}
          label={
            menu === 'appearance'
              ? 'Customize page'
              : menu === 'icon'
                ? 'Choose page icon'
                : 'Choose page cover'
          }
          close={() => !busy && setMenu(null)}
        >
          {menu === 'appearance' ? (
            <div className="menu-list">
              <button
                onClick={() => {
                  setMenu(null);
                  useWorkspace.getState().openAppearance('page');
                }}
              >
                <SlidersHorizontal />
                Fonts and style
              </button>
              {showDescription && (
                <button
                  onClick={() => {
                    setMenu(null);
                    showDescription();
                  }}
                >
                  <Tag />
                  {page.description ? 'Edit description' : 'Add description'}
                </button>
              )}
              <button onClick={() => setMenu('icon')}>
                <Smile />
                {page.icon ? 'Change icon' : 'Add icon'}
              </button>
              <button onClick={() => setMenu('cover')}>
                <Image />
                {cover ? 'Change cover' : 'Add cover'}
              </button>
              {showProperties && (
                <button
                  onClick={() => {
                    setMenu(null);
                    showProperties();
                  }}
                >
                  <SlidersHorizontal />
                  Page properties
                </button>
              )}
            </div>
          ) : (
            <div className="presentation-picker">
              <p className="block-menu-caption">
                {menu === 'icon' ? 'Make it recognizable' : 'Give this page a cover'}
              </p>
              {menu === 'icon' ? (
                <>
                  <div className="page-emoji-grid">
                    {icons.map(([icon, name]) => (
                      <button
                        key={name}
                        aria-label={name}
                        disabled={busy}
                        onClick={() => void save({ icon })}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                  <label className="page-custom-icon">
                    Your icon
                    <input
                      aria-label="Custom page icon"
                      maxLength={40}
                      placeholder="Any emoji or character"
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void save({ icon: event.currentTarget.value });
                        }
                      }}
                    />
                  </label>
                  {page.icon && (
                    <button disabled={busy} onClick={() => void save({ icon: null })}>
                      Remove icon
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div className="page-color-grid">
                    {colors.map(([color, name]) => (
                      <button
                        key={name}
                        aria-label={name}
                        disabled={busy}
                        style={{ backgroundColor: color }}
                        onClick={() => void save({ cover: { type: 'color', color } })}
                      />
                    ))}
                  </div>
                  <label className="cover-upload">
                    Upload image
                    <input
                      aria-label="Upload cover image"
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/webp"
                      disabled={busy}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        const revision = page.revision;
                        setBusy(true);
                        setError('');
                        void uploadFile(page.id, file)
                          .then((image) =>
                            useWorkspace
                              .getState()
                              .updatePage(
                                page.id,
                                { cover: { type: 'image', attachmentId: image.id, positionY: 50 } },
                                revision,
                              ),
                          )
                          .then(() => setMenu(null))
                          .catch((failure) => setError(failure.message))
                          .finally(() => setBusy(false));
                      }}
                    />
                  </label>
                  {cover && (
                    <button disabled={busy} onClick={() => void save({ cover: null })}>
                      Remove cover
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </Popover>
      )}
      {error && (
        <p className="activity-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

export function PageTags({ page, readOnly }: { page: Page; readOnly: boolean }) {
  const [editing, setEditing] = useState<number | null>(null),
    [draft, setDraft] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function save(tags: string[], revision: number) {
    setBusy(true);
    setError('');
    try {
      await useWorkspace.getState().updatePage(page.id, { tags }, revision);
      setEditing(null);
      setDraft('');
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-tags">
      {(page.tags ?? []).map((tag) => (
        <span className="page-tag" key={tag}>
          <button
            aria-label={`Search tag ${tag}`}
            onClick={() => useWorkspace.getState().openTagSearch(tag)}
          >
            <Tag size={11} />
            {tag}
          </button>
          {!readOnly && (
            <button
              disabled={busy}
              aria-label={`Remove tag ${tag}`}
              onClick={() =>
                void save(
                  page.tags!.filter((value) => value !== tag),
                  page.revision,
                )
              }
            >
              <X size={11} />
            </button>
          )}
        </span>
      ))}
      {!readOnly &&
        (editing !== null ? (
          <input
            autoFocus
            aria-label="New tag"
            placeholder="Tag name · Enter to save"
            value={draft}
            maxLength={80}
            disabled={busy}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setEditing(null);
                setDraft('');
              }
              if (event.key === 'Enter' && draft.trim()) {
                event.preventDefault();
                void save([...(page.tags ?? []), draft], editing);
              }
            }}
          />
        ) : (
          <button
            className="add-page-tag"
            disabled={busy}
            onClick={() => setEditing(page.revision)}
          >
            <Tag size={12} />
            Add tag
          </button>
        ))}
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
