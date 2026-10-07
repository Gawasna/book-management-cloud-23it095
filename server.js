require('dotenv').config();
const express = require('express');
const { engine } = require('express-handlebars');
const path = require('path');
const configureSession = require('./src/config/session');
const bookRoutes = require('./src/routes/bookRoutes');

const app = express();
const PORT = process.env.PORT || 34080;

// Trust reverse proxy (Render PaaS TLS termination)
app.set('trust proxy', 1);

// 1. Template Engine - Handlebars
app.engine('hbs', engine({
  extname: '.hbs',
  defaultLayout: 'main',
  layoutsDir: path.join(__dirname, 'src/views/layouts'),
  partialsDir: path.join(__dirname, 'src/views/partials'),
  helpers: {
    formatCurrency: (value) => new Intl.NumberFormat('vi-VN').format(value || 0),
    formatDate: (date) => {
      if (!date) return '';
      const d = new Date(date);
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  }
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'src/views'));

// 2. Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 3. Stateless Session Middleware (Cloud Atlas connect-mongo)
app.use(configureSession());

// 4. Global Template Variables (Truyen thong tin sinh vien & VAT vao moi view de hien Footer)
app.use((req, res, next) => {
  res.locals.studentName = process.env.STUDENT_NAME || 'Lê Phi Hùng';
  res.locals.studentId = process.env.STUDENT_ID || '23IT095';
  res.locals.vatRate = process.env.VAT_RATE || 9;
  next();
});

// 5. Routes
app.use('/', bookRoutes);

// 6. 404 Handler
app.use((req, res) => {
  res.status(404).render('index', {
    title: 'Không tìm thấy trang',
    errorMsg: 'Trang bạn yêu cầu không tồn tại!',
    books: []
  });
});

// 7. Start Server
app.listen(PORT, () => {
  console.log(` SERVER RUNNING: http://localhost:${PORT}`);
  console.log(` MSSV          : ${process.env.STUDENT_ID || '23IT095'}`);
  console.log(` VAT Rate      : ${process.env.VAT_RATE || 9}%`);
  console.log(` Cloud DB      : DB_${process.env.STUDENT_ID || '23IT095'}`);
});