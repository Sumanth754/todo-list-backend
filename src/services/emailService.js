const nodemailer = require('nodemailer');
require('dotenv').config();
const jwt = require('jsonwebtoken'); // Import jsonwebtoken
const config = require('../config'); // Import config to get JWT_SECRET

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const sendReminderEmail = async (toEmail, task) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: toEmail,
            subject: `Reminder: Your Task "${task.heading}" is Due Soon!`,
            html: `
                <p>Hello,</p>
                <p>This is a friendly reminder that your task:</p>
                <h3>${task.heading}</h3>
                <p><strong>Subject:</strong> ${task.subject}</p>
                <p><strong>Explanation:</strong> ${task.explanation}</p>
                <p><strong>Due Date:</strong> ${task.day}</p>
                <p>Please make sure to complete it on time.</p>
                <p>Best regards,</p>
                <p>Your Todo List App</p>
            `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`Reminder email sent to ${toEmail} for task: "${task.heading}"`);
        return { success: true, message: 'Email sent' };
    } catch (error) {
        console.error(`Error sending reminder email to ${toEmail} for task "${task.heading}":`, error);
        return { success: false, message: error.message };
    }
};

const sendTestEmail = async (toEmail) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: toEmail,
            subject: 'Test Email from To-Do List App',
            html: `<p>Success! Your email settings are configured correctly.</p>`,
        };
        await transporter.sendMail(mailOptions);
        return { success: true, message: 'Test email sent' };
    } catch (error) {
        console.error(`Error sending test email to ${toEmail}:`, error);
        return { success: false, message: error.message };
    }
};

const sendWelcomeEmail = async (toEmail, username) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: toEmail,
            subject: 'Welcome to Your To-Do List App!',
            html: `
                <p>Hello ${username},</p>
                <p>Thank you for registering with our To-Do List application.</p>
                <p>We're excited to have you on board. Start organizing your tasks and be more productive today!</p>
                <p>Best regards,</p>
                <p>Your Todo List App</p>
            `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`Welcome email sent to ${toEmail}`);
        return { success: true, message: 'Welcome email sent' };
    } catch (error) {
        console.error(`Error sending welcome email to ${toEmail}:`, error);
        return { success: false, message: error.message };
    }
};

const sendInvitationEmail = async (toEmail, inviterUsername, teamName, description, invitationId) => {
    try {
        const actionToken = jwt.sign({ invitationId: invitationId }, config.JWT_SECRET, { expiresIn: '1d' });
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
        const acceptUrl = `${backendUrl}/api/invitations/${invitationId}/accept/${actionToken}`;
        const declineUrl = `${backendUrl}/api/invitations/${invitationId}/decline/${actionToken}`;

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: toEmail,
            subject: `Team Invitation: ${inviterUsername} invited you to join ${teamName}`,
            html: `
                <p>Hello,</p>
                <p>You have been invited by <strong>${inviterUsername}</strong> to join the team: <strong>${teamName}</strong>!</p>
                ${description ? `<p><strong>Message from inviter:</strong><br>${description}</p>` : ''}
                <p>To accept or decline this invitation, please click on one of the links below:</p>
                <p>
                    <a href="${acceptUrl}" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Accept Invitation</a>
                    <a href="${declineUrl}" style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-left: 10px;">Decline Invitation</a>
                </p>
                <p>This invitation link will expire in 24 hours.</p>
                <p>Best regards,</p>
                <p>Your Todo List App</p>
            `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`Invitation email sent to ${toEmail} for team: ${teamName}`);
        return { success: true, message: 'Invitation email sent' };
    } catch (error) {
        console.error(`Error sending invitation email to ${toEmail} for team ${teamName}:`, error);
        return { success: false, message: error.message };
    }
};


module.exports = {
    sendReminderEmail,
    sendTestEmail,
    sendWelcomeEmail,
    sendInvitationEmail,
};

