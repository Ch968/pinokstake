const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Folders
const dataDir = path.join(__dirname, 'data');
const cvDir = path.join(dataDir, 'cvs');                       // CVs live OUTSIDE public/ so nobody can browse them
const uploadsDir = path.join(dataDir, 'uploads');  // Images (logos, photos, news images)
[dataDir, cvDir, uploadsDir].forEach(dir => fs.mkdirSync(dir, { recursive: true }));

// Database
const db = new sqlite3.Database(path.join(dataDir, 'pinokstake.db'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

const safeName = name => name.replace(/[^a-zA-Z0-9._-]/g, '_');
const MAX_FILE = 5 * 1024 * 1024; // 5 MB

const imageUpload = multer({
    storage: multer.diskStorage({
        destination: uploadsDir,
        filename: (req, file, cb) => cb(null, Date.now() + '-' + safeName(file.originalname))
    }),
    limits: { fileSize: MAX_FILE },
    fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype))
});

const cvUpload = multer({
    storage: multer.diskStorage({
        destination: cvDir,
        filename: (req, file, cb) => cb(null, Date.now() + '-' + safeName(file.originalname))
    }),
    limits: { fileSize: MAX_FILE },
    fileFilter: (req, file, cb) => cb(null, /\.(pdf|docx?)$/i.test(file.originalname))
});

// ============================================
// AUTH
// ============================================

function verifyToken(req, res, next) {
    const header = req.headers['authorization'];
    const token = header && header.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Invalid token' });
        req.user = decoded;
        next();
    });
}

app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    db.get(
        'SELECT * FROM users WHERE username = ? AND password = ? AND active = 1',
        [username, password],
        (err, row) => {
            if (err || !row) return res.status(401).json({ error: 'Invalid credentials' });
            const token = jwt.sign({ id: row.id, role: row.role }, JWT_SECRET, { expiresIn: '7d' });
            res.json({ token, role: row.role });
        }
    );
});

// ============================================
// IMAGE UPLOAD (logos, photos, news images)
// ============================================

app.post('/api/admin/upload', verifyToken, (req, res) => {
    imageUpload.single('image')(req, res, err => {
        if (err) return res.status(400).json({ error: err.message });
        if (!req.file) return res.status(400).json({ error: 'Please choose a JPG, PNG, WEBP or GIF image under 5MB' });
        res.json({ url: '/uploads/' + req.file.filename });
    });
});

// ============================================
// ARTICLES / NEWSROOM
// ============================================

app.get('/api/articles', (req, res) => {
    const { category, brand, limit } = req.query;
    let sql = "SELECT * FROM articles WHERE status = 'published'";
    const params = [];

    if (category) { sql += ' AND category = ?'; params.push(category); }
    if (brand) { sql += ' AND brand = ?'; params.push(brand); }

    sql += ' ORDER BY published_at DESC';

    if (limit) { sql += ' LIMIT ?'; params.push(parseInt(limit, 10) || 3); }

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.get('/api/articles/:slug', (req, res) => {
    db.get(
        "SELECT * FROM articles WHERE slug = ? AND status = 'published'",
        [req.params.slug],
        (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: 'Article not found' });
            res.json(row);
        }
    );
});

app.post('/api/admin/articles', verifyToken, (req, res) => {
    const { title, slug, content, excerpt, category, brand, author, featured_image } = req.body;
    db.run(
        `INSERT INTO articles (title, slug, content, excerpt, category, brand, author, featured_image, status, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published', ?)`,
        [title, slug, content, excerpt, category, brand, author || 'Admin', featured_image || null, new Date().toISOString()],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        }
    );
});

