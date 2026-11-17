/**
 * Reads an e-mail as it arrives (RFC 5322 / MIME), for the replies to quote requests
 * (booking/store.js, mail/in): its headers, its text (plain, or the HTML made plain), its
 * attachments. Enough for what mail apps send (Gmail, Outlook, Apple Mail…): nested multiparts,
 * base64 and quoted-printable, the usual charsets, encoded words (=?UTF-8?Q?…?=) and RFC 2231 file
 * names. Nothing here runs anything from the message.
 */

const latin1 = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return s;
};
const toBytes = (s) => {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
};
/** bytes in a charset → text (unknown charset: UTF-8) */
function decodeText(bytes, charset = 'utf-8') {
  try {
    return new TextDecoder(String(charset || 'utf-8').trim().toLowerCase().replace(/^(us-)?ascii$/, 'utf-8')).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}
function fromBase64(s) {
  const clean = s.replace(/[^A-Za-z0-9+/=_-]/g, '').replace(/-/g, '+').replace(/_/g, '/');
  try {
    return toBytes(atob(clean.replace(/=+$/, '') + '==='.slice((clean.replace(/=+$/, '').length + 3) % 4)));
  } catch {
    return new Uint8Array(0);
  }
}
function fromQuotedPrintable(s, inHeader = false) {
  const bytes = [];
  const src = inHeader ? s.replace(/_/g, ' ') : s.replace(/=\r?\n/g, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '=' && /^[0-9A-Fa-f]{2}$/.test(src.slice(i + 1, i + 3))) {
      bytes.push(parseInt(src.slice(i + 1, i + 3), 16));
      i += 2;
    } else bytes.push(src.charCodeAt(i) & 0xff);
  }
  return new Uint8Array(bytes);
}

/** =?UTF-8?Q?Demande_de_devis?= and the like, in a header */
export function decodeWords(value) {
  return String(value || '')
    .replace(/(=\?[^?]+\?[bBqQ]\?[^?]*\?=)\s+(?==\?)/g, '$1')
    .replace(/=\?([^?*]+)(?:\*[^?]*)?\?([bBqQ])\?([^?]*)\?=/g, (_, charset, enc, text) => decodeText(enc.toUpperCase() === 'B' ? fromBase64(text) : fromQuotedPrintable(text, true), charset));
}

/** headers of a part: lower-case name → list of values (unfolded, raw) */
function readHeaders(text) {
  const out = {};
  for (const line of text.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i <= 0) continue;
    const k = line.slice(0, i).trim().toLowerCase();
    (out[k] ||= []).push(line.slice(i + 1).trim());
  }
  return out;
}

