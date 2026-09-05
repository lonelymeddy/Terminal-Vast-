const fs = require('fs');
const chalk = require('chalk');
const path = require('path');

function cleaningSession(direktori) {
    fs.readdir(direktori, (err, files) => {
        if (err) {
            return;
        }
    let count = 0
    
        files.forEach(file => {
            const filePath = path.join(direktori, file);
            
            fs.stat(filePath, (err, stats) => {
                if (err) {
                    return
                }
                
        const fileTime = stats.mtime;
        const currentTime = new Date();
        const fileAgeInMinutes = (currentTime - fileTime) / (1000 * 60 * 60);        

        // Do not delete any Baileys auth files or session keys
        const isAuthFile = file.includes("creds.json") ||
            file.startsWith("app-state-") ||
            file.startsWith("pre-key-") ||
            file.startsWith("session-") ||
            file.startsWith("sender-key-") ||
            file.startsWith("terminal-vast") ||
            file.endsWith(".json");

        if (!isAuthFile && (file.endsWith(".tmp") || file.endsWith(".bak"))) {
            try {
                fs.unlinkSync(filePath);
                count += 1;
            } catch (_) {}
        }
            });
        });
        if (count > 1) console.log(chalk.cyan.bold(` ${count} Session junk files successfully cleaned`))
    });
}

module.exports = { cleaningSession }