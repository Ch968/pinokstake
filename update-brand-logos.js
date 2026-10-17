const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const db = new sqlite3.Database(path.join(__dirname, 'data', 'pinokstake.db'));

// slug in database  ->  logo file in public/images
const logos = [
    { slug: 'pinok247',      file: 'pinok247-logo.jpg' },
    { slug: 'aspire-nations', file: 'aspire-logo.jpg' },
    { slug: 'homefix',        file: 'homefix-logo.jpg' }
];

db.serialize(() => {
    logos.forEach(({ slug, file }) => {
        const filePath = path.join(__dirname, 'public', 'images', file);

        if (!fs.existsSync(filePath)) {
            console.log(`❌ Missing file: public/images/${file}`);
            return;
        }

        db.run(
            'UPDATE brands SET logo = ? WHERE slug = ?',
            [`/images/${file}`, slug],
            function (err) {
                if (err) return console.log(`❌ ${slug}: ${err.message}`);
                if (this.changes === 0) return console.log(`❌ No brand found with slug "${slug}"`);
                console.log(`✅ ${slug} now uses ${file}`);
            }
        );
    });
});

db.close();