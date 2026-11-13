// In-memory Google Calendar and Stripe for the booking server's tests and its local dev server:
// globalThis.fetch is wrapped, calls to Google and Stripe are answered here, the rest passes.
export function installFakes(calendars, { checkoutUrl = () => 'https://checkout.stripe.com/c/pay/x' } = {}) {
  const cal = Object.fromEntries(Object.values(calendars).map((id) => [id, []]));
  const sessions = new Map();
  const mails = [];
  let nextId = 1;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const method = init.method || 'GET';
    const body = init.body;
    const ok = (j, status = 200) => new Response(j == null ? null : JSON.stringify(j), { status, headers: { 'content-type': 'application/json' } });
    if (url.host === 'oauth2.googleapis.com') {
      const assertion = new URLSearchParams(body).get('assertion');
      if (assertion.split('.').length !== 3) throw new Error('bad assertion');
      return ok({ access_token: 'ya29.test', expires_in: 3600 });
    }
    if (url.host === 'www.googleapis.com') {
      const p = url.pathname.replace('/calendar/v3', '');
      if (p === '/freeBusy') {
        const j = JSON.parse(body);
        const calendars = {};
        for (const { id } of j.items) calendars[id] = { busy: (cal[id] || []).filter((e) => e.status !== 'cancelled').map((e) => ({ start: e.start.dateTime, end: e.end.dateTime })) };
        return ok({ calendars });
      }
      const m = /^\/calendars\/([^/]+)\/events(?:\/([^/]+))?$/.exec(p);
      const c = decodeURIComponent(m[1]);
      const id = m[2] && decodeURIComponent(m[2]);
      const list = cal[c];
      if (method === 'POST') {
        const ev = { id: `ev${nextId++}`, status: 'confirmed', ...JSON.parse(body) };
        list.push(ev);
        return ok(ev);
      }
      if (method === 'GET' && !id) {
        const [k, v] = url.searchParams.get('privateExtendedProperty').split('=');
        return ok({ items: list.filter((e) => e.extendedProperties?.private?.[k] === v) });
      }
      const ev = list.find((e) => e.id === id);
      if (!ev) return ok({ error: { message: 'Not Found' } }, 404);
      if (method === 'GET') return ok(ev);
      if (method === 'PATCH') {
        Object.assign(ev, JSON.parse(body));
        return ok(ev);
      }
      if (method === 'DELETE') {
        list.splice(list.indexOf(ev), 1);
        return new Response(null, { status: 204 });
      }
    }
    if (url.host === 'api.resend.com') {
      if (!/^Bearer re_/.test(init.headers.authorization)) return ok({ message: 'API key is invalid' }, 401);
      mails.push(JSON.parse(body));
      return ok({ id: `mail${mails.length}` });
    }
    if (url.host === 'api.stripe.com') {
      if (!/^Bearer sk_/.test(init.headers.authorization)) throw new Error('no stripe key');
      if (method === 'POST' && url.pathname === '/v1/checkout/sessions') {
        const f = new URLSearchParams(body);
        const metadata = {};
        for (const [k, v] of f) if (k.startsWith('metadata[')) metadata[k.slice(9, -1)] = v;
        const s = {
          id: `cs_test_${nextId}`,
          url: checkoutUrl(`cs_test_${nextId}`),
          status: 'open',
          payment_status: 'unpaid',
          amount_total: Number(f.get('line_items[0][price_data][unit_amount]')),
          name: f.get('line_items[0][price_data][product_data][name]'),
          success_url: f.get('success_url'),
          cancel_url: f.get('cancel_url'),
          expires_at: Number(f.get('expires_at')),
          metadata,
        };
        nextId++;
        sessions.set(s.id, s);
        return ok(s);
      }
      const s = sessions.get(decodeURIComponent(url.pathname.split('/').pop()));
      return s ? ok(s) : ok({ error: { message: 'No such session' } }, 404);
    }
    return realFetch(input, init);
  };
  return { cal, sessions, mails };
}
