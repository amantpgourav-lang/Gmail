# Gmail Website

## Project files

- `index.html` — page structure and navigation
- `styles.css` — layout, responsive styling and themes
- `app.js` — inbox, selection, navigation and message actions
- `data.js` — 377 existing email records
- `assets/` — header logo, browser icon and profile image
- `sheets-config.js` — Google Sheets connection setting
- `google-apps-script/` — read-only spreadsheet endpoint files

## Publish the updated website

1. Download and extract this ZIP.
2. Open the existing `Gmail` repository on GitHub.
3. Upload the contents of this folder to the repository root, replacing the matching project files and retaining the folder structure.
4. Commit the changes to the `main` branch.
5. Wait for GitHub Pages to deploy, then hard-refresh the website with `Ctrl + Shift + R`.

Keep the repository's Pages setting on the `main` branch and `/ (root)`.

## Inbox behaviour

The website supports category filtering, unread counts, email selection, bulk actions, archive, Trash, Spam, snoozing, All Mail, custom labels, drafts and local browser persistence. The category values in `data.js` remain intact; category badges are hidden in the message rows.

Email actions and newly composed messages are stored in the visitor's browser. The Send action adds a message to the local Sent folder; it does not deliver email to an external recipient.

## Google Sheets

The existing `sheets-config.js` and Apps Script files are retained. If a sheet endpoint is configured, the website can read its rows. The published website displays email content to visitors, so information shown on the public site should be treated as public.

## Account access

The account links open Google's account pages. This website does not authenticate visitors with Google or collect Google passwords.
