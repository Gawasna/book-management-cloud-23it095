const session = require('express-session');
const MongoStore = require('connect-mongo');

// Stateless Session Configuration
// Luu tru tap trung Session truc tiep xuong Cloud MongoDB Atlas (collection: sessions)
// Tuyet doi khong luu Session trong RAM de ho tro auto-scaling.

function configureSession() {
  const writeUri = process.env.MONGODB_WRITE_URI;
  const sessionSecret = process.env.SESSION_SECRET || 'fallback_secret_key';

  return session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: writeUri,
      collectionName: 'sessions',
      ttl: 24 * 60 * 60, // 1 day
      autoRemove: 'native'
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    }
  });
}

module.exports = configureSession;
