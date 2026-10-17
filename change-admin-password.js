const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Change this to your own strong password, then run the script
const NEW_PASSWORD = 'pinok247';

const db = new sqlite3.Database(path.join(__dirname, 'data', 'pinokstake.db'));

db.run(
    "UPDATE users SET password = ? WHERE username = 'admin'",
    [NEW_PASSWORD],
    function (err) {
        if (err) return console.log('❌ Error: ' + err.message);
        if (this.changes === 0) return console.log('❌ No admin user found');
        console.log('✅ Admin password changed. Use the new password to log in.');
    }
);

db.close();