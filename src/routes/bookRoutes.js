const express = require('express');
const router = express.Router();
const bookController = require('../controllers/bookController');

router.get('/', bookController.getBooks);
router.post('/books', bookController.createBook);
router.post('/books/add', bookController.createBook);
router.post('/books/update', bookController.updateBook);
router.post('/books/delete', bookController.deleteBook);
router.get('/books/add', bookController.getAddBookForm);

module.exports = router;
