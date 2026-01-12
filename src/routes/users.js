const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/settings', authMiddleware.verifyToken, userController.getUserSettings);
router.post('/test-email', authMiddleware.verifyToken, userController.sendTestEmail);
router.get('/search', authMiddleware.verifyToken, userController.searchUsers);
router.get('/me/invitations', authMiddleware.verifyToken, userController.getInvitations);

module.exports = router;
