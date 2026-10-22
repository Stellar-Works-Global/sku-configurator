// Builds the password-protected GitHub Pages site for the SKU Configurator.
// The whole app is encrypted (AES-256-GCM, key from PBKDF2-SHA256), so the public
// repo only ever holds ciphertext.
//
// Usage:  SITE_PASSWORD='your-password' node build.mjs "../SKU Configurator.html" index.html
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
// Brand fonts + primary logo for the password page (written by assemble.py)
const assets = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "gate-assets.html"), "utf8");
const logo = assets.match(/<!--LOGO-->([\s\S]*?)<!--\/LOGO-->/)[1];
const gateHead = assets.replace(/<!--LOGO-->[\s\S]*?<!--\/LOGO-->/, "").trim();

const payload = JSON.stringify({ salt: b64(salt), iv: b64(iv), iterations: ITERATIONS, data: b64(cipher) });

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Stellar Works SKU Configurator</title>
${gateHead}
<style>
  :root{--bg:#f8f8f5;--text:#202020;--muted:#5f5f59;--rule:rgba(32,32,32,.34);--ink:#202020;--on-ink:#f8f8f5;--accent:#819139;--danger:#9a3f2c}
  @media (prefers-color-scheme: dark){:root{--bg:#202020;--text:#f8f8f5;--muted:#a9a9a1;--rule:rgba(248,248,245,.34);--ink:#f8f8f5;--on-ink:#202020;--accent:#9fb04f;--danger:#df8a6d;color-scheme:dark}}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--text);font:15px/1.4 "Caslon Doric","Helvetica Neue",Arial,sans-serif;padding:32px max(16px,env(safe-area-inset-right,0px)) 32px max(16px,env(safe-area-inset-left,0px))}
  main{width:100%;max-width:320px;display:flex;flex-direction:column;align-items:center;gap:36px}
  .logo{color:var(--text);line-height:0}
  .logo svg{width:180px;height:auto;display:block;fill:currentColor}
  form{width:100%;display:flex;flex-direction:column;gap:12px}
  h1{font-family:"Moulin",Georgia,serif;font-weight:500;font-size:20px;line-height:1;letter-spacing:.02em;text-transform:uppercase;text-align:center;margin:0 0 12px}
  label{font-size:13px;font-weight:700}
  input[type=password]{width:100%;padding:10px 12px;border:1px solid var(--rule);border-radius:2px;background:transparent;color:var(--text);font:inherit}
  input[type=password]:focus{outline:none;border-color:var(--ink);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 22%,transparent)}
  .remember{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted);font-weight:400}
  .remember input{accent-color:var(--accent)}
  button{padding:11px 12px;border:0;border-radius:2px;background:var(--ink);color:var(--on-ink);font:inherit;font-weight:700;cursor:pointer}
  button:hover{opacity:.86}
  button:disabled{opacity:.6;cursor:wait}
  .err{color:var(--danger);font-size:13.5px;min-height:1.2em;margin:0}
</style>
</head>
<body>
<main>
<div class="logo">${logo}</div>
<form id="gate" autocomplete="on">
  <h1>SKU Configurator</h1>
  <input type="text" name="username" value="sku-configurator" autocomplete="username" hidden>
  <label for="pw">Password</label>
  <input type="password" id="pw" autocomplete="current-password" required autofocus>
  <label class="remember"><input type="checkbox" id="remember"> Remember on this device</label>
  <button type="submit" id="go">Unlock</button>
  <p class="err" id="err" role="alert"></p>
</form>
</main>
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
