import { mkdir, writeFile, readdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
export interface MailMessage {
  to: string;
  subject: string;
  url: string;
  createdAt?: string;
}
export interface MailTransport {
  send(message: MailMessage): Promise<void>;
}
export class FileMail implements MailTransport {
  constructor(readonly directory: string = resolve('.runtime/mail')) {}
  async send(message: MailMessage): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    await writeFile(
      join(this.directory, `${randomUUID()}.json`),
      JSON.stringify({ ...message, createdAt: new Date().toISOString() }),
      { mode: 0o600 },
    );
  }
  async list(email: string): Promise<MailMessage[]> {
    await mkdir(this.directory, { recursive: true });
    const files = await readdir(this.directory);
    const messages = await Promise.all(
      files
        .filter((file) => /^[\w-]+\.json$/.test(file))
        .slice(-500)
        .map(
          async (file) =>
            JSON.parse(await readFile(join(this.directory, file), 'utf8')) as MailMessage,
        ),
    );
    return messages
      .filter((message) => message.to.toLowerCase() === email.toLowerCase())
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  }
}
