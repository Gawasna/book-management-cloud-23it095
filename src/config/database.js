const mongoose = require('mongoose');

// Dual Connection Instances (Placeholder skeleton)
// readConnection: Ket noi bang tai khoan reader_23IT095 (Chi doc)
// writeConnection: Ket noi bang tai khoan writer_23IT095 (Doc & Ghi)

const readUri = process.env.MONGODB_READ_URI;
const writeUri = process.env.MONGODB_WRITE_URI;

const readConnection = mongoose.createConnection(readUri, {
  maxPoolSize: 10
});

const writeConnection = mongoose.createConnection(writeUri, {
  maxPoolSize: 10
});

readConnection.on('connected', () => {
  console.log('[Database] Read Connection established (reader_23IT095)');
});

writeConnection.on('connected', () => {
  console.log('[Database] Write Connection established (writer_23IT095)');
});

readConnection.on('error', (err) => {
  console.error('[Database Error - Read Connection]:', err.message);
});

writeConnection.on('error', (err) => {
  console.error('[Database Error - Write Connection]:', err.message);
});

module.exports = {
  readConnection,
  writeConnection
};
