const { BookRead, BookWrite } = require('../models/Book');

// Helper truy vấn và định dạng danh sách sách qua Read Connection (reader_23IT095)
async function getFormattedBooks() {
  const rawBooks = await BookRead.find().sort({ createdAt: -1 }).lean();
  return rawBooks.map((book) => {
    const d = new Date(book.createdAt);
    const pad = (n) => String(n).padStart(2, '0');
    const formattedDate = !isNaN(d.getTime())
      ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
      : '';

    return {
      ...book,
      formattedDate,
      formattedOriginalPrice: new Intl.NumberFormat('vi-VN').format(book.originalPrice || 0),
      formattedFinalPrice: new Intl.NumberFormat('vi-VN').format(book.finalPrice || 0)
    };
  });
}

// Helper render view bàn làm việc với đúng HTTP Status Code (200, 400, 500)
async function renderWorkbench(req, res, statusCode = 200, options = {}) {
  try {
    const books = await getFormattedBooks();
    return res.status(statusCode).render('index', {
      title: 'Quản Lý Sách',
      books,
      bookCount: books.length,
      sessionViews: req.session ? req.session.views : 1,
      requiredPrefix: process.env.STUDENT_MSSV_LAST3 || '095',
      vatRate: process.env.VAT_RATE || 9,
      successMsg: options.successMsg || (req.session ? req.session.successMsg : null),
      errorMsg: options.errorMsg || (req.session ? req.session.errorMsg : null)
    });
  } catch (error) {
    console.error('[renderWorkbench Error]:', error.message);
    return res.status(500).render('index', {
      title: 'Quản Lý Sách',
      books: [],
      bookCount: 0,
      sessionViews: req.session ? req.session.views : 1,
      requiredPrefix: process.env.STUDENT_MSSV_LAST3 || '095',
      vatRate: process.env.VAT_RATE || 9,
      errorMsg: 'Lỗi nạp dữ liệu: ' + error.message
    });
  }
}

// 1. GET / - Bàn làm việc quản lý sách F-Pattern
exports.getBooks = async (req, res) => {
  // Đếm lượt truy cập phiên làm việc qua Stateless Cloud Session
  req.session.views = (req.session.views || 0) + 1;

  const successMsg = req.session.successMsg;
  const errorMsg = req.session.errorMsg;
  req.session.successMsg = null;
  req.session.errorMsg = null;

  return await renderWorkbench(req, res, 200, { successMsg, errorMsg });
};

exports.getAddBookForm = (req, res) => {
  res.redirect('/');
};

// 2. POST /books & POST /books/add - Ghi sách mới qua Write Connection (writer_23IT095)
exports.createBook = async (req, res) => {
  try {
    let { bookCode, title, author, originalPrice, bookCodePrefix, bookCodeSuffix } = req.body;
    const requiredPrefix = process.env.STUDENT_MSSV_LAST3 || '095';
    const vatRate = Number(process.env.VAT_RATE || 9);

    // Tự động thêm dấu gạch ngang nếu người dùng nhập 2 trường tiền tố và hậu tố
    if (bookCodePrefix && bookCodeSuffix) {
      const p = bookCodePrefix.trim();
      const s = bookCodeSuffix.trim().replace(/^-+/, '');
      bookCode = `${p}-${s}`;
    } else if (!bookCode && bookCodePrefix) {
      bookCode = bookCodePrefix.trim();
    } else if (bookCode) {
      bookCode = bookCode.trim();
    }

    // Kiểm tra tiền tố bắt buộc 3 số cuối MSSV -> Trả về thẳng HTTP 400 Bad Request
    if (!bookCode || !bookCode.startsWith(requiredPrefix)) {
      return await renderWorkbench(req, res, 400, {
        errorMsg: `Mã sách phải bắt đầu bằng '${requiredPrefix}'.`
      });
    }

    const parsedPrice = Number(originalPrice);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return await renderWorkbench(req, res, 400, {
        errorMsg: 'Giá sách không hợp lệ.'
      });
    }

    const finalPrice = Math.round(parsedPrice * (1 + vatRate / 100));

    // Lưu qua Write Connection (writer_23IT095)
    const newBook = new BookWrite({
      bookCode: bookCode.trim(),
      title: title.trim(),
      author: author.trim(),
      originalPrice: parsedPrice,
      vatRate,
      finalPrice
    });

    await newBook.save();
    req.session.successMsg = `Đã thêm sách '${title}'.`;
    res.redirect('/');
  } catch (error) {
    console.error('[createBook Error]:', error.message);
    let msg = error.message;
    if (error.code === 11000) {
      msg = 'Mã sách đã tồn tại.';
    }
    return await renderWorkbench(req, res, 400, {
      errorMsg: 'Lỗi lưu sách: ' + msg
    });
  }
};

