import { createReadStream, writeFileSync } from 'fs';
import { Readable } from 'stream';

const stream = createReadStream('data/tikplay.json');
const webStream = new ReadableStream({
  start(controller) {
    stream.on('data', chunk => controller.enqueue(chunk));
    stream.on('end', () => controller.close());
    stream.on('error', err => controller.error(err));
  }
});
const response = new Response(webStream);
response.arrayBuffer().then(buf => {
  console.log("Size in response:", buf.byteLength);
});
