# Stellar Works SKU Configurator

Internal tool for building and checking Stellar Works product SKUs.

The live site is password protected. The whole page is encrypted (AES-256-GCM with a
PBKDF2-SHA256 key), so this public repo only holds ciphertext. The password is never
stored in the repo.

## Updating the site

1. Update the app file (`SKU Configurator.html`).
2. Rebuild the encrypted page:

   ```bash
   SITE_PASSWORD='the-password' node build.mjs "../SKU Configurator.html" index.html
   ```

3. Commit and push `index.html`; GitHub Pages redeploys in about a minute.

To change the password, rebuild with a new `SITE_PASSWORD` and push. Anyone who ticked
"Remember on this device" will be asked for the new password.
