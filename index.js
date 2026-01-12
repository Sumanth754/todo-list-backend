require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const cors = require('cors');
const authRoutes = require('./src/routes/auth');
const adminRoutes = require('./src/routes/admin');
const taskRoutes = require('./src/routes/tasks');
const userRoutes = require('./src/routes/users');
const teamRoutes = require('./src/routes/teams');
const invitationActionRoutes = require('./src/routes/invitations'); // New: Import invitation action routes
const { startScheduler } = require('./src/services/schedulerService');
const db = require('./src/db'); // Import the re-created SQLite db instance

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/user', userRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/invitations', invitationActionRoutes);

// Start the server directly
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    startScheduler();
});