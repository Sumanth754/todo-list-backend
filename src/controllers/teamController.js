const db = require('../db'); // Import the SQLite db instance
const { sendInvitationEmail } = require('../services/emailService'); // Import sendInvitationEmail

// Get all teams a user belongs to
const getMyTeams = (req, res) => {
    const userId = req.userId;
    const query = `
        SELECT id, name, ownerId, 1 AS isOwner
        FROM teams
        WHERE ownerId = ?
        UNION
        SELECT t.id, t.name, t.ownerId, 0 AS isOwner
        FROM teams t
        JOIN team_members tm ON t.id = tm.teamId
        WHERE tm.userId = ? AND t.ownerId != ?
    `;
    db.all(query, [userId, userId, userId], (err, teams) => {
        if (err) {
            console.error('Error fetching user teams:', err);
            return res.status(500).send('Server error');
        }
        // Sort by id for consistent ordering, or by name
        teams.sort((a, b) => a.id - b.id);
        res.status(200).json(teams);
    });
};

// Create a new team
const createTeam = (req, res) => {
    const { name } = req.body;
    const ownerId = req.userId;

    if (!name) {
        return res.status(400).send('Team name is required.');
    }

    // Insert the new team and get its ID
    const teamQuery = 'INSERT INTO teams (name, ownerId) VALUES (?, ?)';
    db.run(teamQuery, [name, ownerId], function (err) {
        if (err) {
            console.error('Error creating team:', err);
            return res.status(500).send('Server error while creating team.');
        }
        const teamId = this.lastID;

        // Automatically add the owner as the first member of the team
        const memberQuery = 'INSERT INTO team_members (teamId, userId) VALUES (?, ?)';
        db.run(memberQuery, [teamId, ownerId], (memberErr) => {
            if (memberErr) {
                console.error('Error adding owner to team:', memberErr);
            }
            res.status(201).json({ id: teamId, name, ownerId });
        });
    });
};

// Get all members of a specific team
const getTeamMembers = (req, res) => {
    const { teamId } = req.params;
    const requestingUserId = req.userId; // Current logged-in user

    // First, check if the requesting user is either the owner or a member of the team
    const authQuery = `
        SELECT
            (SELECT ownerId FROM teams WHERE id = ?) AS ownerId,
            EXISTS(SELECT 1 FROM team_members WHERE teamId = ? AND userId = ?) AS isMember
    `;
    db.get(authQuery, [teamId, teamId, requestingUserId], (authErr, result) => {
        if (authErr) {
            console.error('Error checking team authorization:', authErr);
            return res.status(500).send('Server error');
        }

        // Check if the team itself exists before proceeding
        if (!result || (result.ownerId === null && result.isMember === 0)) {
            return res.status(404).send('Team not found or you are not part of this team.');
        }

        if (result.ownerId !== requestingUserId && result.isMember !== 1) {
            return res.status(403).send('Forbidden: You are not authorized to view members of this team.');
        }

        // If authorized, proceed to fetch team members
        const query = `
            SELECT u.id, u.username, u.email
            FROM users u
            JOIN team_members tm ON u.id = tm.userId
            WHERE tm.teamId = ?
        `;
        db.all(query, [teamId], (err, members) => {
            if (err) {
                console.error(`Error fetching members for team ${teamId}:`, err);
                return res.status(500).send('Server error');
            }
            res.status(200).json(members);
        });
    });
};
// Add a member to a team
const addTeamMember = (req, res) => {
    const { teamId } = req.params;
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).send('User ID is required.');
    }

    const query = 'INSERT INTO team_members (teamId, userId) VALUES (?, ?)';
    db.run(query, [teamId, userId], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(409).send('User is already in this team.');
            }
            console.error(`Error adding member to team ${teamId}:`, err);
            return res.status(500).send('Server error');
        }
        res.status(201).send('User added to team successfully.');
    });
};

