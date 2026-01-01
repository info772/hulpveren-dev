const bcrypt = require("bcryptjs");

function verifyLogin(db, username, password) {
  if (!username || !password) return null;
  const user = db.prepare("SELECT id, username, password_hash FROM users WHERE username = ?").get(username);
  if (!user) return null;
  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return null;
  return { id: user.id, username: user.username };
}

module.exports = {
  verifyLogin,
};
