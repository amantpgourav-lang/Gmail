# Gmail Website

## Project files

- `index.html` — page structure
- `styles.css` — layout and theme styling
- `app.js` — inbox interactions
- `data.js` — existing email records
- `assets/` — supplied logo and profile image
- `sheets-config.js` — Google Sheets connection URL
- `google-apps-script/Code.gs` — read-only endpoint for the email sheet

## Publish on GitHub Pages

1. Create a new GitHub repository and upload the contents of this folder.
2. Open the repository settings, choose Pages, and publish from the main branch root.
3. Open the published site and verify the inbox layout.

## Connect Google Sheets

1. Create a Google Sheet and name its first tab `Emails`.
2. Add the column headings from `google-apps-script/Emails.csv` as the first row.
3. Open Extensions → Apps Script. Replace the editor contents with `google-apps-script/Code.gs` and save.
4. Choose Deploy → New deployment → Web app. Set execution to your account and access to anyone. Deploy and copy the web app URL.
5. Paste that URL into `sheets-config.js` as the value of `window.SHEETS_API_URL`. Commit the change to GitHub.
6. Add one row per email in the private spreadsheet. The website reads the rows and displays new records.

The spreadsheet remains private. The published website can display its email rows, so any information entered there should be considered public to site visitors. The endpoint is read-only; it does not expose a spreadsheet editing interface.

## Sending

The Send action adds the composed message to the local Sent view. It does not deliver an email to the recipient.

## Account management

The account-management link opens Google's account page in a new tab. The website does not authenticate visitors with Google.