const inviteMember = (req, res) => {
    const { teamId } = req.params;
    const { invitedUserIdentifier, description } = req.body; // Add description
    const inviterId = req.userId;

    if (!invitedUserIdentifier) {
        return res.status(400).send('Invited user identifier (username or email) is required.');
    }

    // 1. Check if inviter is the owner of the team
    db.get('SELECT ownerId, name FROM teams WHERE id = ?', [teamId], (err, team) => {
        if (err) {
            console.error('Error checking team ownership for invitation:', err);
            return res.status(500).send('Server error.');
        }
        if (!team) {
            return res.status(404).send('Team not found.');
        }
        if (team.ownerId !== inviterId) {
            return res.status(403).send('Forbidden: Only the team owner can invite members.');
        }

        // 2. Find the invited user by username or email
        db.get('SELECT id, username, email FROM users WHERE username = ? OR email = ?', [invitedUserIdentifier, invitedUserIdentifier], (err, invitedUser) => {
            if (err) {
                console.error('Error finding invited user:', err);
                return res.status(500).send('Server error.');
            }
            if (!invitedUser) {
                return res.status(404).send('Invited user not found. Please provide a valid username or email.');
            }

            if (invitedUser.id === inviterId) {
                return res.status(400).send('You cannot invite yourself to the team.');
            }

            // 3. Check if invited user is already a member
            db.get('SELECT 1 FROM team_members WHERE teamId = ? AND userId = ?', [teamId, invitedUser.id], (err, member) => {
                if (err) {
                    console.error('Error checking existing team membership:', err);
                    return res.status(500).send('Server error.');
                }
                if (member) {
                    return res.status(409).send('User is already a member of this team.');
                }

                // 4. Check for existing pending invitation
                db.get('SELECT 1 FROM invitations WHERE teamId = ? AND invitedUserId = ? AND status = ?', [teamId, invitedUser.id, 'pending'], (err, invitation) => {
                    if (err) {
                        console.error('Error checking existing invitation:', err);
                        return res.status(500).send('Server error.');
                    }
                    if (invitation) {
                        return res.status(409).send('An invitation for this user to this team is already pending.');
                    }

                                            // 5. Create the invitation record with description
                                            db.run(
                                                'INSERT INTO invitations (teamId, inviterId, invitedUserId, invitedUserEmail, status, description) VALUES (?, ?, ?, ?, ?, ?)',
                                                [teamId, inviterId, invitedUser.id, invitedUser.email, 'pending', description],
                                                function (insertErr) {
                                                    if (insertErr) {
                                                        console.error('Error creating invitation:', insertErr);
                                                        return res.status(500).send('Server error while creating invitation.');
                                                    }
                                                    const newInvitationId = this.lastID;
                    
                                                    // Get inviter's username for email
                                                    db.get('SELECT username FROM users WHERE id = ?', [inviterId], (err, inviterUser) => {
                                                        if (err || !inviterUser) {
                                                            console.error('Error fetching inviter username for email:', err);
                                                            // Proceed without email if cannot fetch inviter, or handle error as critical
                                                            return res.status(500).send('Server error: Could not get inviter details.');
                                                        }
                    
                                                        // Send invitation email
                                                        sendInvitationEmail(
                                                            invitedUser.email,
                                                            inviterUser.username,
                                                            team.name,
                                                            description,
                                                            newInvitationId
                                                        ).catch(emailErr => console.error('Failed to send invitation email:', emailErr));
                    
                                                        res.status(201).json({ message: 'Invitation sent successfully.', invitationId: newInvitationId });
                                                    });
                                                }
                                            );                });
            });
        });
    });
};

const acceptInvitation = (req, res) => {
    const { invitationId } = req.params;
    const acceptingUserId = req.userId;

    db.get('SELECT * FROM invitations WHERE id = ?', [invitationId], (err, invitation) => {
        if (err) {
            console.error('Error fetching invitation:', err);
            return res.status(500).send('Server error.');
        }
        if (!invitation) {
            return res.status(404).send('Invitation not found.');
        }
        if (invitation.invitedUserId !== acceptingUserId) {
            return res.status(403).send('Forbidden: You are not authorized to accept this invitation.');
        }
        if (invitation.status !== 'pending') {
            return res.status(400).send(`Invitation is already ${invitation.status}.`);
        }

        // Check if already a member of the team
        db.get('SELECT 1 FROM team_members WHERE teamId = ? AND userId = ?', [invitation.teamId, acceptingUserId], (err, member) => {
            if (err) {
                console.error('Error checking existing team membership:', err);
                return res.status(500).send('Server error.');
            }
            if (member) {
                // If already a member, just update invitation status and consider it successful
                db.run('UPDATE invitations SET status = ? WHERE id = ?', ['accepted', invitationId], (updateErr) => {
                    if (updateErr) {
                        console.error('Error updating invitation status (already member):', updateErr);
                        return res.status(500).send('Server error.');
                    }
                    return res.status(200).send('You are already a member of this team. Invitation status updated to accepted.');
                });
                return;
            }

            // Add user to team_members
            db.run('INSERT INTO team_members (teamId, userId) VALUES (?, ?)', [invitation.teamId, acceptingUserId], (insertErr) => {
                if (insertErr) {
                    console.error('Error adding user to team_members:', insertErr);
                    return res.status(500).send('Server error.');
                }
                // Update invitation status
                db.run('UPDATE invitations SET status = ? WHERE id = ?', ['accepted', invitationId], (updateErr) => {
                    if (updateErr) {
                        console.error('Error updating invitation status:', updateErr);
                        return res.status(500).send('Server error.');
                    }
                    res.status(200).json({ message: 'Invitation accepted. You are now a member of the team.', teamId: invitation.teamId });
                });
            });
        });
    });
};

