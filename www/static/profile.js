var bboxesLayer;

$(function() {
    map = L.map('map', {minZoom: 4, maxZoom: 15, editable: true});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>'
    }).addTo(map);

	L.BoxControl = L.Control.extend({
        onAdd: function (map) {
            var container = L.DomUtil.create('div', 'leaflet-control leaflet-bar'),
                link = L.DomUtil.create('a', '', container);

            link.href = '#';
            link.title = 'Create a new box';
            link.innerHTML = '⬛';
            L.DomEvent.on(link, 'click', L.DomEvent.stop)
                      .on(link, 'click', function () {
                        map.editTools.startRectangle();
                      }, this);

            return container;
        }
    });
	map.addControl(new L.BoxControl({ position: 'topleft' }));

	function addDeletePopup(layer) {
		var btn = $('<button>Delete</button>');
		btn.click(function() {
			bboxesLayer.removeLayer(layer);
		});
		layer.bindPopup(btn[0]);
	}

	bboxesLayer = L.featureGroup().addTo(map);
	map.setView([50, 10], 4);
	map.editTools.featuresLayer = bboxesLayer;

    var bboxes_str = $('#bboxes').val(),
        bboxes = bboxes_str.split(';');
    for (var i = 0; i < bboxes.length; i++) {
        var c = bboxes[i].split(',');
        if (c.length == 4) {
            var rect = L.rectangle([[+c[0], +c[1]], [+c[2], +c[3]]]).addTo(bboxesLayer);
			addDeletePopup(rect);
			rect.enableEdit();
        }
    }
    if (bboxesLayer.getLayers().length > 0)
        map.fitBounds(bboxesLayer.getBounds());

	map.on('editable:drawing:end', function(e) {
		addDeletePopup(e.layer);
		updateBBoxes();
	});
	map.on('editable:dragend', updateBBoxes);
	bboxesLayer.on('layerremove', updateBBoxes);
});

function updateBBoxes() {
	var boxes = [];
	bboxesLayer.eachLayer(function(box) {
		var b = box.getBounds(),
			c1 = b.getSouthWest(),
			c2 = b.getNorthEast();
		boxes.push([c1.lat, c1.lng, c2.lat, c2.lng].join(','));
	});
	$('#bboxes').val(boxes.join(';'));
	console.log($('#bboxes').val());
}
