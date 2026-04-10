/**
 * scripts/myauto-mans-data.cjs → data/myauto-manufacturers.json
 */
const fs = require('fs');
const path = require('path');

const rows = require('./myauto-mans-data.cjs');

function logo(id) {
  const s = String(id);
  if (s === '19') return 'https://static.my.ge/myauto/man_logos/jeep.png';
  return `https://static.my.ge/myauto/man_logos/${s}.png`;
}

const out = rows.map(([id, name]) => ({
  myautoManId: String(id),
  name: String(name).trim(),
  logo: logo(id),
}));

const outPath = path.join(__dirname, '..', 'data', 'myauto-manufacturers.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log('წერია', out.length, 'ბრენდი →', outPath);
