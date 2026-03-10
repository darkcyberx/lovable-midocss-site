const fs = require('fs');
const https = require('https');
const { Client } = require('pg');

const projectRef = 'mknudgilcqxisokanomz';
const managementToken = 'sbp_51b10ba6171b73c27aaece45dfad00b3904a249b';
const dbPassword = 'lENHc2nD6FIUWh7J';

async function deploySql() {
    console.log('--- Phase 1: Deploying SQL Schema ---');
    const hosts = [`db.${projectRef}.supabase.co`, `aws-0-eu-central-1.pooler.supabase.com`];
    let client;

    for (const host of hosts) {
        console.log(`Trying host: ${host}`);
        client = new Client({
            host: host,
            port: 5432,
            user: host.includes('pooler') ? `postgres.${projectRef}` : 'postgres',
            password: dbPassword,
            database: 'postgres',
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 10000
        });

        try {
            await client.connect();
            console.log(`✅ Connected to ${host}`);
            const sql = fs.readFileSync('full_schema.sql', 'utf8');
            await client.query(sql);
            console.log('✅ SQL Schema deployed.');
            await client.end();
            return true;
        } catch (err) {
            console.error(`❌ Failed ${host}: ${err.message}`);
        }
    }
    return false;
}

function callApi(path, method, data) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(data);
        const options = {
            hostname: 'api.supabase.com',
            port: 443,
            path: path,
            method: method,
            headers: {
                'Authorization': `Bearer ${managementToken}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => resolve({ status: res.statusCode, body }));
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

async function deployFunction(slug) {
    console.log(`--- Phase 2: Deploying Function ${slug} ---`);
    const filePath = `supabase/functions/${slug}/index.ts`;
    if (!fs.existsSync(filePath)) {
        console.warn(`File not found: ${filePath}`);
        return;
    }
    let code = fs.readFileSync(filePath, 'utf8');
    code = code.replace(/\r\n/g, '\n');

    const payload = {
        name: slug,
        slug: slug,
        body: code,
        verify_jwt: false
    };

    // Try Create
    let res = await callApi(`/v1/projects/${projectRef}/functions`, 'POST', payload);
    if (res.status >= 200 && res.status < 300) {
        console.log(`✅ Function ${slug} created.`);
    } else if (res.body.includes('slug') || res.body.includes('already exists') || res.status === 409) {
        // Try Update
        console.log(`🔄 Function ${slug} already exists. Attempting update...`);
        res = await callApi(`/v1/projects/${projectRef}/functions/${slug}`, 'PATCH', payload);
        if (res.status < 300) console.log(`✅ Function ${slug} updated.`);
        else console.error(`❌ Update failed ${slug}: ${res.status} - ${res.body}`);
    } else {
        console.error(`❌ Create failed ${slug}: ${res.status} - ${res.body}`);
    }
}

async function main() {
    const sqlOk = await deploySql();
    if (!sqlOk) console.warn('⚠️ SQL migration failed/skipped due to DNS. You may need to run it manually.');

    await deployFunction('validate-license');
    await deployFunction('validate-v2');
    await deployFunction('telegram-bot');
    console.log('--- Process Finished ---');
}

main().catch(console.error);
