const { google } = require('googleapis');

async function testSheet() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  try {
    const sheetId = '1tm22_10KEhSU9GHvdXCxw8dmMQWSno7GJbGO65aQNoc';
    const sheetTitle = '권한부여 '; 

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'${sheetTitle}'!A1:Z5`,
    });
    console.log("시트 데이터:", JSON.stringify(response.data.values, null, 2));
  } catch (error) {
    console.error('Error fetching sheet:', error);
  }
}

testSheet();
