const express = require('express');
const router = express.Router();
const invitationActionsController = require('../controllers/invitationActionsController');

// Routes for handling invitation actions directly from email links
// These routes do NOT use authMiddleware.verifyToken as they are accessed via email links
router.get('/:invitationId/accept/:token', invitationActionsController.acceptInvitation);
router.get('/:invitationId/decline/:token', invitationActionsController.declineInvitation);

module.exports = router;
