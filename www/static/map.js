var map, smarker, marker;

$(function() {
  map = L.map('map', {minZoom: 4, maxZoom: 19, zoomControl: false, attributionControl: false});
  L.control.permalinkAttribution().addTo(map);
  map.attributionControl.setPrefix('');
  map.setView([20, 5], 7);

  var imageryLayers = {
    "OSM": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>', maxZoom: 19
    }),
    "Bing": L.bingLayer("AqXL21QURkJrJz4m4-IJn2smkeX5KIYsdhiNIH97boShcUMagCnQPn3JMYZjFEoH", {
      type: "Aerial", maxZoom: 21
    }),
    'Esri': L.tileLayer('https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '<a href="https://wiki.openstreetmap.org/wiki/Esri">Terms & Feedback</a>', maxZoom: 22
    }),
    'DG Std': L.tileLayer("https://{s}.tiles.mapbox.com/v4/digitalglobe.0a8e44ba/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoiZGlnaXRhbGdsb2JlIiwiYSI6ImNqZGFrZ3pjczNpaHYycXFyMGo0djY3N2IifQ.90uebT4-ow1uqZKTUrf6RQ", {
      attribution: '<a href="https://wiki.openstreetmap.org/wiki/DigitalGlobe">Terms & Feedback</a>', maxZoom: 22
    }),
    'DG Pr': L.tileLayer("https://{s}.tiles.mapbox.com/v4/digitalglobe.316c9a2e/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoiZGlnaXRhbGdsb2JlIiwiYSI6ImNqZGFrZ2c2dzFlMWgyd2x0ZHdmMDB6NzYifQ.9Pl3XOO82ArX94fHV289Pg", {
      attribution: '<a href="https://wiki.openstreetmap.org/wiki/DigitalGlobe">Terms & Feedback</a>', maxZoom: 22
    })
  };
  L.control.layers(imageryLayers, {}, {collapsed: false, position: 'bottomright'}).addTo(map);
  imageryLayers['OSM'].addTo(map);

  if (features) {
    var fl = L.markerClusterGroup({
          showCoverageOnHover: false,
          maxClusterRadius: function(zoom) { return zoom < 14 ? 40 : 10; }
        }),
        iconRed = new L.Icon({
          iconUrl: imagesPath + '/marker-red.png',
          shadowUrl: imagesPath + '/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          shadowSize: [41, 41]
        }),
        iconGreen = new L.Icon({
          iconUrl: imagesPath + '/marker-green.png',
          shadowUrl: imagesPath + '/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          shadowSize: [41, 41]
        });
    for (var i = 0; i < features.length; i++) {
      var action = features[i][2],
          icon = action == 'c' ? iconGreen : (action == 'd' ? iconRed : new L.Icon.Default()),
          m = L.marker(features[i][1], {icon: icon});
      m.ref = features[i][0];
      m.bindPopup('... downloading ...');
      m.on('popupopen', function(e) {
        query(e.target);
      });
      m.on('popupclose', onHidePopup);
      fl.addLayer(m);
    }
    map.addLayer(fl);
    map.fitBounds(fl.getBounds());
  }

  var ProjectButton = L.Control.extend({
    onAdd: function(map) {
      var container = L.DomUtil.create('div', 'leaflet-bar'),
          button = L.DomUtil.create('a', '', container);
      button.href = projectUrl;
      button.innerHTML = '← to the project';
      button.style.width = 'auto';
      button.style.padding = '0 4px';
      return container;
    }
  });
  map.addControl(new ProjectButton({ position: 'topleft' }));
  L.control.zoom({position: 'topleft'}).addTo(map);
  var hash = L.hash(map);
  
  if (forceRef) {
    fl.eachLayer(function(layer) {
      if (layer.ref == forceRef) {
        fl.zoomToShowLayer(layer, function() {
          layer.openPopup();
        })
      }
    });
  } else {
    hash.update();
  }
});

