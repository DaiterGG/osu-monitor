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
let rooms = [];
let roomsAll;
//let matches;
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
    await updateRooms();
    if (rooms == undefined || rooms.length == 0) {
      console.log(`tokens are not set`);
      console.log(`authenticate at ${siteLink}/${authLink}`);
      initializeAuth();
    }
    initCalls();
  } catch (error) {
    console.error('Initializiton server rror:', error.message);
  }
});

function writeData(varData, keyName) {
  jsonData[keyName] = varData.toString();
  fs.writeFileSync('links.json', JSON.stringify(jsonData), 'utf8', (err) => {
    console.log('Error writing to a file:', err);
  });
}
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

        clientId = jsonData['clientId'];
        console.log('clientId:', clientId);

        clientSecret = jsonData['clientSecret'];

        accessToken = jsonData['accessToken'];
        refreshToken = jsonData['refreshToken'];

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
      writeData(accessToken, 'accessToken');
      writeData(refreshToken, 'refreshToken');

      tokenExpirationTime = Date.now() + (tokenData.expires_in * 1000);
      console.log('Access Token:', accessToken);
      console.log('Refresh Token:', refreshToken);
      console.log('Token expires at:', new Date(tokenExpirationTime).toLocaleString());

      res.send(`
      <h3>Token granted. Token expires at: ${new Date(tokenExpirationTime).toLocaleString()}</h3>
    `);

      initCalls();
      await updateRooms();
      //await updateMatches();
    } catch (error) {
      console.error('Error getting access token:', error);
      res.status(500).send('Error getting access token');
    }
  });
}
app.use(async (req, res, next) => {
  refreshTokenIfNeeded();
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

    writeData(accessToken, 'accessToken');
    writeData(refreshToken, 'refreshToken');


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
//app.use('/', express.static(path.join(__dirname + '/public')));


import cors from 'cors';

const corsOptions = {
  origin: ['http://127.0.0.1:5500','https://osumonitor.great-site.net'],
  allowedHeaders: ["ngrok-skip-browser-warning", "Content-Type", "Authorization", "Access-Control-Allow-Methods", "Access-Control-Request-Headers"],
  credentials: true,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));


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
      roomsAll = await response.json();
      filterRooms();

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
function initCalls() {

  app.get('/rooms', async (req, res) => {
    //console.log('Rooms requested');
    updateRooms();
    if (rooms == undefined || rooms.length == 0) console.error('var \'rooms\' was not defined correctly');
    else res.send(rooms);
  });
}

// app.get('/matches', async (req, res) => {
//   await updateMatches();
//   if (matches == undefined) console.error('var \'matches\' was not defined correctly');
//   else res.send(matches);
// });


function filterRooms() {
  
  rooms = [];
  roomsAll.forEach((room) => {
    if (room['has_password']) return;
    let _r = {};
    _r['playlist'] = [];
    room['playlist'].forEach((pl) => {
      let _p = {};
      _p['difficulty'] = pl['difficulty'];
      _p['ruleset_id'] = pl['ruleset_id'];
      _p['beatmapdif'] = pl['beatmap']['difficulty_rating'];
      _p['expired'] = pl['expired'];
      _p['beatmapsetname'] = pl['beatmap']['beatmapset']['title']; 
      _p['beatmapversion'] = pl['beatmap']['version']; 
      _p['beatmapid'] = pl['beatmap']['beatmapset_id'];
      _p['beatmapmode'] = pl['beatmap']['mode'];
      _p['id'] = pl['id'];
      _p['slimcover'] = pl['beatmap']['beatmapset']['covers']['slimcover'];
      _r['playlist'].push(_p);
    })
    _r['recent_participants'] = [];
    room['recent_participants'].forEach((participant) => {
      let _p = {};
      _p['username'] = participant['username'];
      _p['avatar_url'] = participant['avatar_url'];
      _p['id'] = participant['id'];
      _r['recent_participants'].push(_p);
    })
    _r['name'] = room['name'];
    _r['id'] = room['id'];
    _r['queue_mode'] = room['queue_mode'];
    _r['hostusername'] = room['host']['username'];
    _r['hostavatar_url'] = room['host']['avatar_url'];
    _r['hostid'] = room['host']['id'];
    
      rooms.push(_r);
  });
  
}