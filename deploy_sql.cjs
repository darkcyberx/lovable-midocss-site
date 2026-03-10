const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function deploy() {
    const client = new Client({
        host: 'db.mknudgilcqxisokanomz.supabase.co',
        port: 5432,
        user: 'postgres',
        password: 'lENHc2nD6FIUWh7J',
        database: 'postgres',
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('Connecting to database...');
        await client.connect();
        console.log('Connected. Reading full_schema.sql...');
        const sqlPath = path.join(__dirname, 'full_schema.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing SQL. This may take a while...');
        // We split by ';' to handle potential large transaction issues if necessary, 
        // but for now, we try to run the whole block.
        await client.query(sql);
        console.log('Schema deployed successfully!');
    } catch (err) {
        console.error('Deployment failed:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

deploy();
