const dotenv = require('dotenv')
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
dotenv.config();

// Connect to MariaDB using environment variables
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MariaDB:', err.stack);
        return;
    }
    console.log('Connected to MariaDB as id', db.threadId);
});

// Middleware for parsing form data
app.use(bodyParser.urlencoded({ extended: true }));

// Nodemailer setup
const transporter = nodemailer.createTransport({
    host: process.env.SPD_EMAIL_HOST,
    port: process.env.SPD_EMAIL_PORT || 465,
    secure: true,
    auth: {
        user: process.env.SPD_EMAIL_USER,
        pass: process.env.SPD_EMAIL_PASS,
    },
});

// Middleware to serve static files (CSS, images, JS, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// Serve HTML pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/join', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'join.html'));
});
app.get('/join2', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'join2.html'));
});
app.get('/thanks', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'thanks.html'));
});

// Handle form submission
app.post('/register', (req, res) => {
    const { id, name, age, gender, email, phone, ig_handle, tennis_level, time_prefs, personality_notes, misc_notes } = req.body;

    // Define a applicant object
    const applicant = {
        name: name,
        age: age,
        gender: gender,
        email: email,
        phone: phone,
        igHandle: ig_handle,
        tennisLevel: tennis_level,
        timePrefs: time_prefs,
        personalityNotes: personality_notes,
        miscNotes: misc_notes,

        igHandleClean: function() {
            return String(this.igHandle).replace('@', '');
        },
    };

    const sql = `INSERT INTO applications_v1
                    (id, name, age, gender, email, phone, ig_handle, tennis_level, time_prefs, personality_notes, misc_notes)
                VALUES
                    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.query(sql, [
        uuidv4(),
        applicant.name,
        applicant.age,
        applicant.gender,
        applicant.email,
        applicant.phone,
        applicant.igHandleClean(),
        applicant.tennisLevel,
        applicant.timePrefs,
        applicant.personalityNotes,
        applicant.miscNotes,
    ], (err, result) => {
        if (err) {
            console.error('Error inserting data:', err);
            res.status(500).send('An error occurred while processing your registration.');
        } else {
            sendEmailToApplicant(applicant);
            sendEmailToOurselves(applicant);
            res.redirect('/thanks');
        }
    });
});

function sendEmailToApplicant(applicant) {
    let emailTemplate =
`
<!DOCTYPE html>
<html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 0;
                background-color: #f4f4f4;
            }
            .logo {
                max-width: 100px;
            }
            .email-container {
                width: 100%;
                max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
            }
            .header {
                background-color: #f9eede;
                background-image: url('https://singlesplayingdoubles.sg/images/background-faint.png');
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
                color: #333;
                text-align: center;
                padding: 20px;
                border-radius: 10px;
            }
            h1 {
                margin: 10px;
                font-size: 1.6em;
            }
            .content {
                padding: 60px 30px;
                color: #333;
            }
            p {
                margin: 0 0 20px 0;
                font-size: 1.0em;
                line-height: 1.5;
            }
            .button {
                display: inline-block;
                padding: 15px 30px;
                margin-top: 10px;
                background-color: #FF6347;
                color: white;
                text-decoration: none;
                border-radius: 5px;
                font-size: 1.0em;
                transition: background-color 0.3s ease;
            }
            .button:hover {
                background-color: #e55347;
            }
            .footer {
                background-color: #f4f4f4;
                padding: 20px;
                text-align: center;
                font-size: 0.8em;
                border-radius: 10px;
            }
            .footer a {
                color: #666;
                text-decoration: none;
            }
            .footer a:visited {
                color: #666;
            }
            .button a:visited {
                color: white;
            }
            @media (prefers-color-scheme: dark) {
                .header {
                    background-color: #7b7064;
                    background-image: url('https://singlesplayingdoubles.sg/images/background-faint-dark.jpg');
                    color: white;
                }
                .button {
                    background-color: #cf4a33;
                }
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <a href="https://singlesplayingdoubles.sg">
                    <img src="https://singlesplayingdoubles.sg/images/logo.png" alt="Singles Playing Doubles Logo" class="logo">
                </a>
                <h1>Thanks for signing up!</h1>
            </div>
            <div class="content">
                <p>Hi ${applicant.name}! </p>
                <p>
                    Thanks for signing up for Singles Playing Doubles. We're in the midst of finalising logistics, and
                    selecting the participants for "Season 1". We'll get back to you with an update.
                </p>
                <p>Chat soon!</p>
                <a href="https://www.instagram.com/singlesplayingdoubles/" class="button">Follow us</a>
            </div>
            <div class="footer">
                <a href="https://singlesplayingdoubles.sg">singlesplayingdoubles.sg</a>
            </div>
        </div>
    </body>
</html>
`;

    const mailOptions = {
        from: `"Singles Playing Doubles" <${process.env.SPD_EMAIL_USER}>`,
        to: applicant.email,
        subject: 'Thank you for registering!',
        html: emailTemplate,
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending email:', error);
        } else {
            console.log('Email sent:', info.response);
        }
    });
}

function sendEmailToOurselves(applicant) {
    let emailTemplate =
`
<!DOCTYPE html>
<html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {
                font-family: Arial, sans-serif;
                color: black;
                margin: 0;
                padding: 0;
            }
            h1 {
                font-size: 1.5em;
                margin-bottom: 40px;
            }
            h2 {
                font-size: 1.2em;
                margin: 0 0 10px 0;
            }
            p {
                margin: 0;
            }
            .box {
                margin: 30px 0;
            }
        </style>
    </head>
    <body>
        <h1>New sign up for Singles Playing Doubles!</h1>

        <div class="box">
            <h2>Name</h2>
            <p>${applicant.name}</p>
        </div>
        <div class="box">
            <h2>Age</h2>
            <p>${applicant.age}</p>
        </div>
        <div class="box">
            <h2>Gender</h2>
            <p>${applicant.gender}</p>
        </div>
        <div class="box">
            <h2>Email</h2>
            <p>${applicant.email}</p>
        </div>
        <div class="box">
            <h2>Phone</h2>
            <p>${applicant.phone}</p>
        </div>
        <div class="box">
            <h2>IG handle</h2>
            <a href="https://www.instagram.com/${applicant.igHandleClean()}">
                <p>${applicant.igHandleClean()}</p>
            </a>
        </div>
        <div class="box">
            <h2>Tennis level</h2>
            <p>${applicant.tennisLevel}</p>
        </div>
        <div class="box">
            <h2>Time preferences</h2>
            <p>${applicant.timePrefs}</p>
        </div>
        <div class="box">
            <h2>Personality notes</h2>
            <p>${applicant.personalityNotes}</p>
        </div>
        <div class="box">
            <h2>Misc notes</h2>
            <p>${applicant.miscNotes}</p>
        </div>
    </body>
</html>
`;

    const mailOptions = {
        from: `"Singles Playing Doubles" <${process.env.SPD_EMAIL_USER}>`,
        to: process.env.OURSELVES_EMAIL,
        subject: 'New sign up!',
        html: emailTemplate,
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending email:', error);
        } else {
            console.log('Email sent:', info.response);
        }
    });
}

// Start the server
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
