const jwt = require('jsonwebtoken');
const config = require('../config');

const adminAuthMiddleware = (req, res, next) => {
    const token = req.headers['x-access-token'];

    if (!token) {
        return res.status(403).send('No token provided');
    }

    jwt.verify(token, config.JWT_SECRET, (err, decoded) => {
        if (err) {
            console.error('JWT verification error:', err.message);
            return res.status(401).send('Failed to authenticate token.');
        }
        
        // Ensure that the decoded token has an 'id' and that it is 'admin'
        if (decoded.id === 'admin') {
            req.userId = decoded.id; // Set req.userId for potential future use if needed
            next();
        } else {
            return res.status(403).send('Requires admin role');
        }
    });
};

module.exports = adminAuthMiddleware;
