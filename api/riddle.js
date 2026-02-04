import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

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

const encryptAnswer = (secret, answer) => {
  const key = getEncryptionKey(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(answer, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
};

const extractJson = (content) => {
  try {
    return JSON.parse(content);
  } catch (err) {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (innerErr) {
      return null;
    }
  }
};

let lastQuestion = '';

export default async function handler(req, res) {
  loadLocalEnvIfNeeded();

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GROQ_API_KEY;
  const signingSecret = process.env.RIDDLE_SIGNING_SECRET;
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  if (!apiKey || !signingSecret) {
    res.status(500).json({ error: 'Server misconfigured' });
    return;
  }

  const buildPrompt = (nonce) => {
    const lines = [
      'Create one short, clever riddle with a single-word or short-phrase answer.',
      'Provide three hints that get progressively more obvious.',
      'Return ONLY valid JSON with keys: question, answer, hints (array of 3 strings).',
      'Avoid offensive content.',
      `Nonce: ${nonce}. Use it to ensure this riddle is unique and not repeated.`,
    ];
    if (lastQuestion) {
      lines.push(`Avoid this exact riddle question: "${lastQuestion}"`);
    }
    return lines.join(' ');
  };

  try {
    let parsed = null;
    let attempt = 0;
    while (attempt < 3) {
      attempt += 1;
      const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const prompt = buildPrompt(nonce);
      const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'You are a riddle generator that replies with JSON only.' },
            { role: 'user', content: prompt },
          ],
          temperature: 1.1,
          top_p: 0.95,
          presence_penalty: 1.0,
          frequency_penalty: 0.5,
          max_tokens: 200,
        }),
      });

      if (!groqResponse.ok) {
        const errorText = await groqResponse.text();
        res.status(502).json({ error: 'Groq request failed', details: errorText });
        return;
      }

      const data = await groqResponse.json();
      const content = data?.choices?.[0]?.message?.content;
      parsed = content ? extractJson(content) : null;

      if (
        parsed &&
        parsed.question &&
        parsed.answer &&
        Array.isArray(parsed.hints) &&
        parsed.hints.length >= 3
      ) {
        if (!lastQuestion || parsed.question.trim() !== lastQuestion) {
          break;
        }
      }
      parsed = null;
    }

    if (
      !parsed ||
      !parsed.question ||
      !parsed.answer ||
      !Array.isArray(parsed.hints) ||
      parsed.hints.length < 3
    ) {
      res.status(502).json({ error: 'Invalid riddle response' });
      return;
    }

    const normalizedAnswer = normalizeAnswer(parsed.answer);
    const signature = buildSignature(signingSecret, normalizedAnswer);
    const token = encryptAnswer(signingSecret, parsed.answer.trim());
    lastQuestion = parsed.question.trim();

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.status(200).json({
      question: parsed.question.trim(),
      hints: parsed.hints.map((hint) => String(hint).trim()).filter(Boolean),
      signature,
      token,
    });
  } catch (err) {
    res.status(500).json({ error: 'Unexpected server error' });
  }
}