function query(target) {
  if (!target.isPopupOpen())
    target.openPopup();

  $.ajax(endpoint + '/feature/' + projectId, {
    contentType: 'application/json',
    data: {ref: target.ref},
    method: 'GET',
    dataType: 'json',
    error: function(x,e,h) { window.alert('Ajax error. Please reload the page.\n'+e+'\n'+h); },
    success: function(data) {
      data.feature.ref = data.ref;
      populatePopup(data.feature, data.audit || {});
      if (target.isPopupOpen && target.isPopupOpen()) {
        target.setPopupContent($('#popup').html().replace(/id="[^"]+"/g, ''));
      } else
        onHidePopup();
    }
  });
}

function populatePopup(data, audit) {
  if (!data.ref) {
    window.alert('Received an empty feature. You must have validated all of them.');
    hidePoint();
    return;
  }

  var movePos = audit['move'], latlon, rlatlon, rIsOSM = false,
      coord = data['geometry']['coordinates'],
      props = data['properties'],
      refCoord = props['action'] == 'create' ? coord : props['ref_coords'],
      wereCoord = props['were_coords'],
      remarks = props['remarks'];

  feature = data;
  if (!movePos || !refCoord || movePos == 'osm') {
    if (movePos == 'osm' && wereCoord)
      latlon = L.latLng(wereCoord[1], wereCoord[0]);
    else
      latlon = L.latLng(coord[1], coord[0]);
    if (wereCoord && movePos != 'osm') {
      rlatlon = L.latLng(wereCoord[1], wereCoord[0]);
      rIsOSM = true;
    } else
      rlatlon = refCoord ? L.latLng(refCoord[1], refCoord[0]) : null;
  } else if (movePos == 'dataset' && refCoord) {
    latlon = L.latLng(refCoord[1], refCoord[0]);
    if (wereCoord)
      rlatlon = L.latLng(wereCoord[1], wereCoord[0]);
    else
      rlatlon = L.latLng(coord[1], coord[0]);
    rIsOSM = true;
  } else if (movePos.length == 2) {
    latlon = L.latLng(movePos[1], movePos[0]);
    rlatlon = L.latLng(coord[1], coord[0]);
    rIsOSM = !wereCoord && props['action'] != 'create';
  }

  if (smarker)
    map.removeLayer(smarker);

  // Pan the map and draw a marker
  var $editThis = $('#editthis');
  if ($editThis.length) {
    $('#editlink').attr('href', featureTemplateUrl.replace('tmpl', encodeURIComponent(data.ref)));
    $editThis.show();
  }

  $('#hint').show();
  if (rlatlon && (props['action'] != 'create' || movePos)) {
    var smTitle = rIsOSM ? 'OSM location' : 'External dataset location';
    smarker = L.marker(rlatlon, {opacity: 0.4, title: smTitle, zIndexOffset: -100}).addTo(map);
    $('#tr_which').text(rIsOSM ? 'OpenStreetMap' : 'external dataset');
    $('#transparent').show();
  } else {
    $('#transparent').hide();
  }

  // Fill in the left panel

  function formatObjectRef(props) {
    return ' a <a href="https://www.openstreetmap.org/' +
      props['osm_type'] + '/' + props['osm_id'] + '" target="_blank">' +
      (props['osm_type'] == 'node' ? 'point' : 'polygon') + '</a>';
  }

  var title;
  if (props['action'] == 'create')
    title = 'Create new node';
  else if (props['action'] == 'delete')
    title = 'Delete' + formatObjectRef(props);
  else if (props['were_coords'])
    title = 'Modify and move' + formatObjectRef(props);
  else if (props['ref_coords'])
    title = 'Update tags on' + formatObjectRef(props);
  else
    title = 'Mark' + formatObjectRef(props) + ' as obsolete';
  $('#title').html(title);

  var verdict = audit['comment'] || '';
  if (audit['create'])
    verdict = 'create new point instead';
  if (audit['skip'] && !verdict)
    verdict = '<empty>';
  if (verdict) {
    $('#last_verdict').text(verdict);
    $('#last_action').show();
  } else {
    $('#last_action').hide();
  }

  // Table of tags. First record the original values for unused tags
  var original = {};
  for (var key in props)
    if (key.startsWith('tags.'))
      original[key.substr(key.indexOf('.')+1)] = props[key];

  // Now prepare a list of [key, osm_value, new_value, is_changed]
  keys = [];
  var skip = {};
  for (var key in props) {
    if (key.startsWith('tags') || key.startsWith('ref_unused_tags')) {
      k = key.substr(key.indexOf('.')+1);
      if (key.startsWith('tags_new.'))
        keys.push([k, '', props[key], true]);
      else if (key.startsWith('tags_deleted.'))
        keys.push([k, props[key], '', true]);
      else if (key.startsWith('ref_unused')) {
        keys.push([k, original[k], props[key], false]);
        skip[k] = true;
      } else if (key.startsWith('tags_changed.')) {
        var i = props[key].indexOf(' -> ');
        keys.push([k, props[key].substr(0, i), props[key].substr(i+4), true]);
      } else if (key.startsWith('tags.')) {
        if (!skip[k])
          keys.push([k, props[key]]);
      }
    }
  }

  // Apply audit data
  for (var i = 0; i < keys.length; i++) {
    if (keys[i].length == 4) {
      if (audit['keep'] && audit['keep'].indexOf(keys[i][0]) >= 0)
        keys[i].push(false);
      else if (audit['override'] && audit['override'].indexOf(keys[i][0]) >= 0)
        keys[i].push(true);
      else
        keys[i].push(keys[i][3]);
    }
  }

  // render remarks, if any. 
  if (remarks) {
    $('#remarks_box').show(); 
    $('#remarks_content').text(remarks);
  } else {
    $('#remarks_box').hide();
  }

  // Render the table
  function esc(s) {
    s = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    if (s.startsWith('http://') || s.startsWith('https://'))
      s = '<a href="'+s+'" target="_blank">'+s+'</a>';
    return s;
  }
  keys.sort(function(a, b) {
    return a.length == b.length ? ((a[0] > b[0]) - (b[0] - a[0])) : a.length - b.length;
  });

  var rows = '', notset = '<span class="notset">not set</span>';
  for (var i = 0; i < keys.length; i++) {
    key = keys[i];
    if (key.length == 2)
      rows += '<tr class="notagedit"><th>' + esc(key[0]) + '</th><td>' + esc(key[1]) + '</td></tr>';
    else {
      rows += '<tr class="notagedit"><th rowspan="2">' + esc(key[0]) + '</th>';
      rows += '<td>' + (!key[1] ? notset : esc(key[1])) + '&nbsp;<input type="radio" name="r'+i+'" value="1-'+i+'"></td>';
      rows += '</tr><tr class="notagedit lower"><td>' + (!key[2] ? notset : esc(key[2])) + '&nbsp;<input type="radio" name="r'+i+'" value="2-'+i+'"></td></tr>';
    }
  }
  $('#tags').empty().append(rows);

  // Set state of each row
  function cellColor(row, which) {
    if (which == 1)
      return row[1] == '' ? 'red' : 'yellow';
    if (which == 2)
      return row[2] == '' ? 'yellow' : 'green';
    return 'green';
  }

  $('#tags td').each(function() {
    var $radio = $(this).children('input');
    if (!$radio.length)
      return;
    var idx = +$radio.val().substr(2),
        which = +$radio.val()[0],
        row = keys[idx];
    var selected = (which == 1 && !row[4]) || (which == 2 && row[4]);
    if (selected) {
      $(this).addClass(cellColor(row, which));
    }
  });
}

function onHidePopup() {
  if (smarker)
    map.removeLayer(smarker);
  smarker = null;
}