/** « text/plain; charset="utf-8"; name*=UTF-8''photo%201.jpg » → { value, params } */
export function headerParams(value) {
  const parts = [];
  let cur = '';
  let quoted = false;
  for (const c of String(value || '')) {
    if (c === '"') quoted = !quoted;
    if (c === ';' && !quoted) {
      parts.push(cur);
      cur = '';
    } else cur += c;
  }
  parts.push(cur);
  const params = {};
  const continued = {};
  for (const p of parts.slice(1)) {
    const i = p.indexOf('=');
    if (i < 0) continue;
    const key = p.slice(0, i).trim().toLowerCase();
    let v = p.slice(i + 1).trim().replace(/^"(.*)"$/s, '$1');
    const m = key.match(/^([^*]+)\*(?:(\d+)\*?)?$/);
    if (m) {
      // RFC 2231: name*=UTF-8''…, possibly cut in name*0*, name*1*…
      (continued[m[1]] ||= []).push({ n: Number(m[2] || 0), v, encoded: key.endsWith('*') });
      continue;
    }
    params[key] = decodeWords(v);
  }
  for (const [k, list] of Object.entries(continued)) {
    list.sort((a, b) => a.n - b.n);
    let charset = 'utf-8';
    const joined = list
      .map(({ v, encoded }, i) => {
        if (i === 0 && encoded && /^[^']*'[^']*'/.test(v)) {
          charset = v.split("'")[0] || 'utf-8';
          v = v.split("'").slice(2).join("'");
        }
        return encoded ? v : encodeURIComponent(v);
      })
      .join('');
    try {
      params[k] = decodeText(toBytes(unescape(joined)), charset);
    } catch {
      params[k] = joined;
    }
  }
  return { value: parts[0].trim().toLowerCase(), params };
}

/** an e-mail address out of « Name <a@b.c> » (lower case) */
export const addressOf = (v) => (String(v || '').match(/<([^<>\s]+@[^<>\s]+)>/) || String(v || '').match(/([^\s<>"',;]+@[^\s<>"',;]+)/) || [])[1]?.toLowerCase() || '';
/** the name part of « Name <a@b.c> » */
export const nameOf = (v) =>
  decodeWords(String(v || '').replace(/<[^>]*>/, ''))
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .trim();
/** Message-IDs listed in a header (In-Reply-To, References) */
export const idsOf = (v) => String(v || '').match(/<[^<>\s]+>/g) || [];

/** the HTML of a message made plain: paragraphs and line breaks kept, quoted parts marked */
export function htmlToText(html) {
  return String(html || '')
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, '')
    .replace(/<div[^>]*class="?[^">]*gmail_quote[\s\S]*$/i, '\n\n[quote]')
    .replace(/<blockquote[\s\S]*$/i, '\n\n[quote]')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * What a reply really says: the text above the quoted message (« Le … a écrit : », « On … wrote: »,
 * « > » lines, Outlook's « De : … » block, the signature delimiter « -- »).
 */
export function freshText(text) {
  const lines = String(text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const two = `${line} ${lines[i + 1] || ''}`;
    if (line.trim() === '[quote]') break;
    if (/^\s*>/.test(line)) break;
    if (/^\s*(Le|On)\s.+/.test(line) && (/(a\s+écrit|wrote)\s*:\s*$/i.test(line) || /(a\s+écrit|wrote)\s*:\s*$/i.test(two))) break;
    if (/^\s*-{2,}\s*(Original Message|Message d'origine|Message transféré|Forwarded message)/i.test(line)) break;
    if (/^\s*_{8,}\s*$/.test(line) && /^\s*(De|From)\s*:/i.test(lines[i + 1] || '')) break;
    if (/^\s*(De|From)\s*:\s.+@/i.test(line) && /^\s*(Envoyé|Sent|Date)\s*:/i.test(lines[i + 1] || '')) break;
    if (/^--\s*$/.test(line)) break;
    out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * The e-mail: { headers (lower-case name → first value), from, fromName, to, subject, messageId,
 * inReplyTo, references, auth (Authentication-Results lines), text, html, attachments:
 * [{ filename, type, bytes, inline }] }
 */
export function parseMail(raw) {
  const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  const all = latin1(bytes);
  const attachments = [];
  let text = '';
  let html = '';
  const walk = (chunk, depth) => {
    const cut = chunk.search(/\r?\n\r?\n/);
    const head = readHeaders(cut < 0 ? chunk : chunk.slice(0, cut));
    const body = cut < 0 ? '' : chunk.slice(cut).replace(/^\r?\n\r?\n/, '');
    const type = headerParams(head['content-type']?.[0] || 'text/plain');
    const disposition = headerParams(head['content-disposition']?.[0] || '');
    const encoding = (head['content-transfer-encoding']?.[0] || '7bit').toLowerCase();
    if (type.value.startsWith('multipart/') && type.params.boundary && depth < 8) {
      const b = `--${type.params.boundary}`;
      const parts = body.split(new RegExp(`\\r?\\n?${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:--)?[ \\t]*\\r?\\n?`));
      for (const p of parts.slice(1)) if (p.trim()) walk(p, depth + 1);
      return;
    }
    const data = encoding === 'base64' ? fromBase64(body) : encoding === 'quoted-printable' ? fromQuotedPrintable(body) : toBytes(body);
    const filename = disposition.params.filename || type.params.name || '';
    const isAttachment = disposition.value === 'attachment' || (filename && !type.value.startsWith('text/')) || (!type.value.startsWith('text/') && !type.value.startsWith('multipart/') && type.value !== 'message/delivery-status');
    if (isAttachment) {
      attachments.push({ filename: decodeWords(filename) || 'piece-jointe', type: type.value, bytes: data, inline: disposition.value === 'inline' || !!head['content-id'] });
      return;
    }
    const content = decodeText(data, type.params.charset);
    if (type.value === 'text/html') html ||= content;
    else if (type.value === 'text/plain') text ||= content;
  };
  walk(all, 0);
  const cut = all.search(/\r?\n\r?\n/);
  const h = readHeaders(cut < 0 ? all : all.slice(0, cut));
  const first = (k) => decodeWords(h[k]?.[0] || '');
  // headers in UTF-8 without encoded words (allowed by RFC 6532): read again as UTF-8
  const utf8 = (s) => {
    try {
      return /[\x80-\xff]/.test(s) ? new TextDecoder('utf-8', { fatal: true }).decode(toBytes(s)) : s;
    } catch {
      return s;
    }
  };
  return {
    headers: Object.fromEntries(Object.entries(h).map(([k, v]) => [k, utf8(v[0])])),
    from: addressOf(h.from?.[0]),
    fromName: utf8(nameOf(h.from?.[0])),
    to: (h.to || []).join(', '),
    subject: utf8(first('subject')),
    messageId: idsOf(h['message-id']?.[0])[0] || '',
    inReplyTo: idsOf(h['in-reply-to']?.[0]),
    references: idsOf((h.references || []).join(' ')),
    auth: [...(h['authentication-results'] || []), ...(h['arc-authentication-results'] || [])],
    autoReply: /^(auto-|yes)/i.test(h['auto-submitted']?.[0] || '') || /^(bulk|junk|list|auto_reply)$/i.test(h.precedence?.[0] || '') || !!h['x-autoreply'] || !!h['x-autorespond'],
    text,
    html,
    attachments,
  };
}

/** base64 → bytes */
export const bytesOf = (b64) => fromBase64(String(b64 || ''));

/** bytes → base64 (native when the runtime has it) */
export function toBase64(u8) {
  if (typeof u8.toBase64 === 'function') return u8.toBase64();
  return btoa(latin1(u8));
}
