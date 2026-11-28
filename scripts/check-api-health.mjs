const origin=process.argv[2];
if(!origin || new URL(origin).protocol!=='https:')throw Error('Provide the public HTTPS origin');
const response=await fetch(new URL('/api',origin),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'health'}),signal:AbortSignal.timeout(20000)});
const result=await response.json();
if(!response.ok || !result.ok || result.data?.output_control_allowed!==false || !result.data?.capabilities?.includes('project_files_v1'))throw Error('Same-origin API/binding or required backend capability is unavailable; release stopped');
console.log('Same-origin API, document capability and SAFE_OFF verified');
