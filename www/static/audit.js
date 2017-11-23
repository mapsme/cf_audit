var map1, map2, marker1, marker2, smarker1, smarker2, feature, keys, lastView, defaultTitle;

$(function() {
  map1 = L.map('map1', {minZoom: readonly ? 6 : 15, maxZoom: 19, zoomControl: false});
  map2 = L.map('map2', {minZoom: readonly ? 6 : 15, maxZoom: 19, zoomControl: false});
  map1.attributionControl.setPrefix('');
  map2.attributionControl.setPrefix('');

  L.control.zoom({position: 'topright'}).addTo(map1);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>', maxZoom: 19
  }).addTo(map1);

  map2.setView([20, 5], 7);
  var miniLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>', maxZoom: 19
  });
  var miniMap = new L.Control.MiniMap(miniLayer, {
    position: 'topright',
    height: 100,
    zoomLevelOffset: -6,
    minimized: true
  }).addTo(map2);

  var imageryLayers = {
    "Bing": L.bingLayer("AqXL21QURkJrJz4m4-IJn2smkeX5KIYsdhiNIH97boShcUMagCnQPn3JMYZjFEoH", {
      type: "Aerial", maxZoom: 21
    }),
    'Esri': L.tileLayer('https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '<a href="https://wiki.openstreetmap.org/wiki/Esri">Terms & Feedback</a>', maxZoom: 22
    }),
    'DG Std': L.tileLayer("https://{s}.tiles.mapbox.com/v4/digitalglobe.0a8e44ba/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoiZGlnaXRhbGdsb2JlIiwiYSI6ImNqOGRmNW9qZjBudmgzMnA1a294OGRtNm8ifQ.06mo-nDisy4KmqjYxEVwQw", {
      attribution: '<a href="https://wiki.openstreetmap.org/wiki/DigitalGlobe">Terms & Feedback</a>', maxZoom: 22
    }),
    'DG Pr': L.tileLayer("https://{s}.tiles.mapbox.com/v4/digitalglobe.316c9a2e/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoiZGlnaXRhbGdsb2JlIiwiYSI6ImNqOGRmNXltOTBucm0yd3BtY3E5czl6NmYifQ.qJJsPgCjyzMCm3YG3YWQBQ", {
      attribution: '<a href="https://wiki.openstreetmap.org/wiki/DigitalGlobe">Terms & Feedback</a>', maxZoom: 22
    })
  };
  L.control.layers(imageryLayers, {}, {collapsed: false, position: 'bottomright'}).addTo(map2);
  imageryLayers['Bing'].addTo(map2);

  var move = true;
  map1.on('move', function() {
    if (move) {
      move = false;
      map2.setView(map1.getCenter(), map1.getZoom(), { animate: false });
      move = true;
    }
  });
  map2.on('move', function() {
    if (move) {
      move = false;
      map1.setView(map2.getCenter(), map2.getZoom(), { animate: false });
      move = true;
    }
  });

  if (readonly && features) {
    var fl = L.featureGroup(),
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
      m.on('click', function(e) {
        querySpecific(e.target.ref);
      });
      fl.addLayer(m);
    }
    map1.addLayer(fl);
  }

  defaultTitle = $('#title').html();
  $('#hint').hide();
  map1.on('zoomend', function() {
    if (map1.getZoom() >= 10) {
      if (readonly) {
        $('#zoom_out').show();
        $('#zoom_all').show();
      }
      miniMap._setDisplay(false);
    } else {
      if (readonly) {
        hidePoint();
        $('#zoom_out').hide();
        $('#zoom_all').hide();
      }
      miniMap._setDisplay(true);
    }
  });
  if (readonly) {
    $('#editthis').hide();
    $('#zoom_out').click(function() {
      hidePoint();
      if (lastView) {
        map1.setView(lastView[0], lastView[1]);
        lastView = null;
      } else if (map1.getZoom() >= 10)
        map1.zoomOut(5);
    });
    $('#zoom_all').click(function() {
      hidePoint();
      map1.fitBounds(fl.getBounds());
    });
    $('#random').click(function() { queryNext(); });
    map1.fitBounds(fl.getBounds());
  } else {
    $('#good').click({good: true}, submit);
    $('#bad').click({good: false, msg: ''}, submit);
    $('#bad_dup').click({good: false, msg: 'duplicate'}, submit);
    $('#bad_nosuch').click({good: false, msg: 'no such venue'}, submit);
    $('#skip').click({good: true, msg: 'skip'}, submit);
    if (forceRef)
      querySpecific(forceRef);
    else
      queryNext();
  }
});

function queryNext(audit) {
  $.ajax(endpoint + '/feature/' + projectId, {
    contentType: 'application/json',
    data: audit == null ? (readonly ? {browse: 1} : null) : JSON.stringify(audit),
    method: audit ? 'POST' : 'GET',
    dataType: 'json',
    error: function(x,e,h) { window.alert('Ajax error. Please reload the page.\n'+e+'\n'+h); hidePoint(); },
    success: function(data) { data.feature.ref = data.ref; displayPoint(data.feature, data.audit || {}); }
  });
}

