// Builds the password-protected GitHub Pages site for the SKU Configurator.
// The whole app is encrypted (AES-256-GCM, key from PBKDF2-SHA256), so the public
// repo only ever holds ciphertext.
//
// Usage:  SITE_PASSWORD='your-password' node build.mjs "../SKU Configurator.html" index.html
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { webcrypto as crypto } from "node:crypto";

const [, , src, out] = process.argv;
const password = process.env.SITE_PASSWORD;
if (!src || !out || !password) {
  console.error('Usage: SITE_PASSWORD="..." node build.mjs <app.html> <out/index.html>');
  process.exit(1);
}

const ITERATIONS = 600000;
const STANDALONE_HEAD = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{margin:0}[hidden]{display:none!important}img{max-width:100%}</style>
`;

let app = readFileSync(src, "utf8").replace(/^<meta charset="utf-8">\s*/, "");
app = STANDALONE_HEAD + app;

const enc = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const baseKey = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
const key = await crypto.subtle.deriveKey(
  { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
  baseKey, { name: "AES-GCM", length: 256 }, false, ["encrypt"]
);
const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(app)));
const b64 = u8 => Buffer.from(u8).toString("base64");
const payload = JSON.stringify({ salt: b64(salt), iv: b64(iv), iterations: ITERATIONS, data: b64(cipher) });

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Stellar Works SKU Configurator</title>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600..700&family=Work+Sans:wght@400;600&display=swap" rel="stylesheet">
<style>
  :root{--bg:#f8f8f5;--surface:#fff;--text:#202020;--muted:#63635c;--border:#c7c7bc;--accent:#819139;--accent-strong:#5f6b2a;--on-accent:#fff;--danger:#a3432f}
  @media (prefers-color-scheme: dark){:root{--bg:#202020;--surface:#292926;--text:#f8f8f5;--muted:#a8a89e;--border:#4e4e47;--accent:#9fb558;--accent-strong:#bbcf7d;--on-accent:#1b1f0d;--danger:#d98467;color-scheme:dark}}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--text);font:15px/1.5 "Work Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:24px 16px}
  form{width:100%;max-width:360px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:24px;display:flex;flex-direction:column;gap:12px}
  .eyebrow{font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
  h1{font-family:"Bricolage Grotesque","Work Sans",sans-serif;font-size:26px;line-height:1.1;margin:0 0 4px}
  label{font-size:13px;font-weight:600}
  input[type=password]{width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font:inherit}
  input[type=password]:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 25%,transparent)}
  .remember{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted);font-weight:400}
  button{padding:10px 12px;border:0;border-radius:8px;background:var(--accent);color:var(--on-accent);font:inherit;font-weight:600;cursor:pointer}
  button:hover{background:var(--accent-strong)}
  button:disabled{opacity:.6;cursor:wait}
  .err{color:var(--danger);font-size:13.5px;min-height:1.2em;margin:0}
</style>
</head>
<body>
<form id="gate" autocomplete="on">
  <div>
    <div class="eyebrow">Stellar Works · Internal</div>
    <h1>SKU Configurator</h1>
  </div>
  <input type="text" name="username" value="sku-configurator" autocomplete="username" hidden>
  <label for="pw">Password</label>
  <input type="password" id="pw" autocomplete="current-password" required autofocus>
  <label class="remember"><input type="checkbox" id="remember"> Remember on this device</label>
  <button type="submit" id="go">Unlock</button>
  <p class="err" id="err" role="alert"></p>
</form>
<script>
const PAYLOAD = ${payload};
const STORE_KEY = "swSkuConfiguratorPw";
const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function unlock(password){
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    {name:"PBKDF2", salt:fromB64(PAYLOAD.salt), iterations:PAYLOAD.iterations, hash:"SHA-256"},
    base, {name:"AES-GCM", length:256}, false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({name:"AES-GCM", iv:fromB64(PAYLOAD.iv)}, key, fromB64(PAYLOAD.data));
  return new TextDecoder().decode(plain);
}
function show(html){ document.open(); document.write(html); document.close(); }
const form = document.getElementById("gate"), err = document.getElementById("err"), go = document.getElementById("go");
form.addEventListener("submit", async e => {
  e.preventDefault();
  const pw = document.getElementById("pw").value;
  go.disabled = true; go.textContent = "Unlocking…"; err.textContent = "";
  try{
    const html = await unlock(pw);
    try{ if(document.getElementById("remember").checked) localStorage.setItem(STORE_KEY, pw); }catch(_){}
    show(html);
  }catch(_){
    err.textContent = "That password isn't right. Check it and try again.";
    go.disabled = false; go.textContent = "Unlock";
  }
});
(async () => {
  let saved = null;
  try{ saved = localStorage.getItem(STORE_KEY); }catch(_){}
  if(!saved) return;
  try{ show(await unlock(saved)); }
  catch(_){ try{ localStorage.removeItem(STORE_KEY); }catch(__){} }
})();
</script>
</body>
</html>
`;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, page);
console.log(`Wrote ${out} (${(page.length / 1024).toFixed(0)} KB, ${ITERATIONS.toLocaleString()} PBKDF2 iterations)`);
