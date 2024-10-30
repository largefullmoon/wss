const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
    host: '185.62.188.4',
    port: 465,
    secure: true,
    auth: {
        user: 'test@tonytest.top',
        pass: '(Y$f9}[,0)dy',
    },
    tls: {
        rejectUnauthorized: false
    }
});

// Email options
const mailOptions = {
    from: 'test@tonytest.top',
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