import type { FastifyReply } from 'fastify';

/** One HTTP owner for authorized attachment bytes, including browser media ranges. */
export function sendAttachment(
  reply: FastifyReply,
  file: { inline: boolean; mediaType: string; filename: string; bytes: Buffer },
  range?: string,
) {
  reply.header('Content-Type', file.inline ? file.mediaType : 'application/octet-stream');
  reply.header(
    'Content-Disposition',
    `${file.inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
  );
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('Content-Security-Policy', "sandbox; default-src 'none'");
  reply.header('Cache-Control', 'private, no-store');
  reply.header('Accept-Ranges', 'bytes');
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    const size = file.bytes.length;
    let start = match?.[1]
      ? Number(match[1])
      : match?.[2]
        ? Math.max(0, size - Number(match[2]))
        : NaN;
    let end = match?.[1] && match?.[2] ? Number(match[2]) : size - 1;
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      start >= size ||
      end < start
    ) {
      return reply.code(416).header('Content-Range', `bytes */${size}`).send();
    }
    end = Math.min(end, size - 1);
    return reply
      .code(206)
      .header('Content-Range', `bytes ${start}-${end}/${size}`)
      .send(file.bytes.subarray(start, end + 1));
  }
  return reply.send(file.bytes);
}
