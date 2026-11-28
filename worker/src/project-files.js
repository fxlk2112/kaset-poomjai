/* Private, content-addressed project documents. No public URL or inline state copy. */
const MAX_BYTES = 2 * 1024 * 1024;
const EXTENSIONS = new Set(['pdf', 'docx', 'xlsx', 'csv', 'txt']);

export async function projectFileAction(env, payload, user) {
  if (!env.PHOTOS) throw new Error('พื้นที่เก็บเอกสารยังไม่พร้อม');
  const prefix = 'project-private/' + user.user_id + '/';
  if (payload.action === 'project_file_put') {
    const ext = String(payload.name || '').split('.').pop().toLowerCase();
    const b64 = payload.data;
    if (!EXTENSIONS.has(ext) || typeof b64 !== 'string' || !b64.length || b64.length > Math.ceil(MAX_BYTES / 3) * 4 || b64.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) throw new Error('ใช้ PDF, DOCX, XLSX, CSV หรือ TXT ขนาดไม่เกิน 2 MB');
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    if (!bytes.length || bytes.length > MAX_BYTES) throw new Error('ขนาดเอกสารไม่ถูกต้อง');
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
    const key = prefix + hash + '.' + ext;
    // Repeated uploads/migration of saved report versions share one immutable object.
    await env.PHOTOS.put(key, bytes, {httpMetadata:{contentType:'application/octet-stream'}});
    return {key, size:bytes.length};
  }
  const key = String(payload.key || '');
  if (!key.startsWith(prefix) || !/^[a-f0-9]{64}\.(pdf|docx|xlsx|csv|txt)$/.test(key.slice(prefix.length))) throw new Error('ไม่มีสิทธิ์อ่านเอกสารนี้');
  const object = await env.PHOTOS.get(key);
  if (!object || object.size > MAX_BYTES) throw new Error('ไม่พบเอกสาร');
  const bytes = new Uint8Array(await object.arrayBuffer());
  if (bytes.length > MAX_BYTES) throw new Error('เอกสารใหญ่เกิน');
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.slice(i, i + 8192));
  return {data:btoa(binary)};
}
