const dotenv = require('dotenv')
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const { v4: uuidv4 } = require('uuid');
const { SitemapStream, streamToPromise } = require('sitemap');

const app = express();
const port = 3000;
dotenv.config();

// Connect to MariaDB with automatic management
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
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
app.get('/join/:id', (req, res) => {
    const applicationId = req.params.id;
    
    if (!applicationId) {
        return res.status(400).json({ error: 'id is required' });
    }

    getApplicationById(applicationId, (application, error, status_code) => {    
        res.render('join2', {
            error: error,
            application: application,
        });
    });    
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
        first_name,
        last_name,
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
        first_name: first_name,
        last_name: last_name,
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
            (id, first_name, last_name, age, gender, email, phone, ig_handle, tennis_level,
            time_prefs, personality_notes, misc_notes,
            utm_source, utm_medium, utm_campaign, referrer)
        VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(query, [
        application.id,
        application.first_name,
        application.last_name,
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

function getApplicationById(id, callback) {
    db.query('SELECT * FROM applications_v1 WHERE id = ?', [id], (err, queryRes) => {
        if (err) {
            console.error('Error fetching application:', err);
            callback(null, 'Database error', 500);
        } else {
            if (queryRes.length === 0) {
                callback(null, 'Sorry, application data not found', 404);
            } else {
                callback(queryRes[0], null, 200);
            }
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
    // Render the email template with EJS
    const rawEmailTemplate = fs.readFileSync(path.join(__dirname, 'email-conf.ejs'), 'utf-8');
    const emailTemplate = ejs.render(rawEmailTemplate, {
        application: application,
    });

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
    const subject = `${application.first_name} ${application.last_name} registered!`

    const rawEmailTemplate = fs.readFileSync(path.join(__dirname, 'email-us.ejs'), 'utf-8');
    const emailTemplate = ejs.render(rawEmailTemplate, {
        application: application,
        isNew: isNew,
    });

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