const declineInvitation = (req, res) => {
    const { invitationId } = req.params;
    const decliningUserId = req.userId;

    db.get('SELECT * FROM invitations WHERE id = ?', [invitationId], (err, invitation) => {
        if (err) {
            console.error('Error fetching invitation:', err);
            return res.status(500).send('Server error.');
        }
        if (!invitation) {
            return res.status(404).send('Invitation not found.');
        }
        if (invitation.invitedUserId !== decliningUserId) {
            return res.status(403).send('Forbidden: You are not authorized to decline this invitation.');
        }
        if (invitation.status !== 'pending') {
            return res.status(400).send(`Invitation is already ${invitation.status}.`);
        }

        db.run('UPDATE invitations SET status = ? WHERE id = ?', ['declined', invitationId], (updateErr) => {
            if (updateErr) {
                console.error('Error updating invitation status to declined:', updateErr);
                return res.status(500).send('Server error.');
            }
            res.status(200).send('Invitation declined.');
        });
    });
};

// Remove a member from a team
const removeTeamMember = (req, res) => {
    const { teamId, userId: userIdToRemove } = req.params; // userId to remove from params
    const requestingUserId = req.userId; // Currently logged-in user

    // First, check if the team exists and get its ownerId
    db.get('SELECT ownerId FROM teams WHERE id = ?', [teamId], (err, team) => {
        if (err) {
            console.error('Error checking team:', err);
            return res.status(500).send('Server error');
        }
        if (!team) {
            return res.status(404).send('Team not found.');
        }

        const isOwner = (team.ownerId === requestingUserId);
        const isSelfRemoval = (requestingUserId === parseInt(userIdToRemove)); // Parse userIdToRemove as it comes from params as string

        // Authorization logic
        if (!isOwner && !isSelfRemoval) {
            // Not the owner, and not trying to remove self
            return res.status(403).send('Forbidden: You can only remove yourself or be the team owner to remove others.');
        }

        // Prevent owner from leaving their own team unless they explicitly delete it (if they are the last member)
        if (isSelfRemoval && isOwner && requestingUserId === parseInt(userIdToRemove)) {
            // Check if owner is the ONLY member
            db.get('SELECT COUNT(*) as memberCount FROM team_members WHERE teamId = ?', [teamId], (countErr, result) => {
                if (countErr) {
                    console.error('Error checking member count:', countErr);
                    return res.status(500).send('Server error.');
                }
                if (result.memberCount === 1) {
                    return res.status(400).send('Owner cannot leave their team if they are the only member. Please delete the team instead.');
                }
                performRemoval();
            });
        } else {
            // If owner is removing another member, or member is leaving and is not the sole owner
            performRemoval();
        }

        function performRemoval() {
            // Ensure the userIdToRemove is actually a member of the team
            db.get('SELECT 1 FROM team_members WHERE teamId = ? AND userId = ?', [teamId, userIdToRemove], (checkErr, memberExists) => {
                if (checkErr) {
                    console.error('Error checking if member exists:', checkErr);
                    return res.status(500).send('Server error');
                }
                if (!memberExists) {
                    return res.status(404).send('Team member not found in this team.');
                }

                // Proceed with removal
                const query = 'DELETE FROM team_members WHERE teamId = ? AND userId = ?';
                db.run(query, [teamId, userIdToRemove], function (deleteErr) {
                    if (deleteErr) {
                        console.error(`Error removing member ${userIdToRemove} from team ${teamId}:`, deleteErr);
                        return res.status(500).send('Server error');
                    }
                    if (this.changes === 0) {
                        // This case should ideally not be reached due to the memberExists check
                        return res.status(404).send('Team member not found or already removed.');
                    }
                    res.status(200).send(isSelfRemoval ? 'Successfully left the team.' : 'Member removed from team successfully.');
                });
            });
        }
    });
};

const deleteTeam = (req, res) => {
    const { teamId } = req.params;
    const userId = req.userId; // Current logged-in user

    // First, check if the user is the owner of the team
    db.get('SELECT ownerId FROM teams WHERE id = ?', [teamId], (err, team) => {
        if (err) {
            console.error('Error checking team ownership:', err);
            return res.status(500).send('Server error');
        }
        if (!team) {
            return res.status(404).send('Team not found.');
        }
        if (team.ownerId !== userId) {
            return res.status(403).send('Forbidden: Only the team owner can delete the team.');
        }

        // If authorized, delete the team
        db.run('DELETE FROM teams WHERE id = ?', [teamId], function (deleteErr) {
            if (deleteErr) {
                console.error(`Error deleting team ${teamId}:`, deleteErr);
                return res.status(500).send('Server error');
            }
            console.log(`Team ID ${teamId} deletion attempt. Rows affected: ${this.changes}`);
            if (this.changes === 0) {
                return res.status(404).send('Team not found or already deleted.');
            }
            res.status(200).send('Team deleted successfully.');
        });
    });
};

module.exports = {
    getMyTeams,
    createTeam,
    getTeamMembers,
    addTeamMember,
    removeTeamMember,
    deleteTeam,
    inviteMember,
    acceptInvitation,
    declineInvitation,
};
