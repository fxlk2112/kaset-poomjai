// Isolated loopback origin for synthetic QA; reuse the reviewed preview server.
import {readFile} from 'node:fs/promises';
const previewUrl=new URL('../../scripts/serve-projects.mjs',import.meta.url);
const source=(await readFile(previewUrl,'utf8'))
  .replaceAll('import.meta.url',JSON.stringify(previewUrl.href))
  .replace(".listen(4178,'127.0.0.1'", ".listen(4180,'127.0.0.1'")
  .replace("console.log('Project preview http://127.0.0.1:4178/?projectPreview=1')", "console.log('Isolated audit preview http://127.0.0.1:4180/?projectPreview=1')");
await import('data:text/javascript,'+encodeURIComponent(source));
