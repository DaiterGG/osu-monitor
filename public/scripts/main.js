
let filterMode = 0;
let rooms;
let isLazer;

document.addEventListener('DOMContentLoaded', () => {
  isLazer = true;
  updateButtons();
  initCalls();
});
function initCalls() {
  if (isLazer) {
    removePlates();
    displayStatus('.loading');
    clearInterval();
    getRooms();
    setInterval(getRooms, 5000);
  } else {
    removePlates();
    displayStatus('.stablewarning');
    clearInterval();
    
    //Not available in current API
    // getMatches();
    // setInterval(getMatches, 5000);
  }
}
/**
+ * @param {string} status - html class to display.
+ */
function displayStatus(status) {
  //disable all statuses
  document.querySelector('.loading').style.display = 'none';
  document.querySelector('.stablewarning').style.display = 'none';
  document.querySelector('.norooms').style.display = 'none';
  //enable status if it exists
  try {
    document.querySelector(status).style.display = 'flex';
  }
  catch{console.log(status + ' does not exist');}
}

/**
+ * @param {boolean} game - true if lazer, false if stable.
+ */
function changeGame(game) {
  isLazer = game;
  updateButtons();
  initCalls();
}
function changeMode(newMode) {
  filterMode = newMode;
  console.log('Mode changed to:', filterMode);
  updateButtons();
  initCalls();
}
function updateButtons() {
  const mbuttons = document.querySelector('.bmode').querySelectorAll('button');
  mbuttons.forEach((button, index) => {
    if (index === filterMode) {
      button.style.backgroundColor = '#3a2f37'; // Active button color
    } else {
      button.style.backgroundColor = '#2a2228'; // Default button color
    }
  });
  const gbuttons = document.querySelector('.bgame').querySelectorAll('button');
  if (isLazer) {
    gbuttons[0].style.backgroundColor = '#3a2f37';
    gbuttons[1].style.backgroundColor = '#2a2228';
  } else {
    gbuttons[0].style.backgroundColor = '#2a2228';
    gbuttons[1].style.backgroundColor = '#3a2f37';
  }
}

// Function to create and populate plates from the rooms array
function getRooms() {
  fetch('https://localhost:3000/rooms', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })
    .then(response => response.json())
    .then(data => {
      if (data == undefined) {
        throw new Error('\'rooms\' was not defined correctly');
      }
      rooms = data;
      populatePlates();
    })
    .catch(error => console.error('Error fetching data:', error));
}
function getMatches() {
  //Not available in current API

  // fetch('https://localhost:3000/matches', {
  //   method: 'GET',
  //   headers: {
  //     'Content-Type': 'application/json',
  //   },
  // })
  //   .then(response => response.json())
  //   .then(data => {
  //     if (data == undefined) {
  //       throw new Error('\'matches\' was not defined correctly');
  //     }
  //     rooms = data;
  //     console.log(rooms);
  //     populatePlates();
  //   })
  //   .catch(error => console.error('Error fetching data:', error));
}

function populatePlates() {

  const container = document.querySelector('.container');
  const examplePlate = document.getElementById('example-plate');
  examplePlate.style.display = 'none';
  removePlates();
  console.log(rooms);
  
  let roomsAdded = 0;
  rooms.forEach(room => {
    let mindif = 999;
    let maxdif = 0;
    let currentMap;
    let modes = [0, 0, 0, 0];
    room['playlist'].forEach(beatmap => {
      modes.forEach((mode, index) => {
        if (beatmap['ruleset_id'] == index) {
          modes[index] = 1;
        }
      });
      const sr = beatmap['beatmap']['difficulty_rating'];
      if (sr < mindif) {
        mindif = sr;
      }
      if (sr > maxdif) {
        maxdif = sr;
      }
    });
    let roomMode = -1;
    if (modes[0] + modes[1] + modes[2] + modes[3] > 1) {
      modes.forEach((mode, index) => {
        if (mode == 1 && index == filterMode) roomMode = 'mixed';
        // if mixed but filtermode doesn't match then -1 (skip room)
      });
    } else {
      modes.forEach((mode, index) => {
        if (mode == 1) roomMode = index;
      });
    }

    if (filterMode == roomMode || roomMode == 'mixed') {
      //create a web plate
      const newPlate = examplePlate.cloneNode(true);
      //newPlate.syle.display = 'flex';
      newPlate.id = 'room';

      newPlate.querySelector('h2').textContent = room['name'];
      const currbeatmap = room['playlist'][0]['beatmap'];
      const currentLink = 'https://osu.ppy.sh/beatmapsets/' + currbeatmap['beatmapset_id'] + '#' + currbeatmap['mode'] + '/' + currbeatmap['id'];
      currentMap = currbeatmap['beatmapset']['title'] + ' // ' + currbeatmap['version'];
      if (currentMap.length > 50) {
        currentMap = currentMap.substring(0, 50) + '...';
        newPlate.querySelector('.map').querySelector('.tooltiptext').textContent = room['name'];
      } else {
        newPlate.querySelector('.map').querySelector('.tooltiptext').remove();
      }
      newPlate.querySelector('.mapcontent').textContent = currentMap;
      newPlate.querySelector('.mapcontent').href = currentLink;
      let queueMode = room['queue_mode'];
      if (queueMode == 'all_players') queueMode = 'All players';
      if (queueMode == 'all_players_round_robin') queueMode = 'All players (round robin)';
      if (queueMode == 'host_only') queueMode = 'Host only';

      newPlate.querySelector('.selectmode').textContent = queueMode;
      queue = room['playlist'].length;
      if (queue > 1) newPlate.querySelector('.btmcount').textContent = queue + ' beatmaps';
      const _min = newPlate.querySelector('.min');
      const _max = newPlate.querySelector('.max');
      if (mindif < 100) mindif = mindif.toFixed(2).substring(0, 4);
      else mindif = mindif.toFixed(0).substring(0, 3);
      if (maxdif < 100) maxdif = maxdif.toFixed(2).substring(0, 4);
      else maxdif = maxdif.toFixed(0).substring(0, 3);
      _min.querySelector('div').textContent = '★ ' + mindif;
      _max.querySelector('div').textContent = '★ ' + maxdif;

      if (mindif >= 6.5) _min.style.color = '#ffd966';
      if (maxdif >= 6.5) _max.style.color = '#ffd966';
      _min.style.backgroundColor = difficultyColourSpectrum(mindif);
      _max.style.setProperty('--max-star-color', difficultyColourSpectrum(maxdif));
      newPlate.style.display = 'flex';
      displayStatus('nothing');
      roomsAdded++;
      container.appendChild(newPlate);
    }
  });
  if (roomsAdded == 0) {
    displayStatus('.norooms');
    console.log('No rooms found');
  }
}
function removePlates() {
  const oldplates = document.querySelector('.container').querySelectorAll('#room');
  oldplates.forEach(element => element.remove());
}

//dif color calcutation from osu source code
const difficultyColourSpectrum = d3.scaleLinear()
  .domain([0.1, 1.25, 2, 2.5, 3.3, 4.2, 4.9, 5.8, 6.7, 7.7, 9])
  .clamp(true)
  .range(['#4290FB', '#4FC0FF', '#4FFFD5', '#7CFF4F', '#F6F05C', '#FF8068', '#FF4E6F', '#C645B8', '#6563DE', '#18158E', '#000000'])
  .interpolate(d3.interpolateRgb.gamma(2.2));
