// Database connection and utilities for Neon PostgreSQL
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection
pool.on('connect', () => {
    console.log('✅ Connected to Neon database');
});

pool.on('error', (err) => {
    console.error('❌ Database connection error:', err);
});

// Helper function to execute queries
async function query(text, params) {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        console.log('Executed query', { text, duration, rows: res.rowCount });
        return res;
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
}

// Initialize database schema
async function initializeDatabase() {
    try {
        const fs = require('fs');
        const path = require('path');
        const schemaPath = path.join(__dirname, 'schema.sql');
        
        // Check if schema file exists
        if (!fs.existsSync(schemaPath)) {
            console.log('⚠️  Schema file not found, skipping initialization');
            return;
        }
        
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        // Split by semicolon and execute each statement
        const statements = schema.split(';').filter(s => s.trim().length > 0);
        
        for (const statement of statements) {
            const trimmed = statement.trim();
            if (trimmed && !trimmed.startsWith('--')) {
                try {
                    await query(trimmed);
                } catch (err) {
                    // Ignore "already exists" errors
                    if (!err.message.includes('already exists')) {
                        console.warn('Schema statement warning:', err.message);
                    }
                }
            }
        }
        
        console.log('✅ Database schema initialized');
    } catch (error) {
        console.error('❌ Error initializing database:', error);
        // Don't throw - allow server to start even if schema init fails
        console.log('⚠️  Continuing without schema initialization');
    }
}

module.exports = {
    pool,
    query,
    initializeDatabase
};

