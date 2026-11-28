// Isolated loopback-only QA origin; synthetic records, no live API.
import {readFile} from 'node:fs/promises';
const previewUrl=new URL('../../scripts/serve-projects.mjs',import.meta.url);
const source=(await readFile(previewUrl,'utf8'))
  .replaceAll('import.meta.url',JSON.stringify(previewUrl.href))
  .replace(".listen(4178,'127.0.0.1'", ".listen(4181,'127.0.0.1'")
  .replace("else route.view='projects';render();", "else route.view='sales';render();")
  .replace("console.log('Project preview http://127.0.0.1:4178/?projectPreview=1')", "console.log('Sales QA http://127.0.0.1:4181/?projectPreview=1')");
await import('data:text/javascript,'+encodeURIComponent(source));
