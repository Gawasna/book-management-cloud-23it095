const mongoose = require('mongoose');
const { readConnection, writeConnection } = require('../config/database');

const bookSchema = new mongoose.Schema({
  bookCode: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  author: {
    type: String,
    required: true,
    trim: true
  },
  originalPrice: {
    type: Number,
    required: true,
    min: 0
  },
  vatRate: {
    type: Number,
    required: true
  },
  finalPrice: {
    type: Number,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Tuan thu Least Privilege:
// BookRead gan voi readConnection (chi doc)
// BookWrite gan voi writeConnection (doc & ghi)
const BookRead = readConnection.model('Book', bookSchema);
const BookWrite = writeConnection.model('Book', bookSchema);

module.exports = {
  BookRead,
  BookWrite
};
