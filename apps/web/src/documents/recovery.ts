export interface Recovery {
  read(key: string): Promise<Uint8Array | null>;
  write(key: string, value: Uint8Array): Promise<void>;
  clearIdentity(identity: string): Promise<void>;
  close(): void;
}
export function openRecovery(): Promise<Recovery> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('Local recovery is unavailable in this browser.'));
      return;
    }
    const request = indexedDB.open('note-recovery-v1', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('documents');
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Local recovery is blocked by another tab.'));
    request.onsuccess = () => {
      const db = request.result;
      function write(key: string, value: Uint8Array) {
        return new Promise<void>((done, fail) => {
          const tx = db.transaction('documents', 'readwrite');
          tx.objectStore('documents').put(value, key);
          tx.oncomplete = () => done();
          tx.onerror = () => fail(tx.error);
          tx.onabort = () => fail(tx.error);
        });
      }
      resolve({
        write,
        read(key) {
          return new Promise((done, fail) => {
            const tx = db.transaction('documents', 'readonly');
            const get = tx.objectStore('documents').get(key);
            get.onsuccess = () => done(get.result ? new Uint8Array(get.result) : null);
            get.onerror = () => fail(get.error);
          });
        },
        clearIdentity(identity) {
          return new Promise((done, fail) => {
            const tx = db.transaction('documents', 'readwrite');
            const cursor = tx.objectStore('documents').openCursor();
            cursor.onsuccess = () => {
              const item = cursor.result;
              if (item) {
                if (String(item.key).startsWith(`${identity}:`)) item.delete();
                item.continue();
              }
            };
            tx.oncomplete = () => done();
            tx.onerror = () => fail(tx.error);
          });
        },
        close() {
          db.close();
        },
      });
    };
  });
}