app.put('/api/admin/articles/:id', verifyToken, (req, res) => {
    const { title, slug, content, excerpt, category, brand, featured_image } = req.body;
    db.run(
        `UPDATE articles SET title = ?, slug = ?, content = ?, excerpt = ?, category = ?, brand = ?,
         featured_image = COALESCE(?, featured_image), updated_at = ? WHERE id = ?`,
        [title, slug, content, excerpt, category, brand, featured_image || null, new Date().toISOString(), req.params.id],
        err => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

app.delete('/api/admin/articles/:id', verifyToken, (req, res) => {
    db.run('DELETE FROM articles WHERE id = ?', [req.params.id], err => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ============================================
// BRANDS
// ============================================

app.get('/api/brands', (req, res) => {
    db.all("SELECT * FROM brands WHERE status = 'published' ORDER BY name", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.post('/api/admin/brands', verifyToken, (req, res) => {
    const { name, slug, description, category, website, logo } = req.body;
    db.run(
        "INSERT INTO brands (name, slug, description, category, website, logo, status) VALUES (?, ?, ?, ?, ?, ?, 'published')",
        [name, slug, description, category, website, logo || null],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        }
    );
});

app.put('/api/admin/brands/:id', verifyToken, (req, res) => {
    const { name, slug, description, category, website, logo } = req.body;
    db.run(
        'UPDATE brands SET name = ?, slug = ?, description = ?, category = ?, website = ?, logo = COALESCE(?, logo) WHERE id = ?',
        [name, slug, description, category, website, logo || null, req.params.id],
        err => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

// ============================================
// LEADERSHIP
// ============================================

app.get('/api/leaders', (req, res) => {
    db.all("SELECT * FROM leaders WHERE status = 'published' ORDER BY name", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.post('/api/admin/leaders', verifyToken, (req, res) => {
    const { name, position, bio, email, brand, department, photo } = req.body;
    db.run(
        "INSERT INTO leaders (name, position, bio, email, brand, department, photo, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'published')",
        [name, position, bio, email, brand, department, photo || null],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        }
    );
});

app.put('/api/admin/leaders/:id', verifyToken, (req, res) => {
    const { name, position, bio, email, brand, department, photo } = req.body;
    db.run(
        'UPDATE leaders SET name = ?, position = ?, bio = ?, email = ?, brand = ?, department = ?, photo = COALESCE(?, photo) WHERE id = ?',
        [name, position, bio, email, brand, department, photo || null, req.params.id],
        err => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

// ============================================
// OPPORTUNITIES
// ============================================

app.get('/api/opportunities', (req, res) => {
    db.all("SELECT * FROM opportunities WHERE status = 'open' ORDER BY created_at DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.post('/api/admin/opportunities', verifyToken, (req, res) => {
    const { title, slug, description, category, requirements, deadline, contact_email } = req.body;
    db.run(
        "INSERT INTO opportunities (title, slug, description, category, requirements, deadline, contact_email, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'open')",
        [title, slug, description, category, requirements, deadline, contact_email],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        }
    );
});

// ============================================
// VACANCIES
// ============================================

app.get('/api/vacancies', (req, res) => {
    db.all("SELECT * FROM vacancies WHERE status = 'open' ORDER BY created_at DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.post('/api/admin/vacancies', verifyToken, (req, res) => {
    const { title, slug, description, location, employment_type, salary_range, brand, department, deadline } = req.body;
    db.run(
        "INSERT INTO vacancies (title, slug, description, location, employment_type, salary_range, brand, department, deadline, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')",
        [title, slug, description, location, employment_type, salary_range, brand, department, deadline],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        }
    );
});

// ============================================
// CV APPLICATIONS
// ============================================

// Public: careers form submits here
app.post('/api/applications', (req, res) => {
    cvUpload.single('cv')(req, res, err => {
        if (err) return res.status(400).json({ error: err.message });
        if (!req.file) return res.status(400).json({ error: 'Please upload your CV as PDF or Word' });

        const { first_name, last_name, email, phone, location, qualifications, experience, preferred_brand, preferred_department } = req.body;

        db.run(
            `INSERT INTO applications (first_name, last_name, email, phone, location, qualifications, experience,
             cv_file, preferred_brand, preferred_department, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')`,
            [first_name, last_name, email, phone, location, qualifications, experience, req.file.filename, preferred_brand, preferred_department],
            err2 => {
                if (err2) return res.status(500).json({ error: err2.message });
                res.json({ success: true, message: 'Application submitted successfully' });
            }
        );
    });
});

app.get('/api/admin/applications', verifyToken, (req, res) => {
    db.all('SELECT * FROM applications ORDER BY created_at DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

// Admin: download a CV
app.get('/api/admin/applications/:id/cv', verifyToken, (req, res) => {
    db.get('SELECT cv_file FROM applications WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row || !row.cv_file) return res.status(404).json({ error: 'CV not found' });

        const filePath = path.join(cvDir, path.basename(row.cv_file));
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'CV file is missing on the server' });

        // Remove the timestamp prefix so the downloaded file has its original name
        const downloadName = row.cv_file.replace(/^\d+-/, '');
        res.download(filePath, downloadName);
    });
});

app.put('/api/admin/applications/:id', verifyToken, (req, res) => {
    const { status, notes } = req.body;
    db.run('UPDATE applications SET status = ?, notes = ? WHERE id = ?', [status, notes, req.params.id], err => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ============================================
// CONTACT INQUIRIES
// ============================================

app.post('/api/inquiries', (req, res) => {
    const { name, email, phone, inquiry_type, subject, message } = req.body;
    db.run(
        "INSERT INTO inquiries (name, email, phone, inquiry_type, subject, message, status) VALUES (?, ?, ?, ?, ?, ?, 'new')",
        [name, email, phone, inquiry_type, subject, message],
        err => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: 'Thank you for your inquiry. We will get back to you soon.' });
        }
    );
});

app.get('/api/admin/inquiries', verifyToken, (req, res) => {
    db.all('SELECT * FROM inquiries ORDER BY created_at DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.put('/api/admin/inquiries/:id', verifyToken, (req, res) => {
    const { status, notes, assigned_to } = req.body;
    db.run('UPDATE inquiries SET status = ?, notes = ?, assigned_to = ? WHERE id = ?', [status, notes, assigned_to, req.params.id], err => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ============================================
// USERS
// ============================================

app.get('/api/admin/users', verifyToken, (req, res) => {
    db.all('SELECT id, username, email, role, active FROM users', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.post('/api/admin/users', verifyToken, (req, res) => {
    const { username, password, email, role } = req.body;
    db.run(
        'INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)',
        [username, password, email, role || 'editor'],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        }
    );
});

// ============================================
// ANNOUNCEMENTS (news ticker)
// ============================================

// Public: active announcements that have not expired
app.get('/api/announcements', (req, res) => {
    db.all(
        `SELECT * FROM announcements
         WHERE status = 'active'
         AND (expires_at IS NULL OR expires_at = '' OR date(expires_at) >= date('now'))
         ORDER BY CASE announcement_type WHEN 'urgent' THEN 0 ELSE 1 END, published_at DESC`,
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows || []);
        }
    );
});

// Admin: all announcements, including expired ones
app.get('/api/admin/announcements', verifyToken, (req, res) => {
    db.all('SELECT * FROM announcements ORDER BY created_at DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.post('/api/admin/announcements', verifyToken, (req, res) => {
    const { title, content, announcement_type, expires_at } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    db.run(
        `INSERT INTO announcements (title, content, announcement_type, published_at, expires_at, status)
         VALUES (?, ?, ?, ?, ?, 'active')`,
        [title, content || null, announcement_type || 'update', new Date().toISOString(), expires_at || null],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        }
    );
});

app.delete('/api/admin/announcements/:id', verifyToken, (req, res) => {
    db.run('DELETE FROM announcements WHERE id = ?', [req.params.id], err => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ============================================
// DELETE BRANDS, LEADERS, VACANCIES
// (articles delete and all edit routes already exist)
// ============================================

app.delete('/api/admin/brands/:id', verifyToken, (req, res) => {
    db.run('DELETE FROM brands WHERE id = ?', [req.params.id], err => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.delete('/api/admin/leaders/:id', verifyToken, (req, res) => {
    db.run('DELETE FROM leaders WHERE id = ?', [req.params.id], err => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.delete('/api/admin/vacancies/:id', verifyToken, (req, res) => {
    db.run('DELETE FROM vacancies WHERE id = ?', [req.params.id], err => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ============================================
// PAGES
// ============================================

app.get(['/admin', '/admin/'], (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});

app.get('/admin/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'dashboard.html'));
});

const publicPages = {
    '/about': 'about.html',
    '/brands': 'brands.html',
    '/leadership': 'leadership.html',
    '/newsroom': 'newsroom.html',
    '/opportunities': 'opportunities.html',
    '/careers': 'careers.html',
    '/contact': 'contact.html'
};

Object.entries(publicPages).forEach(([route, file]) => {
    app.get(route, (req, res) => res.sendFile(path.join(__dirname, 'public', file)));
});

// Full article page for each slug
app.get('/article/:slug', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'article.html'));
});



// ============================================
// START
// ============================================

app.listen(PORT, () => {
    console.log(`\nPINOK STAKE Website Running`);
    console.log(`Website: http://localhost:${PORT}`);
    console.log(`Admin:   http://localhost:${PORT}/admin/`);
    console.log(`Change the admin password before going live.\n`);
});

module.exports = app;