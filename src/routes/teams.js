const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const authMiddleware = require('../middleware/authMiddleware');

// All team routes require a valid user token
router.use(authMiddleware.verifyToken);

// Get all teams for the logged-in user
router.get('/', teamController.getMyTeams);

// Create a new team
router.post('/', teamController.createTeam);

// Get all members of a specific team
router.get('/:teamId/members', teamController.getTeamMembers);

// Add a member to a team (deprecated for direct add, will be used by invitations)
router.post('/:teamId/members', teamController.addTeamMember);

// Invite a user to a team
router.post('/:teamId/invite', teamController.inviteMember);

// Accept an invitation
router.put('/invitations/:invitationId/accept', teamController.acceptInvitation);

// Decline an invitation
router.put('/invitations/:invitationId/decline', teamController.declineInvitation);

// Remove a member from a team (also used for leaving team)
router.delete('/:teamId/members/:userId', teamController.removeTeamMember);

// Delete a team (owner only)
router.delete('/:teamId', teamController.deleteTeam);

module.exports = router;
