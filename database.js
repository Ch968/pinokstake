const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

const DB_PATH = path.join(dataDir, 'pinokstake.db');
const db = new sqlite3.Database(DB_PATH);

// Initialize database with all tables
function initializeDatabase() {
    db.serialize(() => {
        // 1. USERS TABLE - Admin accounts
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                email TEXT,
                role TEXT DEFAULT 'editor',
                active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 2. ARTICLES TABLE - Newsroom/Blog posts
        db.run(`
            CREATE TABLE IF NOT EXISTS articles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                content TEXT,
                excerpt TEXT,
                featured_image TEXT,
                category TEXT,
                brand TEXT,
                author TEXT,
                status TEXT DEFAULT 'draft',
                published_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 3. BRANDS TABLE - Company brands
        db.run(`
            CREATE TABLE IF NOT EXISTS brands (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                description TEXT,
                category TEXT,
                logo TEXT,
                website TEXT,
                status TEXT DEFAULT 'published',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 4. LEADERS TABLE - Leadership team
        db.run(`
            CREATE TABLE IF NOT EXISTS leaders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                position TEXT NOT NULL,
                bio TEXT,
                photo TEXT,
                email TEXT,
                brand TEXT,
                department TEXT,
                status TEXT DEFAULT 'published',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 5. OPPORTUNITIES TABLE - Business opportunities
        db.run(`
            CREATE TABLE IF NOT EXISTS opportunities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                description TEXT,
                category TEXT,
                requirements TEXT,
                deadline DATETIME,
                contact_email TEXT,
                status TEXT DEFAULT 'open',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 6. VACANCIES TABLE - Job positions
        db.run(`
            CREATE TABLE IF NOT EXISTS vacancies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                description TEXT,
                location TEXT,
                employment_type TEXT,
                salary_range TEXT,
                brand TEXT,
                department TEXT,
                deadline DATETIME,
                status TEXT DEFAULT 'open',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 7. APPLICATIONS TABLE - CV submissions
        db.run(`
            CREATE TABLE IF NOT EXISTS applications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                email TEXT NOT NULL,
                phone TEXT,
                location TEXT,
                qualifications TEXT,
                experience TEXT,
                cv_file TEXT,
                preferred_brand TEXT,
                preferred_department TEXT,
                cover_letter TEXT,
                status TEXT DEFAULT 'new',
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 8. INQUIRIES TABLE - Contact form submissions
        db.run(`
            CREATE TABLE IF NOT EXISTS inquiries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                phone TEXT,
                inquiry_type TEXT,
                subject TEXT,
                message TEXT,
                status TEXT DEFAULT 'new',
                assigned_to TEXT,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 9. ANNOUNCEMENTS TABLE - Corporate announcements
        db.run(`
            CREATE TABLE IF NOT EXISTS announcements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT,
                announcement_type TEXT,
                published_at DATETIME,
                expires_at DATETIME,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, () => {
            console.log('✅ All tables created successfully');
            insertSampleData();
        });
    });
}

// Insert sample data
function insertSampleData() {
    db.serialize(() => {
        // Insert default admin user
        db.run(`
            INSERT OR IGNORE INTO users (username, password, email, role)
            VALUES (?, ?, ?, ?)
        `, ['admin', 'password123', 'admin@pinokstake.com', 'admin']);

        // Insert sample brands
        const brands = [
            ['PINOK247', 'pinok247', 'Your trusted source for breaking news', 'Media & News', null, 'https://pinok247.com'],
            ['Aspire Nations', 'aspire-nations', 'Empowering learners through education', 'Education', null, 'https://aspirenations.com'],
            ['HomeFix', 'homefix', 'Comprehensive property solutions', 'Property Services', null, 'https://homefix.com']
        ];

        brands.forEach(brand => {
            db.run(`
                INSERT OR IGNORE INTO brands (name, slug, description, category, logo, website)
                VALUES (?, ?, ?, ?, ?, ?)
            `, brand);
        });

        // Insert sample article
        db.run(`
            INSERT OR IGNORE INTO articles 
            (title, slug, content, excerpt, category, brand, author, status, published_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            'PINOK247 Expands Business Visibility Services',
            'pinok247-expands-visibility',
            '<p>PINOK247 has launched expanded services to help businesses reach wider audiences...</p>',
            'PINOK247 launches new visibility services',
            'Brand Updates',
            'PINOK247',
            'Admin',
            'published',
            new Date().toISOString()
        ]);

        // Insert sample leader
        db.run(`
            INSERT OR IGNORE INTO leaders
            (name, position, bio, email, brand, status)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            'Judah Chimaobi Emezue',
            'Founder & CEO',
            'Visionary entrepreneur leading PINOK STAKE LIMITED',
            'jc@pinokstake.com',
            'PINOK STAKE',
            'published'
        ]);

        console.log('✅ Sample data inserted successfully');
        console.log('\n📊 Database Ready!');
        console.log('💾 Location:', DB_PATH);
        console.log('👤 Admin User: admin / password123');
        db.close();
    });
}

// Run initialization
initializeDatabase();