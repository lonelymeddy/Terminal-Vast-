// settings.js
// credit by lonely Meddy 

const config = require('./config');


const settings = {
  ownername: config.ownername || "Lonely Meddy", // Owner name
  botname: config.botname || "Terminal Vast", // custom bot name
  prefa: config.prefa || ['.', '!'], // Command prefixes
  owner: config.owner || ["256702359159"] // Owner phone numbers
};

// Export settings for use in other modules
module.exports = settings;

// Watch for changes to this file and reload if updated
const fs = require('fs');
let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log('\x1b[0;32m' + __filename + ' \x1b[1;32mupdated!\x1b[0m');
  delete require.cache[file];
  require(file);
});