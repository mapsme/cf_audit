L.StreetView = L.Control.extend({
  options: {
    google: true,
    yandex: true,
    mapillary: false,
    mosatlas: true,
  },

  bounds: {
    yandex: L.latLngBounds([[35.6, 18.5], [72, 180]]),
    mosatlas: L.latLngBounds([[55.113, 36.708], [56.041, 38]])
  },

  onAdd: function(map) {
    this._container = L.DomUtil.create('div', 'leaflet-bar');
    this._buttons = [];

    this._addProvider('google', 'GSV', 'Google Street View',
      'https://www.google.com/maps?layer=c&cbll={lat},{lon}');
    this._addProvider('yandex', 'ЯП', 'Yandex Panoramas',
      'https://yandex.ru/maps/?panorama%5Bpoint%5D={lon},{lat}');
    this._addProvider('mapillary', 'Mpl', 'Mapillary Photos',
      'https://www.mapillary.com/app/?lat={lat}&lng={lon}&z=17&focus=photo');
    this._addProvider('mosatlas', 'Мос', 'Панорамы из Атласа Москвы',
      'http://atlas.mos.ru/?lang=ru&z=9&ll={lon}%2C{lat}&pp={lon}%2C{lat}');

    map.on('moveend', function() {
      if (!this._fixed)
        this._update(map.getCenter());
    }, this);
    this._update(map.getCenter());
    return this._container;
  },

  fixCoord: function(latlon) {
    this._update(latlon);
    this._fixed = true;
  },

  releaseCoord: function() {
    this._fixed = false;
    this._update(this._map.getCenter());
  },

  _addProvider: function(id, letter, title, url) {
    if (!this.options[id])
      return;
    var button = L.DomUtil.create('a');
    button._bounds = this.bounds[id];
    button.innerHTML = letter;
    button.href = '#';
    button._template = url;
    button.target = 'streetview';
    button.title = title;
    button.style.padding = '0 8px';
    button.style.width = 'auto';

    // Overriding some of the leaflet styles
    button.style.display = 'inline-block';
    button.style.border = 'none';
    button.style.borderRadius = '0 0 0 0';
    this._buttons.push(button);
  },

  _update: function(center) {
    if (!center)
      return;
    var last;
    for (var i = 0; i < this._buttons.length; i++) {
      var b = this._buttons[i],
          show = !b._bounds || b._bounds.contains(center),
          vis = this._container.contains(b);

      if (show && !vis) {
        ref = last ? last.nextSibling : this._container.firstChild;
        this._container.insertBefore(b, ref);
      } else if (!show && vis) {
        this._container.removeChild(b);
        return;
      }
      last = b;

      var tmpl = b._template;
      tmpl = tmpl
        .replace(/{lon}/g, L.Util.formatNum(center.lng, 6))
        .replace(/{lat}/g, L.Util.formatNum(center.lat, 6));
      b.href = tmpl;
    }
  }
});

L.streetView = function(options) {
  return new L.StreetView(options);
}
