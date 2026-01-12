const db = require('../db'); // Import the SQLite db instance
const jwt = require('jsonwebtoken');
const config = require('../config');

const login = (req, res) => {
    const { password } = req.body;

    // Trim quotes from the configured password in case they are included in the .env file
    const adminPassword = config.ADMIN_PASSWORD.replace(/^"|"$/g, '');

    if (password === adminPassword) {
        const token = jwt.sign({ id: 'admin' }, config.JWT_SECRET, {
            expiresIn: 86400 // 24 hours
        });
        res.status(200).send({ auth: true, token });
    } else {
        res.status(401).send('Invalid password');
    }
};

const getUsers = (req, res) => {
    db.all('SELECT id, username, email FROM users', [], (err, rows) => {
        if (err) {
            res.status(500).send('Server error');
        } else {
            res.status(200).json(rows);
        }
    });
};

const deleteUser = (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM users WHERE id = ?', [id], function(err) {
        if (err) {
            res.status(500).send('Server error');
        } else {
            res.status(200).send('User deleted successfully');
        }
    });
};

module.exports = {
    login,
    getUsers,
    deleteUser,
};

