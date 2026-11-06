import https from 'node:https';
import { URL } from 'node:url';

const BASE = 'https://am.noxxyrorr.biz.id';
const UA = 'okhttp/4.12.0';

// Fungsi bantuan untuk nembak API
function call(url, { method = 'GET', body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const payload = body ? Buffer.from(JSON.stringify(body)) : null;
    const req = https.request({
      method,
      hostname: target.hostname,
      path: `${target.pathname}${target.search}`,
      headers: {
        Accept: 'application/json',
        'User-Agent': UA,
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {}),
        ...headers,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        try { resolve({ status: res.statusCode, json: JSON.parse(text) }); } 
        catch { resolve({ status: res.statusCode, text }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function post(route, body) {
  const res = await call(BASE + route, { method: 'POST', body, headers: { Origin: BASE, Referer: `${BASE}/` } });
  if (res.status >= 400) throw new Error(res.json?.error || `HTTP ${res.status}`);
  return res.json;
}

// Fungsi kirim link & verifikasi
async function sendLink(email) {
  return await post('/api/send-link', { email });
}

async function verifyLink(email, link) {
  return await post('/api/verify-link', { email, link });
}

// JEMBATAN KE HTML KITA
export default async function handler(req, res) {
  const { action, email, link } = req.query;
  if (!action) return res.status(400).json({ error: "Action invalid" });

  try {
    if (action === 'send') {
      if (!email) return res.status(400).json({ error: "Email required" });
      const result = await sendLink(email);
      return res.status(200).json({ success: true, data: result });
    }
    if (action === 'verify') {
      if (!email || !link) return res.status(400).json({ error: "Email & Link required" });
      const result = await verifyLink(email, link);
      return res.status(200).json({ success: true, data: result });
    }
    return res.status(400).json({ error: "Action unknown" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