function querySpecific(ref) {
  $.ajax(endpoint + '/feature/' + projectId, {
    contentType: 'application/json',
    data: {ref: ref},
    method: 'GET',
    dataType: 'json',
    error: function(x,e,h) { window.alert('Ajax error. Please reload the page.\n'+e+'\n'+h); hidePoint(); },
    success: function(data) { data.feature.ref = data.ref; displayPoint(data.feature, data.audit || {}); }
  });
}

function displayPoint(data, audit) {
  if (!data.ref) {
    window.alert('Received an empty feature. You must have validated all of them.');
    hidePoint();
    return;
  }

  var movePos = audit['move'], latlon, rlatlon, rIsOSM = false,
      coord = data['geometry']['coordinates'],
      props = data['properties'],
      canMove = !readonly && (props['can_move'] || props['action'] == 'create'),
      refCoord = props['action'] == 'create' ? coord : props['ref_coords'],
      wereCoord = props['were_coords'];

  var $good = $('#good');
  $good.text('Good');
  function setChangedFast() {
    $good.text('Record changes');
  }
  function setChanged() {
    $good.text($.isEmptyObject(prepareAudit()) ? 'Good' : 'Record changes');
  }

  feature = data;
  if (!movePos || !refCoord || movePos == 'osm') {
    if (movePos == 'osm' && wereCoord)
      latlon = L.latLng(wereCoord[1], wereCoord[0]);
    else
      latlon = L.latLng(coord[1], coord[0]);
    rlatlon = refCoord ? L.latLng(refCoord[1], refCoord[0]) : null;
  } else if (movePos == 'dataset' && refCoord) {
    latlon = L.latLng(refCoord[1], refCoord[0]);
    rlatlon = wereCoord ? L.latLng(wereCoord[1], wereCoord[0]) : null;
    rIsOSM = true;
  } else if (movePos.length == 2) {
    latlon = L.latLng(movePos[1], movePos[0]);
    rlatlon = L.latLng(coord[1], coord[0]);
    rIsOSM = !wereCoord && props['action'] != 'create';
  }

  if (marker1) {
    map1.removeLayer(marker1);
    map2.removeLayer(marker1);
  }
  if (marker2) {
    map1.removeLayer(marker2);
    map2.removeLayer(marker2);
  }
  if (smarker1) {
    map1.removeLayer(smarker1);
    map2.removeLayer(smarker1);
  }
  if (smarker2) {
    map1.removeLayer(smarker2);
    map2.removeLayer(smarker2);
  }

  // Pan the map and draw a marker
  if (readonly) {
    lastView = [map1.getCenter(), map1.getZoom()];
    $('#editlink').attr('href', featureTemplateUrl.replace('tmpl', encodeURIComponent(data.ref)));
    $('#editthis').show();
  }
  $('#hint').show();
  if (rlatlon) {
    var smTitle = rIsOSM ? 'OSM location' : 'External dataset location';
    smarker1 = L.marker(rlatlon, {opacity: 0.4, title: smTitle, zIndexOffset: -100}).addTo(map1);
    smarker2 = L.marker(rlatlon, {opacity: 0.4, title: smTitle, zIndexOffset: -100}).addTo(map2);
    $('#tr_which').text(rIsOSM ? 'OSM' : 'external');
    $('#transparent').show();
    map1.fitBounds([latlon, rlatlon], {maxZoom: 18});
  } else {
    $('#transparent').hide();
    map1.setView(latlon, 18);
  }
  var mTitle = rIsOSM ? 'New location after moving' : 'OSM object location';
  marker2 = L.marker(latlon, {draggable: canMove, title: mTitle}).addTo(map2);
  if (!readonly) {
    marker1 = L.marker(latlon, {draggable: canMove, title: mTitle}).addTo(map1);

    if (canMove) {
      $('#canmove').show();
      var move = true;
      marker1.on('move', function () {
        if (move) {
          move = false;
          marker2.setLatLng(marker1.getLatLng());
          move = true;
        }
      });
      marker2.on('move', function () {
        if (move) {
          move = false;
          marker1.setLatLng(marker2.getLatLng());
          move = true;
        }
      });
      marker1.on('dragend', function() {
        map1.panTo(marker1.getLatLng());
        setChanged();
      });
      marker2.on('dragend', function() {
        map1.panTo(marker2.getLatLng());
        setChanged();
      });
    } else {
      $('#canmove').hide();
    }
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

  $('#buttons button').each(function() { $(this).prop('disabled', false); });
  if (readonly) {
    // TODO: show or hide "zoom" buttons depending on selected feature
  } else if (props['action'] == 'modify') {
    $('#bad').hide();
    $('#bad_dup').show();
    $('#bad_nosuch').show();
    $('#good').focus();
  } else {
    $('#bad').show();
    $('#bad_dup').hide();
    $('#bad_nosuch').hide();
    $('#good').focus();
  }

  if (!readonly) {
    $('#fixme_box').show();
    $('#fixme').val(audit['fixme'] || '');
    $('#fixme').on('input', setChangedFast);
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
      if (!readonly && (k == 'source' || k.startsWith('ref') || k == 'fixme') && !key.startsWith('ref_unused')) {
        if (k == 'fixme')
          $('#fixme').val(props[key]);
        keys.push([k, props[key]]);
        skip[k] = true;
      }
      else if (key.startsWith('tags_new.'))
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
        if (props['action'] == 'create')
          keys.push([k, '', props[key], true]);
        else if (!skip[k])
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

  // Render the table
  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
      rows += '<tr class="tagedit"><th rowspan="2">' + esc(key[0]) + '</th>';
      rows += '<td>' + (!key[1] ? notset : esc(key[1])) + '&nbsp;<input type="radio" name="r'+i+'" value="1-'+i+'"></td>';
      rows += '</tr><tr class="tagedit lower"><td>' + (!key[2] ? notset : esc(key[2])) + '&nbsp;<input type="radio" name="r'+i+'" value="2-'+i+'"></td></tr>';
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

  var rowidx_to_td = {};
  $('#tags td').each(function() {
    var $radio = $(this).children('input');
    if (!$radio.length)
      return;
    var idx = +$radio.val().substr(2),
        which = +$radio.val()[0],
        row = keys[idx],
        selected = (which == 1 && !row[4]) || (which == 2 && row[4]);
    if (!rowidx_to_td[idx])
      rowidx_to_td[idx] = [null, null];
    rowidx_to_td[idx][which] = $(this);
    if (selected) {
      $radio.prop('checked', true);
      $(this).addClass(cellColor(row, which));
    }
    if (readonly)
      $radio.hide();
    else {
      $(this).click(function() {
        $radio.prop('checked', true);
        $(this).addClass(cellColor(row, which));
        rowidx_to_td[idx][3-which].children('input').prop('checked', false);
        rowidx_to_td[idx][3-which].removeClass(cellColor(row, 3-which));
        keys[idx][4] = which == 2;
        setChanged();
      });
    }
  });
}

function hidePoint() {
  $('#tags').empty();
  $('#hint').hide();
  $('#fixme_box').hide();
  $('#title').html(defaultTitle);
  if (marker2) {
    map1.removeLayer(marker2);
    map2.removeLayer(marker2);
  }
  if (smarker1) {
    map1.removeLayer(smarker1);
    map2.removeLayer(smarker1);
  }
  if (smarker2) {
    map1.removeLayer(smarker2);
    map2.removeLayer(smarker2);
  }
}

function prepareAudit(data) {
  var fixme = $('#fixme').val(),
      audit = {},
      maxd = 3, // max distance to register change in meters
      coord = feature['geometry']['coordinates'],
      osmCoord = feature['properties']['were_coords'],
      dataCoord = feature['properties']['ref_coords'],
      newCoordTmp = marker1.getLatLng(),
      newCoord = [L.Util.formatNum(newCoordTmp.lng, 7), L.Util.formatNum(newCoordTmp.lat, 7)];

  // Record movement
  function distance(c1, c2) {
    if (!c2)
      return 1000000;
    var rad = Math.PI / 180,
	lat1 = c1[1] * rad,
	lat2 = c2[1] * rad,
	a = Math.sin(lat1) * Math.sin(lat2) +
	    Math.cos(lat1) * Math.cos(lat2) * Math.cos((c2[0] - c1[0]) * rad);

    return 6371000 * Math.acos(Math.min(a, 1));
  }
  if (distance(newCoord, coord) > maxd) {
    if (distance(newCoord, osmCoord) < maxd)
      audit['move'] = 'osm';
    else if (distance(newCoord, dataCoord) < maxd)
      audit['move'] = 'dataset';
    else
      audit['move'] = newCoord;
  }

  // Record tag changes
  for (var i = 0; i < keys.length; i++) {
    if (keys[i][3] != keys[i][4]) {
      if (keys[i][4]) {
        if (!audit['override'])
          audit['override'] = []
        audit['override'].push(keys[i][0]);
      } else {
        if (!audit['keep'])
          audit['keep'] = []
        audit['keep'].push(keys[i][0]);
      }
    }
  }

  // Record fixme
  if (fixme)
    audit['fixme'] = fixme;

  // Record good/bad and comment
  if (data && !data.good) {
    audit['skip'] = true;
    audit['comment'] = data.msg;
  }

  return audit;
}

function submit(e) {
  // Send audit result and query the next feature
  var audit = prepareAudit(e.data);
  $('#buttons button').each(function() { $(this).prop('disabled', true); });
  queryNext(e.data.msg == 'skip' ? null : [feature.ref, audit]);
}
