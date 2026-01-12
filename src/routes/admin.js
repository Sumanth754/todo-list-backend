const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminAuthMiddleware = require('../middleware/adminAuthMiddleware'); // Add this line

router.post('/login', adminController.login);
router.get('/users', adminAuthMiddleware, adminController.getUsers); // Use new middleware
router.delete('/users/:id', adminAuthMiddleware, adminController.deleteUser); // Use new middleware

module.exports = router;
