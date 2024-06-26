
let filterMode = 0;
let isLazer;
let intervalID;
let filtersOn = false;

let filters = {};

document.addEventListener('DOMContentLoaded', () => {
  isLazer = true;
  updateButtons();
  tooltipHandle();
  initFilters();
  initCalls();
});
function initCalls() {
  if (isLazer) {
    removePlates();
    displayStatus('.loading');
    clearInterval(intervalID);
    getRooms();
    intervalID = setInterval(getRooms, 5000);
  } else {
    removePlates();
    displayStatus('.stablewarning');
    clearInterval(intervalID);

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
  document.querySelector('.filtersinfo').style.display = 'none';
  //enable status if it exists
  try {
    document.querySelector(status).style.display = 'flex';
  }
  catch { }
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
    _toggleB(button, index === filterMode);
  });
  const gbuttons = document.querySelector('.bgame').querySelectorAll('button');
  _toggleB(gbuttons[0], isLazer);
  _toggleB(gbuttons[1], !isLazer);
  const fbutton = document.querySelector('.bfilter').querySelector('button');
  _toggleB(fbutton, filtersOn);
}

function _toggleB(button, on) {
  if (on) button.classList.add('active');
  else button.classList.remove('active');
}

// Function to create and populate plates from the rooms array
function getRooms() {
  fetch('https://localhost:3000/rooms', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })
    .then(data => (data.json()))
    .then(res => {
      if (filtersOn) populatePlates(filterRooms(res))
      else populatePlates(res); // Call your function to update UI with 'rooms' data
    })
    .catch(error => {
      console.error('Error fetching data:', error);
    });
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

