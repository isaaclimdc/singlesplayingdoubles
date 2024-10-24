const dotenv = require('dotenv')
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { SitemapStream, streamToPromise } = require('sitemap');

const app = express();
const port = 3000;
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

// Set the view engine to EJS
app.set('view engine', 'ejs');

// Middleware to serve static files (CSS, images, JS, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// Render the EJS files
app.get('/', (req, res) => {
    res.render('index');
});
app.get('/join', (req, res) => {
    res.render('join');
});
app.get('/pricing', (req, res) => {
    res.render('pricing');
});
app.get('/contact', (req, res) => {
    res.render('contact');
});
app.get('/join', (req, res) => {
    res.render('join');
});
app.get('/join2', (req, res) => {
    res.render('join2');
});
app.get('/thanks', (req, res) => {
    res.render('thanks');
});

app.get('/sitemap.xml', async (req, res) => {
    try {
        const sitemap = new SitemapStream({ hostname: 'https://singlesplayingdoubles.sg' });
        
        // Add URLs to the sitemap
        sitemap.write({ url: '/', changefreq: 'monthly', priority: 1.0 });
        sitemap.write({ url: '/join', changefreq: 'monthly', priority: 0.8 });
        sitemap.end();

        const xml = await streamToPromise(sitemap);
        res.header('Content-Type', 'application/xml');
        res.send(xml.toString());
    } catch (error) {
        console.error('Error generating sitemap:', error);
        res.status(500).send('Error generating sitemap');
    }
});

