const cron = require('node-cron');
const db = require('../db'); // Import the SQLite db instance
const { sendReminderEmail } = require('./emailService');

// This function contains the core logic for checking and sending reminders.
// It is exported for easier testing.
const checkReminders = async () => {
    // console.log('Running robust reminder check job for teams...'); // Less noisy
    const now_iso = new Date().toISOString();

    const query = `
        SELECT t.*, u.email as userEmail FROM tasks t
        JOIN users u ON t.userId = u.id
        WHERE t.reminderAt IS NOT NULL AND t.reminderAt <= ? AND t.reminderSent = 0
    `;

    db.all(query, [now_iso], (err, tasks) => {
        if (err) {
            console.error("Error querying for due tasks:", err);
            return;
        }

        if (tasks.length === 0) {
            // console.log('No reminders due at this time.'); // Less noisy
            return;
        }

        console.log(`Found ${tasks.length} task(s) due for reminders.`);

        tasks.forEach((task) => {
            handleSingleTaskReminder(task);
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
