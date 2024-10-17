require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
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
    const { name, email, age, gender, ig_handle, skill, misc_notes } = req.body;

    const ig_handle_clean = String(ig_handle).replace('@', '');

    const sql = `INSERT INTO applications (name, email, age, gender, ig_handle, skill, misc_notes) VALUES (?, ?, ?, ?, ?, ?, ?)`;

    db.query(sql, [name, email, age, gender, ig_handle_clean, skill, misc_notes], (err, result) => {
        if (err) {
            console.error('Error inserting data:', err);
            res.status(500).send('An error occurred while processing your registration.');
        } else {
            res.redirect('/thanks');
        }
    });
});

// Start the server
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