// 3. POST /books/update - Cập nhật sách qua Write Connection (writer_23IT095)
exports.updateBook = async (req, res) => {
  try {
    let { id, bookCode, title, author, originalPrice, bookCodePrefix, bookCodeSuffix } = req.body;
    const requiredPrefix = process.env.STUDENT_MSSV_LAST3 || '095';
    const vatRate = Number(process.env.VAT_RATE || 9);

    if (!id) {
      return await renderWorkbench(req, res, 400, {
        errorMsg: 'Không tìm thấy định danh sách để cập nhật.'
      });
    }

    // Tự động thêm dấu gạch ngang nếu người dùng nhập 2 trường tiền tố và hậu tố
    if (bookCodePrefix && bookCodeSuffix) {
      const p = bookCodePrefix.trim();
      const s = bookCodeSuffix.trim().replace(/^-+/, '');
      bookCode = `${p}-${s}`;
    } else if (!bookCode && bookCodePrefix) {
      bookCode = bookCodePrefix.trim();
    } else if (bookCode) {
      bookCode = bookCode.trim();
    }

    // Kiểm tra tiền tố bắt buộc 3 số cuối MSSV -> Trả về thẳng HTTP 400 Bad Request
    if (!bookCode || !bookCode.startsWith(requiredPrefix)) {
      return await renderWorkbench(req, res, 400, {
        errorMsg: `Mã sách phải bắt đầu bằng '${requiredPrefix}'.`
      });
    }

    const parsedPrice = Number(originalPrice);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return await renderWorkbench(req, res, 400, {
        errorMsg: 'Giá sách không hợp lệ.'
      });
    }

    // Server tự động tính lại giá sau thuế trước khi cập nhật
    const finalPrice = Math.round(parsedPrice * (1 + vatRate / 100));

    await BookWrite.findByIdAndUpdate(id, {
      bookCode: bookCode.trim(),
      title: title.trim(),
      author: author.trim(),
      originalPrice: parsedPrice,
      vatRate,
      finalPrice
    });

    req.session.successMsg = `Đã cập nhật sách '${title}'.`;
    res.redirect('/');
  } catch (error) {
    console.error('[updateBook Error]:', error.message);
    let msg = error.message;
    if (error.code === 11000) {
      msg = 'Mã sách này đã bị trùng lặp.';
    }
    return await renderWorkbench(req, res, 400, {
      errorMsg: 'Lỗi cập nhật: ' + msg
    });
  }
};

// 4. POST /books/delete - Xóa sách qua Write Connection (writer_23IT095)
exports.deleteBook = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return await renderWorkbench(req, res, 400, {
        errorMsg: 'Không tìm thấy định danh sách để xóa.'
      });
    }

    await BookWrite.findByIdAndDelete(id);
    req.session.successMsg = 'Đã xóa sách khỏi Cloud Atlas.';
    res.redirect('/');
  } catch (error) {
    console.error('[deleteBook Error]:', error.message);
    return await renderWorkbench(req, res, 500, {
      errorMsg: 'Lỗi xóa sách: ' + error.message
    });
  }
};
