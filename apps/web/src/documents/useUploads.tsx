import { useEffect, useState } from 'react';
import { uploadFile, UploadError, type CapturedFile } from './capture.js';
export function useUploads(pageId: string) {
  const [uploading, setUploading] = useState(0);
  const [failed, setFailed] = useState<{ file: File; id?: string }[]>([]);
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
export function FailedFile({ file, retry }: { file: File; retry(): void }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return (
    <div className="upload-failure">
      <span>Upload failed: {file.name}</span>
      <button onClick={retry}>Retry</button>
      <a download={file.name} href={url}>
        Save original
      </a>
    </div>
  );
}
