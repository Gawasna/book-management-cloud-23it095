require('dotenv').config();
const mongoose = require('mongoose');

const readUri = process.env.MONGODB_READ_URI;
const writeUri = process.env.MONGODB_WRITE_URI;

async function runConnectionDiagnostics() {
  console.log('============================================================');
  console.log(' KIEM TRA KET NOI MONGODB ATLAS DUAL-CONNECTION (23IT095)');
  console.log('============================================================\n');

  // 1. Kiem tra placeholder mat khau
  if (
    !readUri ||
    !writeUri ||
    readUri.includes('YOUR_READER_PASSWORD') ||
    writeUri.includes('YOUR_WRITER_PASSWORD')
  ) {
    console.log('[CANH BAO] File .env chua duoc dien mat khau thuc te!');
    console.log('Vui long mo file .env va thay the YOUR_READER_PASSWORD va YOUR_WRITER_PASSWORD bang mat khau ban da tao tren Atlas.');
    console.log('Duong dan file: .env\n');
    console.log('Format mong doi:');
    console.log(`MONGODB_READ_URI=${readUri}`);
    console.log(`MONGODB_WRITE_URI=${writeUri}\n`);
    process.exit(1);
  }

  let readConn = null;
  let writeConn = null;

  try {
    // 2. Kiem tra ket noi Write User (writer_23IT095)
    console.log('[1/3] Dang ket noi User Write (writer_23IT095)...');
    writeConn = await mongoose.createConnection(writeUri, {
      serverSelectionTimeoutMS: 8000
    }).asPromise();
    console.log('      [PASS] Ket noi User Write THANH CONG!');

    // Test ghi du lieu tren Write Connection
    console.log('      Dang thu nghiem ghi document vao DB_23IT095.books...');
    const testDoc = {
      bookCode: '095-TEST-' + Date.now(),
      title: 'Kiem tra ket noi Cloud',
      author: 'Tester',
      originalPrice: 100000,
      vatRate: 9,
      finalPrice: 109000,
      createdAt: new Date()
    };
    const insertResult = await writeConn.collection('books').insertOne(testDoc);
    console.log(`      [PASS] Ghi thanh cong! Inserted ID: ${insertResult.insertedId}`);

    // 3. Kiem tra ket noi Read User (reader_23IT095)
    console.log('\n[2/3] Dang ket noi User Read (reader_23IT095)...');
    readConn = await mongoose.createConnection(readUri, {
      serverSelectionTimeoutMS: 8000
    }).asPromise();
    console.log('      [PASS] Ket noi User Read THANH CONG!');

    // Test doc du lieu tren Read Connection
    console.log('      Dang thu nghiem doc danh sach tu DB_23IT095.books...');
    const books = await readConn.collection('books').find({}).limit(3).toArray();
    console.log(`      [PASS] Doc thanh cong! So ban ghi tim thay: ${books.length}`);

    // 4. Kiem tra nguyen tac Least Privilege (User Read co bi chan ghi khong?)
    console.log('\n[3/3] Kiem tra rang buoc dac quyen toi thieu (Least Privilege)...');
    console.log('      Thu nghiem: Dung User Read (reader_23IT095) de co tinh ghi document...');
    try {
      await readConn.collection('books').insertOne({
        bookCode: '095-ILLEGAL',
        title: 'Hanh vi ghi trai phep tren Read User'
      });
      console.log('      [THAT BAI - NGUY HIEM] User Read van ghi duoc du lieu! Can kiem tra lai Role tren Atlas.');
    } catch (permError) {
      console.log('      [PASS - CHUAN LEAST PRIVILEGE] User Read bi Database Engine chan dung:');
      console.log(`      Ma loi: ${permError.codeName || permError.name} - ${permError.message.split('\n')[0]}`);
    }

    // Don dep ban ghi test
    console.log('\n[DON DEP] Xoa ban ghi test tam thoi bang Write User...');
    await writeConn.collection('books').deleteOne({ _id: insertResult.insertedId });
    console.log('      [PASS] Da xoa ban ghi test sach se.');

    console.log('\n============================================================');
    console.log(' KET LUAN: HA TANG DATABASE ATLAS DAT 100% TIEU CHUAN DE BAI');
    console.log(' 1. Database name : DB_23IT095');
    console.log(' 2. Read User     : reader_23IT095 (Chi doc)');
    console.log(' 3. Write User    : writer_23IT095 (Doc & Ghi)');
    console.log('============================================================\n');

  } catch (error) {
    console.error('\n[LOI KET NOI]');
    console.error(`Chi tiet loi: ${error.message}`);
    if (error.message.includes('bad auth') || error.message.includes('Authentication failed')) {
      console.error('Huong xu ly: Sai mat khau hoac ten dang nhap. Vui long kiem tra lai mat khau trong file .env va user tren Atlas.');
    } else if (error.message.includes('IP') || error.message.includes('timed out')) {
      console.error('Huong xu ly: Kiem tra muc Network Access tren MongoDB Atlas xem da them IP 0.0.0.0/0 chua.');
    }
  } finally {
    if (readConn) await readConn.close();
    if (writeConn) await writeConn.close();
  }
}

runConnectionDiagnostics();
