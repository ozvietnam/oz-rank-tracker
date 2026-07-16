// Optional shared-token gate for the /api endpoints.
// When APP_TOKEN is unset the API stays open (app works with zero config);
// once set, every request must carry the token (header x-app-token or Bearer).
export function isAuthorized(req) {
  const token = process.env.APP_TOKEN;
  if (!token) return true;
  const given = req.headers['x-app-token'] || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return given === token;
}

export function requireAuth(req, res) {
  if (isAuthorized(req)) return true;
  res.status(401).json({ error: 'Thieu hoac sai APP_TOKEN — bam nut 🔑 tren dashboard de nhap token' });
  return false;
}
