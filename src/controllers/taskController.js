const db = require('../db'); // Import the SQLite db instance

const getTasks = (req, res) => {
    const { month, year } = req.query;
    let query = 'SELECT * FROM tasks WHERE userId = ?';
    const params = [req.userId];

    if (month && year) {
        const monthString = month.toString().padStart(2, '0');
        const searchPattern = `${year}-${monthString}-%`;
        query += ' AND day LIKE ?';
        params.push(searchPattern);
    }

    db.all(query, params, (err, rows) => {
        if (err) {
            res.status(500).send('Server error');
        } else {
            res.status(200).json(rows);
        }
    });
};

const createTask = (req, res) => {
    const { heading, subject, explanation, day, reminderAt, notificationScope, notificationTeamId } = req.body;
    const pref = JSON.stringify(req.body.reminder_preference || {});

    db.run(
        'INSERT INTO tasks (userId, heading, subject, explanation, day, reminder_preference, reminderAt, notificationScope, notificationTeamId, reminderSent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
        [req.userId, heading, subject, explanation, day, pref, reminderAt, notificationScope, notificationTeamId, 0], 
        function(err) {
            if (err) {
                console.error("Create task DB error:", err.message);
                res.status(500).send('Server error');
            } else {
                res.status(201).json({ id: this.lastID });
            }
        }
    );
};

const updateTask = (req, res) => {
    const { id } = req.params;
    const { heading, subject, explanation, day, reminderAt, notificationScope, notificationTeamId } = req.body;
    const pref = JSON.stringify(req.body.reminder_preference || {});

    db.run(
        'UPDATE tasks SET heading = ?, subject = ?, explanation = ?, day = ?, reminder_preference = ?, reminderAt = ?, notificationScope = ?, notificationTeamId = ?, reminderSent = 0 WHERE id = ? AND userId = ?',
        [heading, subject, explanation, day, pref, reminderAt, notificationScope, notificationTeamId, id, req.userId],
        function(err) {
            if (err) {
                console.error("Update task DB error:", err.message);
                res.status(500).send('Server error');
            } else if (this.changes === 0) {
                res.status(404).send('Task not found or user not authorized');
            } else {
                res.status(200).send('Task updated successfully');
            }
        }
    );
};

const deleteTask = (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM tasks WHERE id = ? AND userId = ?', [id, req.userId], function(err) {
        if (err) {
            res.status(500).send('Server error');
        } else if (this.changes === 0) {
            res.status(404).send('Task not found or user not authorized');
        } else {
            res.status(200).send('Task deleted successfully');
        }
    });
};

module.exports = {
    getTasks,
    createTask,
    updateTask,
    deleteTask,
};