function populatePlates(rooms) {

  const container = document.querySelector('.container');
  const examplePlate = document.getElementById('example-plate');
  examplePlate.style.display = 'none';
  removePlates();
  console.log(rooms);
  let roomsAdded = 0;
  rooms.forEach(room => {
    let mindif = 999;
    let maxdif = 0;
    let modes = [0, 0, 0, 0];
    let expCounter = 0;
    let currentBeatmapFound = false;
    let beatmapQueue = [];
    let allDif = [];
    const playlist = room['playlist'];
    for (let i = playlist.length - 1; i >= 0; i--) {
      if (playlist[i]['expired']) {
        if (!currentBeatmapFound) {
          currentBeatmapFound = true;
        }
        expCounter++;
        if (expCounter > 5) break;
      }
      //queue inicialization
      if (!currentBeatmapFound) {
        beatmapQueue.push(playlist[i]);
        //modes determine only by future maps
        modes.forEach((mode, index) => {
          if (playlist[i]['ruleset_id'] == index) {
            modes[index] = 1;
          }
        });
      }
      const sr = playlist[i]['beatmapdif'];
      if (sr < mindif) {
        mindif = sr;
      }
      if (sr > maxdif) {
        maxdif = sr;
      }
      allDif.push(sr);
    }

    if(mindif > Number(maxf.value) || maxdif < Number(minf.value)) return;
    //if queue is empty add first expired beatmap 
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
    if (filterMode != roomMode && roomMode != 'mixed') return;
    //create a web plate
    const newPlate = examplePlate.cloneNode(true);
    newPlate.id = 'room';
    const plist = newPlate.querySelector('.participantslist');
    let players = room['recent_participants'];
    players.forEach(pl => {
      if (room['hostid'] != pl['id']) {
        const img = newPlate.querySelector('.authorimg').cloneNode();
        img.style.backgroundImage = `url('${pl['avatar_url']}')`;
        plist.appendChild(img);
      }
    });
    newPlate.querySelector('.participantslist .count').textContent = '+ ' + (players.length - 1);
    newPlate.querySelector('.author .authorimg').style.backgroundImage = `url('${room['hostavatar_url']}')`;
    newPlate.querySelector('.authorname').textContent = room['hostusername'];
    newPlate.querySelector('.authorname').href = 'https://osu.ppy.sh/users/' + room['hostid'];
    let roomName = room['name'];
    const roomTooltip = newPlate.querySelector('.roomname .tooltiptext');

    if (roomName.length > 50) {
      roomTooltip.textContent = roomName;
      roomName = roomName.substring(0, 50) + '...';
    } else {
      roomTooltip.remove();
    }
    newPlate.querySelector('.roomname h2').textContent = roomName;

    queue = beatmapQueue.length;

    //"1 beatmap" is default text
    if (queue != 1) newPlate.querySelector('.btmcount .count').textContent = queue + ' beatmaps';
    //if no maps in queue, add last expired beatmap
    if (queue == 0) beatmapQueue.push(playlist[playlist.length - 1]);
    if (beatmapQueue.length > 1) {
      let str = '';
      beatmapQueue.forEach((map) => {
        str += map['beatmapsetname'] + ' // ' + map['beatmapversion'] + '<br>';
      });
      newPlate.querySelector('.btmcount .tooltiptext').innerHTML = str;
    }
    else {
      newPlate.querySelector('.btmcount .tooltiptext').remove();
    }
    const currbeatmap = beatmapQueue[beatmapQueue.length - 1];
    const currentLink = 'https://osu.ppy.sh/beatmapsets/' + currbeatmap['beatmapid'] + '#' + currbeatmap['beatmapmode'] + '/' + currbeatmap['id'];
    let currentMap = currbeatmap['beatmapsetname'] + ' // ' + currbeatmap['beatmapversion'];
    newPlate.style.backgroundImage = `url(${currbeatmap['slimcover']})`;
    if (currentMap.length > 50) {
      newPlate.querySelector('.map .tooltiptext').textContent = currentMap;
      currentMap = currentMap.substring(0, 50) + '...';
    } else {
      newPlate.querySelector('.map .tooltiptext').remove();
    }
    newPlate.querySelector('.mapcontent').textContent = currentMap;
    newPlate.querySelector('.mapcontent').href = currentLink;
    let queueMode = room['queue_mode'];
    if (queueMode == 'all_players') queueMode = 'All players';
    if (queueMode == 'all_players_round_robin') queueMode = 'All players (round robin)';
    if (queueMode == 'host_only') queueMode = 'Host only';

    newPlate.querySelector('.selectmode').textContent = queueMode;

    const _min = newPlate.querySelector('.min');
    const _max = newPlate.querySelector('.max');
    if (allDif.length == 1) {
      const _one = newPlate.querySelector('.onestar');
      _one.style.visibility = 'visible';
      if (allDif[0] < 100) allDif[0] = allDif[0].toFixed(2).substring(0, 4);
      else allDif[0] = allDif[0].toFixed(0).substring(0, 3);
      _one.querySelector('div').textContent = '★ ' + allDif[0];
      if (allDif[0] >= 6.5) _one.querySelector('div').style.color = '#ffd966';
      _one.querySelector('div').style.backgroundColor = difficultyColourSpectrum(allDif[0]);
      _min.style.visibility = 'hidden';
      _max.style.visibility = 'hidden';
    } else {
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

    }
    if (allDif.length > 2) {
      let allDifstr = '';
      allDif.forEach((element) => {
        allDifstr = allDifstr + element + ' ';
      });
      newPlate.querySelector('.stars .tooltiptext').textContent = allDifstr;
    } else {
      newPlate.querySelector('.stars .tooltiptext').remove();
    }
    newPlate.querySelector('.joinlink').href = `osump://${room['id']}`;
    newPlate.style.display = 'flex';
    displayStatus('nothing');
    roomsAdded++;
    container.appendChild(newPlate);

  });
  if (roomsAdded == 0) {
    if (filtersOn) {
      document.querySelector('.filtersinfo').innerHTML = `Srearching through '${getFiltersLenght()}' filters`
      displayStatus('.filtersinfo');
    }
    else displayStatus('.norooms');
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



function tooltipHandle() {
  var tooltips = document.querySelectorAll('.tooltip');

  tooltips.forEach(function (tooltip) {
    tooltip.addEventListener('mouseover', function () {
      var tooltipRect = tooltip.getBoundingClientRect();
      var tooltipText = tooltip.querySelector('.tooltiptext');

      // Check if tooltip is near the top of the viewport
      if (tooltipRect.top < tooltipText.offsetHeight + 10) {
        tooltip.setAttribute('data-direction', 'top');
      } else {
        tooltip.removeAttribute('data-direction');
      }
    });

    tooltip.addEventListener('mouseleave', function () {
      tooltip.removeAttribute('data-direction');
    });
  });
}

function toggleFilters() {
  filtersOn = !filtersOn;
  updateButtons();
  removePlates();
  displayStatus('.loading');
  document.querySelector('.bcreate').style.display = filtersOn ? 'flex' : 'none';
  document.querySelector('.bnotif').style.display = filtersOn ? 'flex' : 'none';
}
function filterRooms(rooms) {
  let roomsFound = [];
  rooms.forEach(room => {
    let isFound = false;
    filters.hostis.forEach(element => {
      var fstring = element.split('/');
      if (fstring[fstring.length - 1] == room['hostid'])
        isFound = true;
    });
    filters.hasuser.forEach(element => {
      var fstring = element.split('/');
      room['recent_participants'].forEach(user => {
        if (user['id'] == fstring[fstring.length - 1])
          isFound = true;
      });
    });
    filters.namehas.forEach(element => {
      if (room['name'].includes(element))
        isFound = true;
    })
    if (isFound)
      roomsFound.push(room);
  });
  return roomsFound;
}

function initFilters() {
  _f = localStorage.getItem('filters')
  if (_f == null) {
    filters = { "hasuser": [], "hostis": [], "namehas": [] };
  } else {
    filters = JSON.parse(_f);
    insertText('namehas');
    insertText('hasuser');
    insertText('hostis');

  }
}
function insertText(key) {
  let str = '';
  filters[key].forEach((f, i) => {
    if (i == filters[key].length - 1)
      str += f;
    else
      str += f + ' ';
  });
  document.querySelector('.' + key).value = str;
}

function openFilt() {

  document.querySelector('.exitb').style.display = 'inline';
  document.querySelector('.notifpage').style.display = 'flex';
  updateF();
}
function exitFilt() {
  document.querySelector('.exitb').style.display = 'none';
  document.querySelector('.notifpage').style.display = 'none';
}
function getFiltersLenght() {
  return filters.namehas.length + filters.hasuser.length + filters.hostis.length;
}
function createFilt() {
  insertF('namehas');
  insertF('hasuser');
  insertF('hostis');
  updateF();
}
function insertF(key) {
  let f = document.querySelector('.' + key).value;
  if (f == '') return;
  filters[key].forEach(f => {

    if (!f.includes(f))
      f += f;
  });
  filters[key] = f.split(' ').filter(_ => _ != '');
}
function deleteFilt() {
  filters.hasuser = [];
  filters.hostis = [];
  filters.namehas = [];
  console.log(filters.namehas);
  updateF();
}
function updateF() {
  document.querySelector('.fcount').innerHTML = `You have ${getFiltersLenght()}<br>active filter${getFiltersLenght() == 1 ? '' : 's'}`;
  localStorage.setItem('filters', JSON.stringify(filters));
}
namef.addEventListener(`focus`, () => namef.select());
hostf.addEventListener(`focus`, () => hostf.select());
userf.addEventListener(`focus`, () => userf.select());
minf.addEventListener(`focus`, () => minf.select());
maxf.addEventListener(`focus`, () => maxf.select());

minf.value = '0.0';
maxf.value = '10.0';
minf.addEventListener('input', () => {
  limitStars();
  if (maxf.value.length > 4)
    maxf.value = maxf.value.slice(0, 4);
  if (Number(minf.value) > Number(maxf.value)) maxf.value = minf.value;
});
maxf.addEventListener('input', () => {
  console.log(maxf.value);
  if (maxf.value != '')
    limitStars();
  if (maxf.value.length > 4)
    maxf.value = maxf.value.slice(0, 4);
  if (Number(minf.value) > Number(maxf.value)) minf.value = maxf.value;
  console.log(maxf.value);

});
function limitStars() {
  if (Number(minf.value) < 0) minf.value = 0;
  if (Number(maxf.value) < 0) maxf.value = 0;
  if (Number(minf.value) > 20) minf.value = 20;
  if (Number(maxf.value) > 20) maxf.value = 20;
}
