async function run() {
  const fs = require('node:fs');
  const files = fs.readdirSync('cache').filter((f) => f.endsWith('.json'));
  for (const f of files) {
    const meta = JSON.parse(fs.readFileSync(`cache/${f}`));
    console.log('Thumbnail URL:', meta.cover); // Wait, meta.cover might be /api/cover. Let's see if original is there wait, meta.cover was overwritten!
    // But we can extract the original from yt-dlp dump json from the source? No we don't have it.
    break;
  }
}
run();
