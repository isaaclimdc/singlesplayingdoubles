require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');

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

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Serve the registration form
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Handle form submission
app.post('/register', (req, res) => {
    const { name, email, age, skill, preferences } = req.body;

    const sql = `INSERT INTO users (name, email, age, skill, preferences) VALUES (?, ?, ?, ?, ?)`;

    db.query(sql, [name, email, age, skill, preferences], (err, result) => {
        if (err) {
            console.error('Error inserting data:', err);
            res.status(500).send('An error occurred while processing your registration.');
        } else {
            res.send('Registration successful! Thank you for joining.');
        }
    });
});

// Start the server
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
