require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
// const nodemailer = require('nodemailer');
const path = require('path');

const app = express();

// Connect to MariaDB using environment variables
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306 // Default MariaDB port
});

// Test the database connection
db.connect((err) => {
    if (err) {
        console.error('Error connecting to MariaDB:', err.stack);
        return;
    }
    console.log('Connected to MariaDB as id', db.threadId);
});

// Middleware for parsing form data
app.use(bodyParser.urlencoded({ extended: true }));

// // Nodemailer setup (Gmail example)
// const transporter = nodemailer.createTransport({
//     service: 'gmail', // e.g., Gmail (you can use any SMTP service provider)
//     auth: {
//         user: '', // your email address
//         pass: '', // your email password (use app password for Gmail)
//     },
// });

// Middleware to serve static files (CSS, images, JS, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// Serve HTML pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/join', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'join.html'));
});
app.get('/thanks', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'thanks.html'));
});

// Handle form submission
app.post('/register', (req, res) => {
    const { name, age, gender, email, phone, ig_handle, tennis_level, personality_notes, misc_notes } = req.body;

    const ig_handle_clean = String(ig_handle).replace('@', '');
    const createdAt = new Date();

    const sql = `INSERT INTO applications_v1
                    (name, age, gender, email, phone, ig_handle, tennis_level, personality_notes, misc_notes, created_at)
                VALUES
                    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.query(sql, [name, age, gender, email, phone, ig_handle_clean, tennis_level, personality_notes, misc_notes, createdAt], (err, result) => {
        if (err) {
            console.error('Error inserting data:', err);
            res.status(500).send('An error occurred while processing your registration.');
        } else {
            res.redirect('/thanks');
        }
    });
});

// function sendEmail(email, name) {
//     const mailOptions = {
//         from: '',
//         to: email, // recipient email address (you can also send to a static address or admin)
//         subject: 'Registration Successful',
//         text: `${name} registered for Singles Playing Doubles`,
//     };

//     transporter.sendMail(mailOptions, (error, info) => {
//         if (error) {
//             console.error('Error sending email:', error);
//         } else {
//             console.log('Email sent:', info.response);
//         }
//     });
// }

// Start the server
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
