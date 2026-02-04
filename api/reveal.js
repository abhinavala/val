import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const MASTER_PASSWORD = 'AbhiShreya4Eva';

const normalizeAnswer = (value) => value.trim().toLowerCase();

const buildSignature = (secret, answer) => {
  return crypto
    .createHmac('sha256', secret)
    .update(answer, 'utf8')
    .digest('hex');
};

const getEncryptionKey = (secret) => {
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
};

const decryptAnswer = (secret, token) => {
  const [ivB64, tagB64, dataB64] = String(token).split('.');
  if (!ivB64 || !tagB64 || !dataB64) return null;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const key = getEncryptionKey(secret);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
};

const loadLocalEnvIfNeeded = () => {
  if (process.env.GROQ_API_KEY && process.env.RIDDLE_SIGNING_SECRET) return;
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

  const { signature, token, masterPassword } = req.body || {};

  if (!signature || !token || masterPassword !== MASTER_PASSWORD) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  try {
    const answer = decryptAnswer(signingSecret, token);
    if (!answer) {
      res.status(409).json({ error: 'Riddle mismatch' });
      return;
    }

    const normalizedAnswer = normalizeAnswer(answer);
    const expected = buildSignature(signingSecret, normalizedAnswer);

    if (expected !== signature) {
      res.status(409).json({ error: 'Riddle mismatch' });
      return;
    }

    res.status(200).json({ answer: answer.trim() });
  } catch (err) {
    res.status(500).json({ error: 'Unexpected server error' });
  }
}