// Initial form submission
app.post('/submit-application', (req, res) => {
    const {
        id,
        name,
        age,
        gender,
        email,
        phone,
        ig_handle,
        tennis_level,
        time_prefs,
        personality_notes,
        misc_notes,
        utm_source,
        utm_medium,
        utm_campaign,
        referrer,
    } = req.body;

    // Define a application object
    const application = {
        id: uuidv4(),
        name: name,
        age: age,
        gender: gender,
        email: email,
        phone: phone,
        ig_handle: String(ig_handle).replace('@', ''),
        tennis_level: tennis_level,
        time_prefs: time_prefs,
        personality_notes: personality_notes,
        misc_notes: misc_notes,
        utm_source: utm_source,
        utm_medium: utm_medium,
        utm_campaign: utm_campaign,
        referrer: referrer,
    };

    const query = `
        INSERT INTO applications_v1
            (id, name, age, gender, email, phone, ig_handle, tennis_level, time_prefs, personality_notes, misc_notes,
            utm_source, utm_medium, utm_campaign, referrer)
        VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(query, [
        application.id,
        application.name,
        application.age,
        application.gender,
        application.email,
        application.phone,
        application.ig_handle,
        application.tennis_level,
        application.time_prefs,
        application.personality_notes,
        application.misc_notes,
        application.utm_source,
        application.utm_medium,
        application.utm_campaign,
        application.referrer,
    ], (err, queryRes) => {
        if (err) {
            console.error('Error inserting data:', err);
            res.status(500).send('An error occurred while processing your registration.');
        } else {
            sendEmailToApplicant(application);
            sendEmailToOurselves(application, true);
            res.redirect('/thanks');
        }
    });
});

// Route to get application data by ID (for pre-filling the form)
app.get('/get-application', async (req, res) => {
    const { id } = req.query;
    
    if (!id) {
        return res.status(400).json({ error: 'id is required' });
    }

    getApplicationById(id, (application, error, status_code) => {
        if (error) {
            return res.status(status_code).json({ error });
        }
    
        res.json(application);
    });
});

function getApplicationById(id, callback) {
    db.query('SELECT * FROM applications_v1 WHERE id = ?', [id], (err, queryRes) => {
        if (err) {
            console.error('Error fetching application:', err);
            callback(null, 'Database error', 500);
        } else {
            if (queryRes.length === 0) {
                callback(null, 'Application not found', 404);
            }
            callback(queryRes[0], null, 200);
        }
    });
}

// Route to update the application data
app.post('/update-application', async (req, res) => {
    const { application_id, time_prefs, personality_notes, misc_notes } = req.body;

    const query = `
        UPDATE applications_v1
        SET time_prefs = ?, personality_notes = ?, misc_notes = ?
        WHERE id = ?
    `;

    db.query(query, [time_prefs, personality_notes, misc_notes, application_id], (err, queryRes) => {
        if (err) {
            console.error('Error updating application:', err);
            res.status(500).json({ error: 'Database update failed' });
        } else {
            getApplicationById(application_id, (application, error, status_code) => {           
                sendEmailToOurselves(application, false);
                res.redirect('/thanks');
            });
        }
    });
});

function sendEmailToApplicant(application) {
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
                margin: 0;
            }
            .email-container {
                width: 100%;
                max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
            }
            .header {
                background-color: #003c51;
                background-image: url('https://singlesplayingdoubles.sg/images/bkg-blue-court.jpg');
                background-size: 100% auto;
                background-position: top 30% center;
                background-repeat: no-repeat;
                color: #f1f1f1;;
                text-align: center;
                padding: 32px;
                border-radius: 16px;
            }
            h1 {
                margin: 16px 0 0 0;
                font-size: 1.8em;
            }
            .content {
                padding: 32px;
                color: #333;
            }
            p {
                padding: 8px 0;
                margin: 0;
                font-size: 1.0em;
                line-height: 1.5;
            }
            p:first-child {
                padding: 0 0 8px 0;
            }
            p:last-child {
                padding: 8px 0 0 0;
            }
            .button {
                display: inline-block;
                padding: 16px 24px;
                margin: 16px 0;
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
                padding: 16px;
                text-align: center;
                font-size: 0.8em;
                border-radius: 16px;
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
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <a href="https://singlesplayingdoubles.sg">
                    <img src="https://singlesplayingdoubles.sg/images/logo.png" alt="Singles Playing Doubles Logo" class="logo">
                </a>
                <h1>Thanks for registering!</h1>
            </div>
            <div class="content">
                <p>Hi ${application.name}, </p>
                <p>
                    Thanks for registering for Singles Playing Doubles! We're in the midst of finalising logistics, and
                    selecting the participants for the upcoming season. Please hang tight, and we'll get back to you with
                    an update soon.
                </p>
                <p>
                    In the meanwhile, please follow us on Instagram!
                </p>
                <a href="https://www.instagram.com/singlesplayingdoubles/" class="button">Follow us</a>
                <p>
                    Oh and by the way, use <a href="https://singlesplayingdoubles.sg/join2?id=${application.id}">this link</a>
                    to update responses in your application. Note that this link is unique to you, so please don't send it to others!
                </p>
                
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
        to: application.email,
        subject: 'Thanks for registering!',
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

function sendEmailToOurselves(application, isNew) {
    const subject = `${application.name} registered!`
    if (isNew) {
        title = `New registration from ${application.name}!`
    } else {
        title = `${application.name}'s updated application`
    }

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
                padding: 16px 0;
                margin: 0
            }
            h2 {
                font-size: 1.2em;
                padding: 0 0 4px 0;
                margin: 0
            }
            p {
                padding: 4px 0 0 0;
                margin: 0;
            }
            .box {
                padding: 16px 0;
                margin: 0;
            }
        </style>
    </head>
    <body>
        <h1>${title}</h1>

        <div class="box">
            <h2>Name</h2>
            <p>${application.name}</p>
        </div>
        <div class="box">
            <h2>Age</h2>
            <p>${application.age}</p>
        </div>
        <div class="box">
            <h2>Gender</h2>
            <p>${application.gender}</p>
        </div>
        <div class="box">
            <h2>Email</h2>
            <p>${application.email}</p>
        </div>
        <div class="box">
            <h2>Phone</h2>
            <p>${application.phone}</p>
        </div>
        <div class="box">
            <h2>IG handle</h2>
            <a href="https://www.instagram.com/${application.ig_handle}">
                <p>${application.ig_handle}</p>
            </a>
        </div>
        <div class="box">
            <h2>Tennis level</h2>
            <p>${application.tennis_level}</p>
        </div>
        <div class="box">
            <h2>Time preferences</h2>
            <p>${application.time_prefs}</p>
        </div>
        <div class="box">
            <h2>Personality notes</h2>
            <p>${application.personality_notes}</p>
        </div>
        <div class="box">
            <h2>Misc notes</h2>
            <p>${application.misc_notes}</p>
        </div>
        <div class="box">
            <h2>UTM source</h2>
            <p>${application.utm_source}</p>
        </div>
        <div class="box">
            <h2>UTM medium</h2>
            <p>${application.utm_medium}</p>
        </div>
        <div class="box">
            <h2>UTM campaign</h2>
            <p>${application.utm_campaign}</p>
        </div>
        <div class="box">
            <h2>Referrer</h2>
            <p>${application.referrer}</p>
        </div>
    </body>
</html>
`;

    const mailOptions = {
        from: `"Singles Playing Doubles" <${process.env.SPD_EMAIL_USER}>`,
        to: process.env.OURSELVES_EMAIL,
        subject: subject,
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
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
