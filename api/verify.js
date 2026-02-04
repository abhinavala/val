import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const loadLocalEnvIfNeeded = () => {
  if (process.env.RIDDLE_SIGNING_SECRET) return;
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach((line) => {
    if (!line || line.startsWith('#') || !line.includes('=')) return;
    const [key, ...rest] = line.split('=');
    const value = rest.join('=').replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
};

const normalizeAnswer = (value) => value.trim().toLowerCase();

const buildSignature = (secret, answer) => {
  return crypto
    .createHmac('sha256', secret)
    .update(answer, 'utf8')
    .digest('hex');
};

export default async function handler(req, res) {
  loadLocalEnvIfNeeded();

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const signingSecret = process.env.RIDDLE_SIGNING_SECRET;
  if (!signingSecret) {
    res.status(500).json({ error: 'Server misconfigured' });
    return;
  }

  const { answer, signature } = req.body || {};

  if (!answer || !signature) {
    res.status(400).json({ ok: false, error: 'Missing fields' });
    return;
  }

  const normalizedAnswer = normalizeAnswer(String(answer));
  const expected = buildSignature(signingSecret, normalizedAnswer);

  const isValid =
    expected.length === signature.length &&
    crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature, 'utf8'));

  res.status(200).json({ ok: isValid });
}
