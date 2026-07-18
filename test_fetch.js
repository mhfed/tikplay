async function run() {
  const fs = require('node:fs');
  const metaStr = fs.readFileSync('data/tikplay.json', 'utf8');
  const db = JSON.parse(metaStr);
  console.log(db.tracks[0].cover); // This is api/cover...
  // Let's get the original url from cache/ .json
  const files = fs.readdirSync('cache').filter((f) => f.endsWith('.json'));
  for (const f of files) {
    const data = JSON.parse(fs.readFileSync(`cache/${f}`));
    console.log('Fetching', data.cover);

    const res = await fetch(data.cover);
    console.log('Status', res.status);
    const buf = await res.arrayBuffer();
    console.log('Size', buf.byteLength);
    break;
  }
}
run();
