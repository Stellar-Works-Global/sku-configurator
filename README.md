# Stellar Works SKU Configurator

Internal tool for building and checking Stellar Works product SKUs.

The live site is password protected. The whole page is encrypted (AES-256-GCM with a
PBKDF2-SHA256 key), so this public repo only holds ciphertext. The password is never
stored in the repo.

## Updating the site

1. Update the app file (`SKU Configurator.html`). It is assembled from `src/` (kept off GitHub, since
   it holds the unencrypted product data) with the brand fonts and logos:

   ```bash
   python3 assemble.py src/template.html src/data.js src/brand-style.html "../SKU Configurator.html" gate-assets.html
   ```

2. Rebuild the encrypted page:

   ```bash
   SITE_PASSWORD='the-password' node build.mjs "../SKU Configurator.html" index.html
   ```

3. Commit and push `index.html` and `gate-assets.html`; GitHub Pages redeploys in about a minute.

To change the password, rebuild with a new `SITE_PASSWORD` and push. Anyone who ticked
"Remember on this device" will be asked for the new password.

## Brand

Styled to the Stellar Works Brand Guidelines: Washi White / Suiseki Grey with Matcha Green as a
highlight, Moulin Medium (all caps, +20 tracking) for titles, Moulin Bold for subtitles, Caslon Doric
for body copy, and the secondary logo in the header (primary logo on the password page).
Fonts are Commercial Type web fonts used under Stellar Works' web license.
