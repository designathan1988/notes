import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, CornerDownRight, MessageSquare, RotateCcw, Send, X } from 'lucide-react';
import { useWorkspace } from '../state/store.js';
import type { DiscussionThread } from '@note/contracts';
import { ACTIVITY_PAGE_SIZE } from '@note/contracts';

export const activityTime = (value: string) =>
  new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
export function DiscussionPanel({ pageId, canWrite }: { pageId: string; canWrite: boolean }) {
  const [resolved, setResolved] = useState(false),
    [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const body = useWorkspace((state) => state.discussionDrafts[`page:${pageId}`]?.body ?? '');
  const reply = useWorkspace((state) => state.discussionDrafts[`thread:${selected}`]?.body ?? '');
  const setBody = (value: string) =>
    useWorkspace.getState().writeDiscussionDraft(`page:${pageId}`, pageId, value);
  const setReply = (value: string) => {
    if (selected) useWorkspace.getState().writeDiscussionDraft(`thread:${selected}`, pageId, value);
  };
  const data = useWorkspace((state) => state.discussions[pageId]);
  const messages = useWorkspace((state) => state.discussionMessages[selected ?? '']);
  const quote = useWorkspace((state) =>
    state.discussionQuote?.pageId === pageId ? state.discussionQuote.text : '',
  );
  const version = useWorkspace((state) => state.knowledgeVersion);
  const thread = messages?.thread ?? data?.threads.find((item) => item.id === selected);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (data?.offset)
      root.current?.querySelector<HTMLButtonElement>('.discussion-summary')?.focus();
  }, [data?.offset]);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        await useWorkspace.getState().loadDiscussions(pageId, resolved);
        if (selected) await useWorkspace.getState().loadDiscussionMessages(pageId, selected);
        if (active) setError('');
      } catch (failure) {
        if (active) setError(failure instanceof Error ? failure.message : String(failure));
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 3500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [pageId, resolved, selected, version]);
  const run = async (operation: () => Promise<void>, complete?: () => void) => {
    setBusy(true);
    setError('');
    try {
      await operation();
      complete?.();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };
  const select = (thread: DiscussionThread) => {
    setSelected(thread.id);
  };
  return (
    <div className="discussion-panel" ref={root}>
      <div className="activity-switch" role="group" aria-label="Discussion status">
        <button
          aria-pressed={!resolved}
          onClick={() => {
            setResolved(false);
            setSelected(null);
          }}
        >
          Open
        </button>
        <button
          aria-pressed={resolved}
          onClick={() => {
            setResolved(true);
            setSelected(null);
          }}
        >
          Resolved
        </button>
      </div>
      {error && (
        <p className="activity-error" role="alert">
          {error}
        </p>
      )}
      {selected ? (
        <>
          <button className="activity-back" onClick={() => setSelected(null)}>
            <ArrowLeft size={14} />
            All discussions
          </button>
          {thread?.quote && <blockquote className="discussion-quote">{thread.quote}</blockquote>}
          <div role="region" aria-label="Discussion messages" className="discussion-messages">
            {messages?.messages.map((message) => (
              <div className="discussion-message" key={message.id}>
                <div className="message-byline">
                  <span className="message-avatar">{message.authorName.slice(0, 1)}</span>
                  <strong>{message.authorName}</strong>
                  <time dateTime={message.createdAt}>{activityTime(message.createdAt)}</time>
                </div>
                <p>{message.body}</p>
              </div>
            ))}
            {!messages && <p className="muted-text">Loading discussion…</p>}
            {messages?.hasMore && (
              <button
                className="text-button"
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    useWorkspace.getState().loadDiscussionMessages(pageId, selected, true),
                  )
                }
              >
                Load earlier replies
              </button>
            )}
          </div>
          {canWrite && thread && (
            <button
              className="discussion-resolve"
              disabled={busy}
              onClick={() =>
                void run(
                  () => useWorkspace.getState().resolveDiscussion(pageId, thread),
                  () => setSelected(null),
                )
              }
            >
              {thread.resolved ? <RotateCcw size={14} /> : <Check size={14} />}{' '}
              {thread.resolved ? 'Reopen discussion' : 'Resolve discussion'}
            </button>
          )}
          {canWrite && thread && !thread.resolved && (
            <form
              className="comment-composer"
              onSubmit={(event) => {
                event.preventDefault();
                void run(() => useWorkspace.getState().replyDiscussion(pageId, selected, reply));
              }}
            >
              <textarea
                aria-label="Reply"
                placeholder="Add to the discussion…"
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                maxLength={10000}
                rows={3}
              />
              <div>
                <small>Visible to everyone with page access</small>
                <button
                  className="button primary"
                  disabled={busy || !reply.trim()}
                  aria-label="Send reply"
                >
                  <Send size={14} />
                </button>
              </div>
            </form>
          )}
        </>
      ) : (
        <>
          {data?.resolved === resolved ? (
            data.threads.map((item) => (
              <button className="discussion-summary" key={item.id} onClick={() => select(item)}>
                <span className="message-byline">
                  <span className="message-avatar">{item.firstMessage.authorName.slice(0, 1)}</span>
                  <strong>{item.firstMessage.authorName}</strong>
                  <time dateTime={item.updatedAt}>{activityTime(item.updatedAt)}</time>
                </span>
                <span className="discussion-excerpt">{item.firstMessage.body}</span>
                <small>
                  <CornerDownRight size={12} />
                  {item.messageCount - 1} {item.messageCount === 2 ? 'reply' : 'replies'}
                  {item.resolved && (
                    <>
                      <Check size={12} />
                      Resolved
                    </>
                  )}
                </small>
              </button>
            ))
          ) : (
            <p className="muted-text">Loading discussions…</p>
          )}
          {data?.resolved === resolved && !data.threads.length && (
            <div className="activity-empty">
              <MessageSquare size={24} />
              <strong>{resolved ? 'No resolved discussions' : 'Start a conversation'}</strong>
              <p>
                {resolved
                  ? 'Resolved conversations stay available here.'
                  : 'Ask a question, share feedback, or capture a decision alongside this page.'}
              </p>
            </div>
          )}
          {data && (data.offset > 0 || data.hasMore) && (
            <div className="activity-pagination">
              <button
                className="text-button"
                disabled={busy || !data.offset}
                onClick={() =>
                  void run(() =>
                    useWorkspace.getState().loadDiscussions(pageId, resolved, 'previous'),
                  )
                }
              >
                Previous discussions
              </button>
              <small>Page {Math.floor(data.offset / ACTIVITY_PAGE_SIZE) + 1}</small>
              <button
                className="text-button"
                disabled={busy || !data.hasMore}
                onClick={() =>
                  void run(() => useWorkspace.getState().loadDiscussions(pageId, resolved, 'next'))
                }
              >
                More discussions
              </button>
            </div>
          )}
          {canWrite && !resolved && (
            <form
              className="comment-composer"
              onSubmit={(event) => {
                event.preventDefault();
                void run(() => useWorkspace.getState().postDiscussion(pageId, body, quote));
              }}
            >
              {quote && (
                <blockquote className="discussion-quote">
                  {quote}
                  <button
                    type="button"
                    aria-label="Remove quoted context"
                    onClick={() => useWorkspace.getState().clearDiscussionQuote()}
                  >
                    <X size={12} />
                  </button>
                </blockquote>
              )}
              <textarea
                aria-label="New comment"
                placeholder="Leave a comment…"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                maxLength={10000}
                rows={3}
              />
              <div>
                <small>Everyone with page access can read</small>
                <button
                  className="button primary"
                  disabled={busy || !body.trim()}
                  aria-label="Post comment"
                >
                  <Send size={14} />
                </button>
              </div>
            </form>
          )}
        </>
      )}
      {!canWrite && <p className="muted-text">You have read-only access to this page.</p>}
    </div>
  );
}
