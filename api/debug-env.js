import fs from 'fs';
import path from 'path';

const loadLocalEnvIfNeeded = () => {
  if (process.env.GROQ_API_KEY || process.env.RIDDLE_SIGNING_SECRET) return;
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

export default function handler(req, res) {
  loadLocalEnvIfNeeded();
  const hasGroq = Boolean(process.env.GROQ_API_KEY);
  const hasSecret = Boolean(process.env.RIDDLE_SIGNING_SECRET);
  res.status(200).json({
    hasGroq,
    hasSecret,
    nodeEnv: process.env.NODE_ENV || 'unknown',
  });
}
