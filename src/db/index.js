const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the SQLite database.');
    db.run('PRAGMA foreign_keys = ON;', (pragmaErr) => {
        if (pragmaErr) {
            console.error('Error enabling foreign keys:', pragmaErr.message);
        } else {
            console.log('Foreign key enforcement enabled.');
        }
    });
});

// --- Database Migration Logic for SQLite ---
// This ensures the database schema is up-to-date.
const runMigrations = () => {
    db.serialize(() => {
        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            email TEXT
        )`);

        // Teams table
        db.run(`CREATE TABLE IF NOT EXISTS teams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            ownerId INTEGER NOT NULL,
            FOREIGN KEY (ownerId) REFERENCES users (id)
        )`);

        // Team Members table
        db.run(`CREATE TABLE IF NOT EXISTS team_members (
            teamId INTEGER NOT NULL,
            userId INTEGER NOT NULL,
            PRIMARY KEY (teamId, userId),
            FOREIGN KEY (teamId) REFERENCES teams (id) ON DELETE CASCADE,
            FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
        )`);

        // Invitations table
        db.run(`CREATE TABLE IF NOT EXISTS invitations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            teamId INTEGER NOT NULL,
            inviterId INTEGER NOT NULL,
            invitedUserId INTEGER,
            invitedUserEmail TEXT,
            status TEXT DEFAULT 'pending',
            description TEXT, -- Add description field for the invitation's purpose
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (teamId) REFERENCES teams (id) ON DELETE CASCADE,
            FOREIGN KEY (inviterId) REFERENCES users (id),
            FOREIGN KEY (invitedUserId) REFERENCES users (id)
        )`);

        // Add 'description' column to invitations if it doesn't exist
        db.all("PRAGMA table_info(invitations)", (err, columns) => {
            if (err) {
                console.error("Error checking 'invitations' table info:", err);
                return;
            }
            if (!columns.some(c => c.name === 'description')) {
                console.log("Adding 'description' column to 'invitations' table...");
                db.run("ALTER TABLE invitations ADD COLUMN description TEXT", (alterErr) => {
                    if (alterErr) {
                        console.error("Error adding 'description' column to invitations:", alterErr);
                    }
                });
            }
        });

        // Tasks table (must be created after users if it doesn't exist)
        db.run(`CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER,
            heading TEXT,
            subject TEXT,
            explanation TEXT,
            day TEXT,
            reminder_preference TEXT,
            reminderAt TEXT,
            reminderSent INTEGER DEFAULT 0,
            notificationScope TEXT DEFAULT 'user_only',
            notificationTeamId INTEGER DEFAULT NULL,
            FOREIGN KEY (userId) REFERENCES users (id),
            FOREIGN KEY (notificationTeamId) REFERENCES teams (id)
        )`);
        
        // --- Add Missing Columns to Tasks Table (Migration) ---
        db.all("PRAGMA table_info(tasks)", (err, columns) => {
            if (err) {
                console.error("Error checking 'tasks' table info during migration:", err);
                return;
            }

            const columnNames = columns.map(c => c.name);
            const migrations = [
                { column: 'reminderAt', type: 'TEXT' },
                { column: 'notificationScope', type: 'TEXT', defaultValue: "'user_only'" },
                { column: 'notificationTeamId', type: 'INTEGER', defaultValue: "NULL" }
            ];

            migrations.forEach(m => {
                if (!columnNames.includes(m.column)) {
                    console.log(`Schema outdated. Adding "${m.column}" to "tasks" table...`);
                    db.run(`ALTER TABLE tasks ADD COLUMN ${m.column} ${m.type} DEFAULT ${m.defaultValue}`, (alterErr) => {
                        if (alterErr) {
                            console.error(`Error adding column ${m.column}:`, alterErr);
                        } else {
                            console.log(`Successfully added column ${m.column}.`);
                        }
                    });
                }
            });
        });
    });
};

runMigrations();

module.exports = db;