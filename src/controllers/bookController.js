const { BookRead, BookWrite } = require('../models/Book');

// 1. GET / - Bàn làm việc quản lý sách F-Pattern tích hợp
exports.getBooks = async (req, res) => {
  try {
    // Đếm lượt truy cập phiên làm việc qua Stateless Cloud Session
    req.session.views = (req.session.views || 0) + 1;

    // Truy vấn dữ liệu qua Read-Only Connection (reader_23IT095)
    const rawBooks = await BookRead.find().sort({ createdAt: -1 }).lean();

    // Định dạng gọn gàng ngày giờ và tiền tệ trước khi render
    const books = rawBooks.map((book) => {
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

    res.render('index', {
      title: 'Quản Lý Sách',
      books,
      bookCount: books.length,
      sessionViews: req.session.views,
      requiredPrefix: process.env.STUDENT_MSSV_LAST3 || '095',
      vatRate: process.env.VAT_RATE || 9,
      successMsg: req.session.successMsg,
      errorMsg: req.session.errorMsg
    });

    req.session.successMsg = null;
    req.session.errorMsg = null;
  } catch (error) {
    console.error('[getBooks Error]:', error.message);
    res.status(500).render('index', {
      title: 'Quản Lý Sách',
      errorMsg: 'Lỗi tải dữ liệu: ' + error.message,
      books: [],
      bookCount: 0,
      sessionViews: req.session.views || 1,
      requiredPrefix: process.env.STUDENT_MSSV_LAST3 || '095',
      vatRate: process.env.VAT_RATE || 9
    });
  }
};

// 2. GET /books/add - Chuyển hướng về bàn làm việc duy nhất
exports.getAddBookForm = (req, res) => {
  res.redirect('/');
};

// 3. POST /books & POST /books/add - Ghi sách mới qua Write Connection (writer_23IT095)
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

    // Kiểm tra tiền tố bắt buộc 3 số cuối MSSV
    if (!bookCode || !bookCode.startsWith(requiredPrefix)) {
      req.session.errorMsg = `Mã sách phải bắt đầu bằng '${requiredPrefix}'.`;
      return res.status(400).redirect('/');
    }

    const parsedPrice = Number(originalPrice);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      req.session.errorMsg = 'Giá sách không hợp lệ.';
      return res.status(400).redirect('/');
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
    req.session.errorMsg = 'Lỗi lưu sách: ' + msg;
    res.status(400).redirect('/');
  }
};

// 4. POST /books/update - Cập nhật sách qua Write Connection (writer_23IT095)
exports.updateBook = async (req, res) => {
  try {
    let { id, bookCode, title, author, originalPrice, bookCodePrefix, bookCodeSuffix } = req.body;
    const requiredPrefix = process.env.STUDENT_MSSV_LAST3 || '095';
    const vatRate = Number(process.env.VAT_RATE || 9);

    if (!id) {
      req.session.errorMsg = 'Không tìm thấy định danh sách để cập nhật.';
      return res.status(400).redirect('/');
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

    if (!bookCode || !bookCode.startsWith(requiredPrefix)) {
      req.session.errorMsg = `Mã sách phải bắt đầu bằng '${requiredPrefix}'.`;
      return res.status(400).redirect('/');
    }

    const parsedPrice = Number(originalPrice);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      req.session.errorMsg = 'Giá sách không hợp lệ.';
      return res.status(400).redirect('/');
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
    req.session.errorMsg = 'Lỗi cập nhật: ' + msg;
    res.status(400).redirect('/');
  }
};

// 5. POST /books/delete - Xóa sách qua Write Connection (writer_23IT095)
exports.deleteBook = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      req.session.errorMsg = 'Không tìm thấy định danh sách để xóa.';
      return res.status(400).redirect('/');
    }

    await BookWrite.findByIdAndDelete(id);
    req.session.successMsg = 'Đã xóa sách khỏi Cloud Atlas.';
    res.redirect('/');
  } catch (error) {
    console.error('[deleteBook Error]:', error.message);
    req.session.errorMsg = 'Lỗi xóa sách: ' + error.message;
    res.status(400).redirect('/');
  }
};
