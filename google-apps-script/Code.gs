const SHEET_NAME = 'Emails';

function doGet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) return ContentService.createTextOutput('[]').setMimeType(ContentService.MimeType.JSON);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return ContentService.createTextOutput('[]').setMimeType(ContentService.MimeType.JSON);
  const headers = values.shift().map(String);
  const rows = values.filter(row => row.some(value => value !== '')).map(row => {
    const item = {}; headers.forEach((header, index) => item[header] = row[index]);
    if (item.date instanceof Date) item.date = item.date.toISOString();
    return item;
  });
  return ContentService.createTextOutput(JSON.stringify(rows))
    .setMimeType(ContentService.MimeType.JSON);
}
