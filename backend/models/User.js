const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: 'USER' },
    createdAt: { type: Date, default: Date.now }
  },
  { versionKey: false, collection: 'users' }
);

module.exports = mongoose.model('User', userSchema);
