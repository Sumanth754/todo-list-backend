const db = require('../db');
const jwt = require('jsonwebtoken');
const config = require('../config');

const handleInvitationAction = (action) => (req, res) => {
    const { invitationId, token } = req.params;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    jwt.verify(token, config.JWT_SECRET, async (err, decoded) => {
        if (err) {
            console.error(`JWT verification error for ${action} invitation:`, err.message);
            // Redirect to the login page
            return res.redirect(`${frontendUrl}/login`);
        }

        if (decoded.invitationId !== parseInt(invitationId)) {
            // Redirect to the login page
            return res.redirect(`${frontendUrl}/login`);
        }

        try {
            // Fetch invitation details
            const invitation = await new Promise((resolve, reject) => {
                db.get('SELECT * FROM invitations WHERE id = ?', [invitationId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!invitation) {
                return res.redirect(`${frontendUrl}/login`);
            }

            if (invitation.status !== 'pending') {
                return res.redirect(`${frontendUrl}/login`);
            }

            if (action === 'accept') {
                // Check if user is already a member
                const isMember = await new Promise((resolve, reject) => {
                    db.get('SELECT 1 FROM team_members WHERE teamId = ? AND userId = ?', [invitation.teamId, invitation.invitedUserId], (err, row) => {
                        if (err) reject(err);
                        else resolve(!!row);
                    });
                });

                if (!isMember) {
                    await new Promise((resolve, reject) => {
                        db.run('INSERT INTO team_members (teamId, userId) VALUES (?, ?)', [invitation.teamId, invitation.invitedUserId], function (err) {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                }
            }

            // Update invitation status
            await new Promise((resolve, reject) => {
                db.run('UPDATE invitations SET status = ? WHERE id = ?', [action, invitationId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            res.redirect(`${frontendUrl}/login`);

        } catch (error) {
            console.error(`Error handling invitation ${action}:`, error);
            res.redirect(`${frontendUrl}/login`);
        }
    });
};

module.exports = {
    acceptInvitation: handleInvitationAction('accepted'),
    declineInvitation: handleInvitationAction('declined'),
};
