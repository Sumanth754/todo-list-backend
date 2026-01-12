const db = require('../db'); // Import the SQLite db instance
const { sendTestEmail } = require('../services/emailService');

const getUserSettings = (req, res) => {
    const userId = req.userId; 

    db.get('SELECT email FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            console.error("Get user settings DB error:", err);
            return res.status(500).send('Server error');
        }
        if (!user) {
            return res.status(404).send('User not found');
        }
        res.status(200).json({
            email: user.email,
        });
    });
};

const handleSendTestEmail = async (req, res) => {
    const userId = req.userId;
    db.get('SELECT email FROM users WHERE id = ?', [userId], async (err, user) => {
        if (err || !user || !user.email) {
            console.error("Send test email error:", err || "User or email not found");
            return res.status(500).send('Could not retrieve user email');
        }
        try {
            await sendTestEmail(user.email);
            res.status(200).send('Test email sent successfully');
        } catch (emailError) {
            console.error("Failed to send test email:", emailError);
            res.status(500).send('Failed to send test email');
        }
    });
};

const searchUsers = (req, res) => {
    const { query } = req.query;
    const searcherId = req.userId;

    if (!query) {
        return res.status(400).send('Search query is required.');
    }

    const sql = `
        SELECT id, username, email
        FROM users
        WHERE username LIKE ? AND id != ?
        LIMIT 10
    `;
    db.all(sql, [`%${query}%`, searcherId], (err, users) => {
        if (err) {
            console.error('Error searching for users:', err);
            return res.status(500).send('Server error');
        }
        res.status(200).json(users);
    });
};

const getInvitations = (req, res) => {
    const userId = req.userId;

    const query = `
        SELECT
            i.id AS invitationId,
            i.teamId,
            t.name AS teamName,
            i.inviterId,
            u.username AS inviterUsername,
            i.status,
            i.description,
            i.createdAt
        FROM invitations i
        JOIN teams t ON i.teamId = t.id
        JOIN users u ON i.inviterId = u.id
        WHERE i.invitedUserId = ? AND i.status = 'pending'
    `;

    db.all(query, [userId], (err, invitations) => {
        if (err) {
            console.error('Error fetching invitations:', err);
            return res.status(500).send('Server error.');
        }
        res.status(200).json(invitations);
    });
};

module.exports = {
    getUserSettings,
    sendTestEmail: handleSendTestEmail,
    searchUsers,
    getInvitations,
};
