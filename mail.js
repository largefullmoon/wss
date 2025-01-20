const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: 'alerts@cotrax.io',
        pass: 'hadgyv-Kigzuj-1betci',
    },
    tls: {
        rejectUnauthorized: false
    }
});

// Email options
const mailOptions = {
    from: 'alerts@cotrax.io',
    to: 'largefullmoon@gmail.com',
    subject: 'Hello from Node.js!',
    text: 'Hello, this is a test email.',
    html: '<b>Hello, this is a test email.</b>',
};

// Send email
transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        return console.log('Error occurred:', error);
    }
    console.log('Email sent:', info.response);
});