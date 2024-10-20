require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const fetch = require('node-fetch');
const FormData = require('form-data');

const app = express();
const port = 5000;

console.log(process.env.GOTENBERG_URL);

// เชื่อมต่อกับ PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// ตั้งค่า middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true
}));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware ตรวจสอบการ login
const requireLogin = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/login');
  }
};

app.get('/', requireLogin, async (req, res) => {
  res.redirect('/invoice')
});

// หน้า Login
app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query(`SELECT * FROM users WHERE email = '${email}'`);

    if (result.rows.length > 0) {
      const user = result.rows[0];
      if (await bcrypt.compare(password, user.hashed_password)) {
        req.session.userId = user.id;
        req.session.userRole = user.role;
        res.redirect('/invoice');
      } else {
        res.render('login', { error: 'Invalid credentials' });
      }
    } else {
      res.render('login', { error: 'User not found' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.render('login', { error: 'An error occurred' });
  }
});

// หน้า Invoice form
app.get('/invoice', requireLogin, (req, res) => {
  res.render('invoice');
});

// สร้าง PDF จาก Invoice
app.post('/generate-invoice', requireLogin, async (req, res) => {
  try {
    const { customerName, amount, dueDate } = req.body;
    const htmlContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8" />
              <title>Tax Invoice</title>
              <link rel="shortcut icon" type="image/png" href="./favicon.png" />
              <style>
                * {
                  box-sizing: border-box;
                }

                .table-bordered td,
                .table-bordered th {
                  border: 1px solid #ddd;
                  padding: 10px;
                  word-break: break-all;
                }

                body {
                  font-family: Arial, Helvetica, sans-serif;
                  margin: 0;
                  padding: 0;
                  font-size: 16px;
                }
                .h4-14 h4 {
                  font-size: 12px;
                  margin-top: 0;
                  margin-bottom: 5px;
                }
                .img {
                  margin-left: "auto";
                  margin-top: "auto";
                  height: 30px;
                }
                pre,
                p {
                  /* width: 99%; */
                  /* overflow: auto; */
                  /* bpicklist: 1px solid #aaa; */
                  padding: 0;
                  margin: 0;
                }
                table {
                  font-family: arial, sans-serif;
                  width: 100%;
                  border-collapse: collapse;
                  padding: 1px;
                }
                .hm-p p {
                  text-align: left;
                  padding: 1px;
                  padding: 5px 4px;
                }
                td,
                th {
                  text-align: left;
                  padding: 8px 6px;
                }
                .table-b td,
                .table-b th {
                  border: 1px solid #ddd;
                }
                th {
                  /* background-color: #ddd; */
                }
                .hm-p td,
                .hm-p th {
                  padding: 3px 0px;
                }
                .cropped {
                  float: right;
                  margin-bottom: 20px;
                  height: 100px; /* height of container */
                  overflow: hidden;
                }
                .cropped img {
                  width: 400px;
                  margin: 8px 0px 0px 80px;
                }
                .main-pd-wrapper {
                  box-shadow: 0 0 10px #ddd;
                  background-color: #fff;
                  border-radius: 10px;
                  padding: 15px;
                }
                .table-bordered td,
                .table-bordered th {
                  border: 1px solid #ddd;
                  padding: 10px;
                  font-size: 14px;
                }
                .invoice-items {
                  font-size: 14px;
                  border-top: 1px dashed #ddd;
                }
                .invoice-items td{
                  padding: 14px 0;
                }
              </style>
            </head>
            <body>
              <section class="main-pd-wrapper" style="width: 450px; margin: auto">
                <div style="
                            text-align: center;
                            margin: auto;
                            line-height: 1.5;
                            font-size: 14px;
                            color: #4a4a4a;
                          ">
                          <p style="font-weight: bold; color: #000; margin-top: 15px; font-size: 18px;">
                            ใบแจ้งหนี้
                          </p>
                          <p style="margin: 15px auto;">
                            A2, Test Street <br>
                            Test Area 65536, Bytes overflow
                          </p>
                          <p>
                            <b>Customer:</b> ${customerName}
                          </p>
                          <p>
                            <b>Due Date:</b> ${dueDate}
                          </p>
                          <hr style="border: 1px dashed rgb(131, 131, 131); margin: 25px auto">
                        </div>
                        <table style="width: 100%; table-layout: fixed">
                          <thead>
                            <tr>
                              <th style="width: 50px; padding-left: 0;">Sn.</th>
                              <th style="width: 220px;">Item Name</th>
                              <th>QTY</th>
                              <th style="text-align: right; padding-right: 0;">Price</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr class="invoice-items">
                              <td>01</td>
                              <td >Some Secret Item</td>
                              <td>1 PC</td>
                              <td style="text-align: right;">฿ ${amount}</td>
                            </tr>               
                          </tbody>
                        </table>

                        <table style="width: 100%;
                        background: #fcbd024f;
                        border-radius: 4px;">
                          <thead>
                            <tr>
                              <th>Total</th>
                              <th style="text-align: center;">Item (1)</th>
                              <th>&nbsp;</th>
                              <th style="text-align: right;">฿ ${amount}</th>
                            </tr>
                          </thead>
                        </table>
              </section>
            </body>
          </html>
    `;

    const form = new FormData();
    form.append('index.html', htmlContent, { filename: 'index.html' });

    const response = await fetch(`${process.env.GOTENBERG_URL}/convert/html`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const pdfBuffer = await response.buffer();

    res.contentType('application/pdf');
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).send('Error generating PDF');
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});