import { t } from '../i18n/index.js';
import { useEffect, useState } from 'react';
import { uploadFile, UploadError, type CapturedFile } from './capture.js';
export function useUploads(pageId: string) {
  const [uploading, setUploading] = useState(0);
  const [failed, setFailed] = useState<{ file: File; id?: string; label?: string }[]>([]);
  async function upload(file: File, existingId?: string): Promise<CapturedFile> {
    setUploading((count) => count + 1);
    try {
      return await uploadFile(pageId, file, existingId);
    } catch (error) {
      setFailed((files) => [
        ...files,
        { file, id: error instanceof UploadError ? error.attachmentId : existingId },
      ]);
      throw error;
    } finally {
      setUploading((count) => count - 1);
    }
  }
  return { uploading, failed, setFailed, upload };
}
export function FailedFile({
  file,
  retry,
  label = 'Upload failed',
  disabled = false,
}: {
  file: File;
  retry(): void;
  label?: string;
  disabled?: boolean;
}) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return (
    <div className="upload-failure">
      <span>
        {t(label)}: {file.name}
      </span>
      <button onClick={retry} disabled={disabled}>
        {t('Retry')}
      </button>
      <a download={file.name} href={url}>
        {t('Save original')}
      </a>
    </div>
  );
}
