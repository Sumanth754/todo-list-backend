// This file centralizes all secret keys and configuration for the application.
// By using this file, we avoid issues with environment variable loading.

const config = {
    JWT_SECRET: process.env.JWT_SECRET,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD, // Load from environment variable
    
    // NOTE: You still need to provide your email and App Password in the .env file.
    // This part cannot be hardcoded for security reasons.
    EMAIL_USER: process.env.EMAIL_USER,
    EMAIL_PASS: process.env.EMAIL_PASS
};

module.exports = config;
