L.StreetView = L.Control.extend({
  options: {
    google: true,
    yandex: true
  },

  onAdd: function(map) {
    var container = L.DomUtil.create('div', 'leaflet-bar');
    if (this.options.google)
      container.appendChild(this._addProvider(
        'Google', 'Google Street View',
        'https://www.google.com/maps?layer=c&cbll={lat},{lon}'));
    if (this.options.yandex)
      container.appendChild(this._addProvider(
        'Яндекс', 'Yandex Panoramas',
        'https://yandex.ru/maps/?panorama%5Bpoint%5D={lon},{lat}'));

    map.on('moveend', function() {
      var lat = map.getCenter().lat,
          lon = map.getCenter().lng;
      for (var i = 0; i < container.children.length; i++) {
        var tmpl = container.children[i].hrefTemplate;
        tmpl = tmpl.replace('{lon}', L.Util.formatNum(lon, 6)).replace('{lat}', L.Util.formatNum(lat, 6));
        container.children[i].href = tmpl;
      }
    });
    return container;
  },

  _addProvider(letter, title, url) {
    var button = L.DomUtil.create('a');
    button.innerHTML = letter;
    button.href = '#';
    button.hrefTemplate = url;
    button.target = 'streetview';
    button.title = title;
    button.style.padding = '0 8px';
    button.style.width = 'auto';
    return button;
  }
});

L.streetView = function(options) {
  return new L.StreetView(options);
}
