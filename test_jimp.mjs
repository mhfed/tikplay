import fs from 'node:fs';

// We'll write a simple un-jpeg script or just copy the file to a base64 string and see if we can deduce if it's black.
// Even better, dump the first 50 bytes of the jpeg to see the tables, or just write it as a data uri so I can inspect the base64 length.
const fb = fs.readFileSync(
  'cache/270d6d711cbbb234f07c3bd24e9864a645d76ad6c90a94a30c27b72a1cb072d9.jpg',
);
console.log('Size:', fb.length);
