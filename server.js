const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const url = require('url');

const PORT = 3000;
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DB_FILE = path.join(DATA_DIR, 'db.json');

// ─── Simple DB ────────────────────────────────────────────────────────────────
function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], sessions: {} }));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function hashPassword(pwd) {
  return crypto.createHash('sha256').update(pwd + 'match_salt_2024').digest('hex');
}
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}
function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
}
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
function json(res, status, data) {
  cors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}
function getBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}
function authMiddleware(req) {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '');
  const db = loadDB();
  const userId = db.sessions[token];
  if (!userId) return null;
  return db.users.find(u => u.id === userId) || null;
}

// ─── Avatar URLs (using DiceBear) ────────────────────────────────────────────
function getAvatar(seed, gender) {
  const style = gender === 'feminino' ? 'adventurer' : 'big-smile';
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

// ─── Router ───────────────────────────────────────────────────────────────────
async function router(req, res) {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const method = req.method;

  // OPTIONS preflight
  if (method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }

  // ── Serve frontend ──
  if (method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
    const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'));
    cors(res);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }

  // ── API Routes ──

  // POST /api/register
  if (method === 'POST' && pathname === '/api/register') {
    const body = await getBody(req);
    const { name, email, password, age, gender, interest, bio, city } = body;
    if (!name || !email || !password || !age || !gender || !interest) {
      return json(res, 400, { error: 'Campos obrigatórios faltando' });
    }
    const db = loadDB();
    if (db.users.find(u => u.email === email)) {
      return json(res, 400, { error: 'Email já cadastrado' });
    }
    const user = {
      id: generateId(),
      name, email,
      password: hashPassword(password),
      age: parseInt(age),
      gender, interest, bio: bio || '',
      city: city || '',
      avatar: getAvatar(name + email, gender),
      likes: [],
      matches: [],
      createdAt: new Date().toISOString()
    };
    db.users.push(user);
    saveDB(db);
    const token = generateToken();
    db.sessions[token] = user.id;
    saveDB(db);
    const { password: _, ...safeUser } = user;
    return json(res, 201, { token, user: safeUser });
  }

  // POST /api/login
  if (method === 'POST' && pathname === '/api/login') {
    const body = await getBody(req);
    const { email, password } = body;
    const db = loadDB();
    const user = db.users.find(u => u.email === email && u.password === hashPassword(password));
    if (!user) return json(res, 401, { error: 'Email ou senha incorretos' });
    const token = generateToken();
    db.sessions[token] = user.id;
    saveDB(db);
    const { password: _, ...safeUser } = user;
    return json(res, 200, { token, user: safeUser });
  }

  // GET /api/me
  if (method === 'GET' && pathname === '/api/me') {
    const user = authMiddleware(req);
    if (!user) return json(res, 401, { error: 'Não autenticado' });
    const { password: _, ...safeUser } = user;
    return json(res, 200, safeUser);
  }

  // GET /api/discover — list people matching interest
  if (method === 'GET' && pathname === '/api/discover') {
    const user = authMiddleware(req);
    if (!user) return json(res, 401, { error: 'Não autenticado' });
    const db = loadDB();
    const candidates = db.users.filter(u =>
      u.id !== user.id &&
      u.gender === user.interest &&
      !user.likes.includes(u.id)
    ).map(({ password, ...safe }) => safe);
    return json(res, 200, candidates);
  }

  // POST /api/like/:targetId
  if (method === 'POST' && pathname.startsWith('/api/like/')) {
    const user = authMiddleware(req);
    if (!user) return json(res, 401, { error: 'Não autenticado' });
    const targetId = pathname.split('/api/like/')[1];
    const db = loadDB();
    const me = db.users.find(u => u.id === user.id);
    const target = db.users.find(u => u.id === targetId);
    if (!target) return json(res, 404, { error: 'Usuário não encontrado' });
    if (!me.likes.includes(targetId)) me.likes.push(targetId);
    // Check mutual match
    let matched = false;
    if (target.likes.includes(me.id)) {
      if (!me.matches.includes(targetId)) me.matches.push(targetId);
      if (!target.matches.includes(me.id)) target.matches.push(me.id);
      matched = true;
    }
    saveDB(db);
    return json(res, 200, { matched, target: (({ password, ...s }) => s)(target) });
  }

  // GET /api/matches
  if (method === 'GET' && pathname === '/api/matches') {
    const user = authMiddleware(req);
    if (!user) return json(res, 401, { error: 'Não autenticado' });
    const db = loadDB();
    const me = db.users.find(u => u.id === user.id);
    const matches = (me.matches || []).map(id => {
      const u = db.users.find(x => x.id === id);
      if (!u) return null;
      const { password, ...safe } = u;
      return safe;
    }).filter(Boolean);
    return json(res, 200, matches);
  }

  // PUT /api/profile
  if (method === 'PUT' && pathname === '/api/profile') {
    const user = authMiddleware(req);
    if (!user) return json(res, 401, { error: 'Não autenticado' });
    const body = await getBody(req);
    const db = loadDB();
    const me = db.users.find(u => u.id === user.id);
    if (body.bio !== undefined) me.bio = body.bio;
    if (body.city !== undefined) me.city = body.city;
    if (body.age !== undefined) me.age = parseInt(body.age);
    saveDB(db);
    const { password, ...safe } = me;
    return json(res, 200, safe);
  }

  // POST /api/logout
  if (method === 'POST' && pathname === '/api/logout') {
    const auth = req.headers.authorization || '';
    const token = auth.replace('Bearer ', '');
    const db = loadDB();
    delete db.sessions[token];
    saveDB(db);
    return json(res, 200, { ok: true });
  }

  // 404
  cors(res);
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
}

// ─── Start ────────────────────────────────────────────────────────────────────
fs.mkdirSync(path.join(__dirname, 'public'), { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });
const server = http.createServer(router);
server.listen(PORT, () => {
  console.log(`\n💕 MatchApp rodando em http://localhost:${PORT}\n`);
});
