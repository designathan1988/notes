import { useEffect, useRef, useState } from 'react';
import { Download, Upload, Play, Pause } from 'lucide-react';
import { api } from '../state/api.js';
import { useWorkspace } from '../state/store.js';
import { LocalRecovery } from '../documents/LocalRecovery.js';
type Report = {
  jobId: string;
  complete: boolean;
  stage: string;
  createdPages: number;
  warnings: string[];
};
export function DataSettings() {
  const workspace = useWorkspace((state) => state.workspaceId);
  const identity = useWorkspace((state) => state.user?.id);
  const role = useWorkspace(
    (state) => state.workspaces.find((item) => item.id === state.workspaceId)?.role,
  );
  const [jobs, setJobs] = useState<Report[]>([]);
  const [progress, setProgress] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const stop = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const refresh = () => {
    if (role !== 'viewer')
      void api<Report[]>(`/workspaces/${workspace}/imports`)
        .then(setJobs)
        .catch(() => {});
  };
  useEffect(() => {
    refresh();
    return () => {
      stop.current = true;
    };
  }, [workspace]);
  async function advance(id: string) {
    setBusy(true);
    stop.current = false;
    setError('');
    try {
      let report: Report;
      do {
        report = await api<Report>(`/imports/${id}/advance`, { method: 'POST', body: '{}' });
        setProgress(report);
      } while (!report.complete && !stop.current);
      await useWorkspace.getState().reload();
      refresh();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="settings-section">
      <h3>Your information stays yours.</h3>
      <p className="muted-text">
        Workspace ZIP includes versioned JSON, page content, database properties, internal links,
        and available attachment files.
      </p>
      <button
        className="button"
        onClick={() =>
          void download(`/api/workspaces/${workspace}/export`, 'note-workspace.zip').catch(
            (error) => setError(error.message),
          )
        }
      >
        <Download />
        Export workspace ZIP
      </button>
      <hr />
      <LocalRecovery key={`${identity}:${workspace}`} />
      <hr />
      <h3>Import a workspace</h3>
      <p className="muted-text">
        Import creates new pages in this workspace and remaps links. It does not overwrite existing
        pages. You can pause and resume between batches.
      </p>
      {role !== 'viewer' && (
        <>
          <input
            ref={input}
            type="file"
            hidden
            accept=".zip,application/zip"
            aria-label="Choose workspace archive"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setBusy(true);
              setError('');
              try {
                const response = await fetch(`/api/workspaces/${workspace}/imports`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/octet-stream', 'X-Note-Request': '1' },
                  body: file,
                });
                const report = await response.json();
                if (!response.ok) throw new Error(report.message);
                setProgress(report);
                await advance(report.jobId);
              } catch (error) {
                setError((error as Error).message);
                setBusy(false);
              }
              event.target.value = '';
            }}
          />
          <button className="button" disabled={busy} onClick={() => input.current?.click()}>
            <Upload />
            Choose ZIP to import
          </button>
        </>
      )}
      {progress && (
        <div className="import-progress" role="status">
          <strong>{progress.complete ? 'Import complete' : `Importing ${progress.stage}`}</strong>
          <span>{progress.createdPages} pages created</span>
          {progress.warnings.map((warning, index) => (
            <small key={index}>{warning}</small>
          ))}
          {busy && (
            <button
              className="text-button"
              onClick={() => {
                stop.current = true;
              }}
            >
              <Pause size={15} />
              Pause after this batch
            </button>
          )}
        </div>
      )}
      {!busy &&
        jobs.map((job) => (
          <div className="resume-job" key={job.jobId}>
            <span>
              {job.createdPages} pages · {job.stage}
            </span>
            <button className="button" onClick={() => void advance(job.jobId)}>
              <Play />
              Resume
            </button>
          </div>
        ))}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
export async function download(url: string, filename: string) {
  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message ?? 'Download failed.');
  }
  const blob = await response.blob();
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
