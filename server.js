// server.js
import express from 'express';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import https from 'https';

const app = express();
const PORT = process.env.PORT || 3000;
const redirectUri = '/callback';

let jsonData;
let siteLink;
let authLink;
let clientId;
let clientSecret;
let accessToken;
let refreshToken;
let tokenExpirationTime;
let rooms;
let matches;
// Middleware to serve static files
//app.use(express.static(path.join(__dirname, 'public')));

// HTTPS server options
const options = {
  key: fs.readFileSync('certificate/server.key'), // replace with your key path
  cert: fs.readFileSync('certificate/server.crt'), // replace with your certificate path
};

https.createServer(options, app).listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  try {
    await initializeVar();
    initializeAuth();
  } catch (error) {
    console.error('Error in initial data fetch:', error.message);
  }
});

async function initializeVar() {
  return new Promise((resolve, reject) => {
    fs.readFile('links.json', 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading the file:', err);
        return reject(err);
      }

      try {
        // Parse the JSON data
        jsonData = JSON.parse(data);
        siteLink = `${jsonData['siteLink']}${PORT}`;
        authLink = jsonData['authLink'];
        console.log(`authenticate at ${siteLink}/${authLink}`);

        clientId = jsonData['clientId'];
        console.log('clientId:', clientId);

        clientSecret = jsonData['clientSecret'];
        console.log('clientSecret:', clientSecret);
        resolve();
      } catch (parseError) {
        console.error('Error parsing the JSON data:', parseError);
        reject(parseError);
      }
    });
  });
}

function initializeAuth() {
  // Redirect to auth page
  app.get(`/${authLink}`, async (req, res) => {
    const redirectUriFull = siteLink + redirectUri;
    const authEndpoint = 'https://osu.ppy.sh/oauth/authorize';
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUriFull,
      response_type: 'code',
      scope: 'public'
    });
    const osuAuth = `${authEndpoint}?${params.toString()}`;
    res.redirect(osuAuth);
    console.log('redirecting to ' + osuAuth);
  });

  // Redirect from auth page
  app.get(redirectUri, async (req, res) => {
    const authCode = req.query.code;
    console.log('authCode: ', authCode);

    if (!authCode) {
      return res.status(400).send('No authorization code provided');
    }

    try {
      const tokenEndpoint = 'https://osu.ppy.sh/oauth/token';
      const requestParams = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: authCode,
        grant_type: 'authorization_code',
        redirect_uri: siteLink + redirectUri
      });
      const headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
      };

      const tokenResponse = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: headers,
        body: requestParams
      });

      const tokenData = await tokenResponse.json();

      accessToken = tokenData.access_token;
      refreshToken = tokenData.refresh_token;
      tokenExpirationTime = Date.now() + (tokenData.expires_in * 1000);
      console.log('Access Token:', accessToken);
      console.log('Refresh Token:', refreshToken);
      console.log('Token expires at:', new Date(tokenExpirationTime).toLocaleString());

      res.send(`
      <h3>Token granted. Token expires at: ${new Date(tokenExpirationTime).toLocaleString()}</h3>
    `);

      await updateRooms();
      //await updateMatches();
    } catch (error) {
      console.error('Error getting access token:', error);
      res.status(500).send('Error getting access token');
    }
  });
}
app.use(async (req, res, next) => {
  await refreshTokenIfNeeded();
  next();
});
async function refreshTokenIfNeeded() {
  if (tokenExpirationTime == undefined || Date.now() + 60000 < tokenExpirationTime) {
    return;
  }
  const url = 'https://osu.ppy.sh/oauth/token';

  const requestParams = {
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  };

  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded'
  };

  try {
    const tokenResponse = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: new URLSearchParams(requestParams)
    });

    accessToken = tokenResponse.data.access_token;
    refreshToken = tokenResponse.data.refresh_token;
    tokenExpirationTime = Date.now() + (tokenResponse.data.expires_in * 1000);

    console.log('Access Token refreshed:', accessToken);
    console.log('Token expires at:', new Date(tokenExpirationTime).toLocaleString());
  } catch (error) {
    console.error('Error refreshing access token:', error.response ? error.response.data : error.message);
  }
}

//
//Get web page
//
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
console.log(__dirname);

app.use('/', express.static(path.join(__dirname + '/public')));

//
//Populate web page
//
let lastExecutionTime = 0;
const limit = 5000;
async function updateRooms() {
  const currentTime = Date.now();
  if (currentTime - lastExecutionTime >= limit) {
    lastExecutionTime = currentTime;
    const apiEndpoint = 'https://osu.ppy.sh/api/v2/rooms';

    // Define query parameters
    const queryParams = {
      limit: 100000,
      mode: 'active',
      sort: 'created',
      type_group: 'realtime'
    };
    // Build the URL with query parameters
    const url = new URL(apiEndpoint);
    Object.keys(queryParams).forEach(key => url.searchParams.append(key, queryParams[key]));
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    };
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: headers
      });
      rooms = await response.json();

      console.log('Rooms data fetched successfully');
    } catch (error) {
      console.error('Error fetching rooms:', error.message);
    }
  }
}
//Not available in current API

// let matchesLastCall = 0;
// const matchesTimeLimit = 5000;
// async function updateMatches() {
//   const currentTime = Date.now();
//   if (currentTime - matchesLastCall >= matchesTimeLimit) {
//     matchesLastCall = currentTime;
//     const apiEndpoint = 'https://osu.ppy.sh/api/v2/matches';

//     // Build the URL with query parameters
//     const headers = {
//       'Content-Type': 'application/json',
//       'Accept': 'application/json',
//       'Authorization': `Bearer ${accessToken}`
//     };
//     try {
//       const response = await fetch(apiEndpoint, {
//         method: 'GET',
//         headers: headers
//       });
//       matches = await response.json();
//       //console.log(response["matches"])
//       matches["matches"].forEach(async (element, index) => {
//         const bb = element["id"];

//         const gg = await fetch(`https://osu.ppy.sh/api/v2/matches/${bb}`, {
//           method: 'GET',
//           headers: headers,
//         });
//         console.log(JSON.stringify(await gg.json(), null, 2));
//       });


//       //console.log('Matches data fetched successfully');
//     } catch (error) {
//       console.error('Error fetching Matches:', error);
//     }
//   }
// }
app.get('/rooms', async (req, res) => {
  await updateRooms();
  if (rooms == undefined) console.error('var \'rooms\' was not defined correctly');
  else res.send(rooms);
});

// app.get('/matches', async (req, res) => {
//   await updateMatches();
//   if (matches == undefined) console.error('var \'matches\' was not defined correctly');
//   else res.send(matches);
// });


