const crypto = require('crypto');
const { randomUUID } = require('crypto');
const User = require('../models/User');

const memoryUsers = [];

function isDatabaseReady() {
  return User?.db?.readyState === 1;
}

function normalizeDoc(doc) {
  if (!doc) return null;
  if (typeof doc.toObject === 'function') {
    return doc.toObject({ flattenMaps: true });
  }
  return doc;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, oldHash] = String(stored || '').split(':');
  if (!salt || !oldHash) return false;
  const newHash = crypto.scryptSync(password, salt, 64).toString('hex');

  const oldBuf = Buffer.from(oldHash, 'hex');
  const newBuf = Buffer.from(newHash, 'hex');
  if (oldBuf.length !== newBuf.length) return false;
  return crypto.timingSafeEqual(oldBuf, newBuf);
}

function buildToken(user) {
  const payload = `${user._id || user.id}:${Date.now()}:${crypto.randomBytes(8).toString('hex')}`;
  return Buffer.from(payload).toString('base64url');
}

async function findUserByEmail(email) {
  if (isDatabaseReady()) {
    return User.findOne({ email }).lean();
  }
  return memoryUsers.find((item) => item.email === email) || null;
}

async function createUser(data) {
  if (isDatabaseReady()) {
    return normalizeDoc(await User.create(data));
  }
  const record = { _id: randomUUID(), createdAt: new Date(), ...data };
  memoryUsers.push(record);
  return record;
}

const signup = async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ message: 'User already exists with this email.' });
    }

    const created = await createUser({
      name,
      email,
      passwordHash: hashPassword(password),
      role: 'USER'
    });

    const token = buildToken(created);
    return res.status(201).json({
      message: 'Signup successful',
      token,
      user: {
        id: String(created._id),
        name: created.name,
        email: created.email,
        role: created.role
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Signup failed', error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await findUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = buildToken(user);
    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Login failed', error: error.message });
  }
};

module.exports = {
  signup,
  login
};
