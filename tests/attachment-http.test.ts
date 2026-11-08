import { expect, test } from 'vitest';
import Fastify from 'fastify';
import { sendAttachment } from '../apps/server/src/attachments/http.js';
test('authorized media can seek with byte ranges without changing disposition or isolation headers', async () => {
  const app = Fastify();
  app.get('/file', (request, reply) =>
    sendAttachment(
      reply,
      {
        inline: true,
        mediaType: 'video/mp4',
        filename: 'A clip.mp4',
        bytes: Buffer.from('0123456789'),
      },
      request.headers.range,
    ),
  );
  try {
    const part = await app.inject({ url: '/file', headers: { range: 'bytes=2-5' } });
    expect(part.statusCode).toBe(206);
    expect(part.body).toBe('2345');
    expect(part.headers['content-range']).toBe('bytes 2-5/10');
    expect(part.headers['content-security-policy']).toBe("sandbox; default-src 'none'");
    expect((await app.inject({ url: '/file', headers: { range: 'bytes=-3' } })).body).toBe('789');
    expect((await app.inject({ url: '/file', headers: { range: 'bytes=8-100' } })).body).toBe('89');
    const invalid = await app.inject({ url: '/file', headers: { range: 'bytes=100-200' } });
    expect(invalid.statusCode).toBe(416);
    expect(invalid.headers['content-range']).toBe('bytes */10');
    expect((await app.inject('/file')).body).toBe('0123456789');
  } finally {
    await app.close();
  }
});
