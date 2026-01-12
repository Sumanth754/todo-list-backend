const cron = require('node-cron');
const db = require('../db'); // Import the SQLite db instance
const { sendReminderEmail } = require('./emailService');

// This function contains the core logic for checking and sending reminders.
// It is exported for easier testing.
const checkReminders = async () => {
    console.log(`[Scheduler] Running check at UTC: ${new Date().toISOString()}`);

    // Fetch all tasks that have a reminder set and haven't been sent yet.
    const query = `
        SELECT t.id, t.heading, t.reminderAt, t.reminderSent, u.email as userEmail
        FROM tasks t
        JOIN users u ON t.userId = u.id
        WHERE t.reminderAt IS NOT NULL AND t.reminderSent = 0
    `;

    db.all(query, [], (err, allPendingTasks) => {
        if (err) {
            console.error("[Scheduler] Error querying for all pending tasks:", err);
            return;
        }

        if (allPendingTasks.length === 0) {
            // console.log('[Scheduler] No pending reminders found in database.'); // Keep logs clean
            return;
        }

        console.log(`[Scheduler] Found ${allPendingTasks.length} total pending reminders. Comparing times...`);
        
        const now = new Date();
        const dueTasks = allPendingTasks.filter(task => {
            const reminderTime = new Date(task.reminderAt);
            // Log the comparison for debugging
            console.log(`[Scheduler] Task ${task.id}: Comparing reminder time ${task.reminderAt} with current time ${now.toISOString()}`);
            return reminderTime <= now;
        });

        if (dueTasks.length === 0) {
            // console.log('[Scheduler] No reminders are due at this moment.'); // Keep logs clean
            return;
        }

        console.log(`[Scheduler] Found ${dueTasks.length} task(s) that are due for reminders.`);

        dueTasks.forEach((task) => {
            // Re-fetch the full task object to pass to the handler, including the userEmail from the initial join
            db.get('SELECT * FROM tasks WHERE id = ?', [task.id], (err, fullTask) => {
                if (fullTask) {
                    handleSingleTaskReminder({...fullTask, userEmail: task.userEmail});
                } else if (err) {
                    console.error(`[Scheduler] Error re-fetching full task ${task.id}:`, err);
                }
            });
        });
    });
};

const handleSingleTaskReminder = (task) => {
    const scope = task.notificationScope;
    const taskOwnerId = task.userId;
    const taskOwnerEmail = task.userEmail; // Email is joined from tasks query

    if (scope === 'team_include_me' || scope === 'team_exclude_me') {
        const teamId = task.notificationTeamId;
        if (!teamId) {
            console.error(`Task ${task.id} has team scope but no team ID.`);
            db.run('UPDATE tasks SET reminderSent = 1 WHERE id = ?', [task.id]);
            return;
        }

        const memberQuery = `
            SELECT u.email, u.id FROM users u
            JOIN team_members tm ON u.id = tm.userId
            WHERE tm.teamId = ?
        `;
        db.all(memberQuery, [teamId], (memberErr, members) => {
            if (memberErr) {
                console.error(`Error fetching team members for task ${task.id}:`, memberErr);
                return;
            }
            
            let emailRecipients = members.map(m => m.email);
            if (scope === 'team_exclude_me') {
                emailRecipients = emailRecipients.filter(email => email !== taskOwnerEmail);
            }
            
            sendRemindersToRecipients(emailRecipients, task);
        });

    } else { // Defaulting to 'user_only'
        if (taskOwnerEmail) {
            sendRemindersToRecipients([taskOwnerEmail], task);
        } else {
            console.error(`Task ${task.id} has no owner email.`);
            db.run('UPDATE tasks SET reminderSent = 1 WHERE id = ?', [task.id]);
        }
    }
};

const sendRemindersToRecipients = async (recipients, task) => {
    if (!recipients || recipients.length === 0) {
        console.log(`No recipients found for task ${task.id}, marking as sent.`);
        db.run('UPDATE tasks SET reminderSent = 1 WHERE id = ?', [task.id]);
        return;
    }

    console.log(`Sending reminder for task "${task.heading}" to: ${recipients.join(', ')}`);

    const sendPromises = recipients.map(email => sendReminderEmail(email, task));

    try {
        await Promise.all(sendPromises);
        console.log(`All reminders sent successfully for task ${task.id}.`);
        db.run('UPDATE tasks SET reminderSent = 1 WHERE id = ?', [task.id], (updateErr) => {
            if (updateErr) {
                console.error(`Error updating reminderSent flag for task ${task.id}:`, updateErr);
            }
        });
    } catch (error) {
        console.error(`Failed to send one or more reminders for task ${task.id}, will retry next minute.`, error);
    }
};


const startScheduler = () => {
    // This cron job runs every minute to check for tasks that need reminders.
    cron.schedule('* * * * *', checkReminders);
    console.log('Scheduler started. Will check for reminders every minute.');
};

module.exports = {
    startScheduler,
    checkReminders, // Exported for testing
};
