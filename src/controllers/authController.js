const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db'); // Import the SQLite db instance
const { sendWelcomeEmail } = require('../services/emailService');
const config = require('../config');

const register = (req, res) => {
    const { username, password, email } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 8);

    db.run('INSERT INTO users (username, password, email) VALUES (?, ?, ?)', [username, hashedPassword, email], function(err) {
        if (err) {
            console.error("Registration DB error:", err.message);
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).send('Username or Email already in use.');
            }
            return res.status(500).send('Server error');
        }
        
        sendWelcomeEmail(email, username).catch(err => {
            console.error("Failed to send welcome email:", err);
        });

        res.status(200).send('User registered successfully');
    });
};

const login = (req, res) => {
    const { username, password } = req.body;

    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            return res.status(500).send('Server error');
        }
        if (!user) {
            return res.status(404).send('User not found');
        }

        const passwordIsValid = bcrypt.compareSync(password, user.password);
        if (!passwordIsValid) {
            return res.status(401).send('Invalid password');
        }

        const token = jwt.sign({ id: user.id }, config.JWT_SECRET, {
            expiresIn: 86400 // 24 hours
        });

        res.status(200).send({
            auth: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });
    });
};

module.exports = {
    register,
    login,
};


