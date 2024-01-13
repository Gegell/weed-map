// Default to Bundestag in Berlin
const default_location = [52.518611, 13.376111];
const default_zoom = 13;

var last_known_location = default_location;
var last_location = default_location;
var last_zoom = default_zoom;
// Read from local storage
if (localStorage.getItem('last_known_location')) {
    last_known_location = JSON.parse(localStorage.getItem('last_known_location'));
}
if (localStorage.getItem('last_location')) {
    last_location = JSON.parse(localStorage.getItem('last_location'));
} else {
    last_location = last_known_location;
}
if (localStorage.getItem('last_known_zoom')) {
    last_zoom = JSON.parse(localStorage.getItem('last_known_zoom'));
}

var map = L.map('map').setView(last_location, last_zoom);

function onLocationFound(e) {
    last_known_location = e.latlng;
    localStorage.setItem('last_known_location', JSON.stringify(last_known_location));

    pingLocation(map, e.latlng, e.accuracy / 2);
}

function onLocationError(e) {
    console.log(e.message);
    if (localStorage.getItem('last_location')) {
        last_location = JSON.parse(localStorage.getItem('last_location'));
    }

    pingLocation(map, last_location, 10);
}

function onZoomEnd(e) {
    const zoom = e.target._zoom;
    localStorage.setItem('last_known_zoom', JSON.stringify(zoom));

    // If the user zooms out too far, disable the calculate zones button
    let btn = document.querySelector('.leaflet-control-find-zones');
    btn.disabled = zoom < 14;
    let label = btn.querySelector('span');
    let icon = btn.querySelector('img');
    icon.hidden = btn.disabled;
    if (btn.disabled) {
        label.innerHTML = 'Zoomen Sie näher heran';
    } else {
        label.innerHTML = 'Bereiche anzeigen';
    }
}

function onMoveEnd(e) {
    const center = e.target.getCenter();
    localStorage.setItem('last_location', JSON.stringify(center));
}

expFadeOut = (time, duration) => Math.exp(-time / duration * 5);  // e^(-5) ~= 0.0067 % remains at t = duration
expFadeIn = (time, duration) => 1 - expFadeOut(time, duration);
smoothStep = (x, a, b) => {
    x = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return x * x * (3 - 2 * x);
}

function pingLocation(map, latlng, radius) {
    map.setView(latlng, last_zoom);

    // Add a ping on the map at the user's location which will fade out in 4 seconds
    let ping = L.circle(latlng, radius, {
        opacity: 0,
        fillOpacity: 0,
    }).addTo(map);

    const animation_duration = 4000;
    const flash_frequency = 1;
    const fps = 60;
    const update_interval = 1000 / fps;
    let animation = setInterval((start_time) => {
        const time = Date.now() - start_time;
        let new_opacity = Math.sin(time / 1000 * Math.PI * flash_frequency);
        new_opacity = 0.3 * new_opacity + 0.3;
        // Fade out
        new_opacity *= smoothStep(animation_duration - time, 0, 1000);
        // Fade in
        new_opacity *= smoothStep(time, 0, 1000);

        ping.setStyle({ fillOpacity: new_opacity, opacity: new_opacity });
    }, update_interval, Date.now());
    setTimeout(() => {
        clearInterval(animation);
        map.removeLayer(ping);
    }, animation_duration);
}

function drawZones(map, zones) {
    for (let zone of zones) {
        L.circle(zone, {
            color: 'red',
            fillColor: '#f03',
            fillOpacity: 0.5,
            radius: zone.radius,
        }).addTo(map);
    }
}

makeButtonContainer = () => {
    let container = L.DomUtil.create('div');
    container.classList.add('leaflet-bar');
    container.classList.add('leaflet-touch');
    container.classList.add('leaflet-control');
    return container;
}

makeButton = (container, title, icon) => {
    let anchor = L.DomUtil.create('a');
    anchor.href = '#';
    anchor.title = title;
    anchor.role = 'button';
    anchor.ariaLabel = title;
    anchor.innerHTML = `<img src="icons/${icon}" alt="${title}">`;
    anchor.classList.add('leaflet-control-custom');
    container.appendChild(anchor);
    return anchor;
}

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
}).addTo(map);

map.on('locationfound', e => onLocationFound(e));
map.on('locationerror', e => onLocationError(e));
map.on('zoomend', e => onZoomEnd(e));
map.on('moveend', e => onMoveEnd(e));

// Add button to locate user
L.Control.Locate = L.Control.extend({
    onAdd: function (map) {
        let container = makeButtonContainer();
        let btn = makeButton(container, 'Locate me', 'focus-3-line.svg');
        btn.onclick = () => map.locate({ maximumAge: 10000, timeout: 1000 });
        btn.classList.add('leaflet-control-locate');
        return container
    },
    onRemove: function (map) {
        // Nothing to do here
    }
});
L.control.locate = (opts) => new L.Control.Locate(opts);
L.control.locate({ position: 'topleft' }).addTo(map);

/*
 * Overpass API
 * see https://wiki.openstreetmap.org/wiki/Overpass_API
 * and https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL
 */

async function getNogoEntitiesInBbox(bbox) {
    // Get all the nodes in the bbox that are tagged as nogo
    const bbox_str = [bbox.getSouth(), bbox.getWest(), bbox.getNorth(), bbox.getEast()].join(',');
    const query = `[out:json][timeout:10][bbox:${bbox_str}];
    (
      nwr["amenity"="school"];
      nwr["amenity"="kindergarten"];
      nwr["leisure"="playground"];
      nwr["leisure"="pitch"];
    )->.nogo;
    .nogo out geom;
    `;

    let result = await fetch(
        'https://overpass-api.de/api/interpreter',
        {
            method: 'POST',
            body: "data=" + encodeURIComponent(query),
        },
    ).then(response => response.json());
    console.log(result);
    return result.elements;
}

function getTurfObjectsFromEntities(entities) {
    // Convert the entities to nodes
    return entities.flatMap(element => {
        if (element.type == 'node') {
            return turf.point([element.lon, element.lat]);
        } else if (element.type == 'way') {
            let coordinates = element.geometry.map(node => [node.lon, node.lat]);
            return turf.polygon([coordinates]);
        } else if (element.type == 'relation' && element.tags.type == 'multipolygon') {
            let coordinates = element.members
                .filter(member => member.type == 'way')
                .map(member => member.geometry.map(node => [node.lon, node.lat]));
            return turf.multiLineString(coordinates);
        } else {
            console.log(`Unknown element type: '${element.type}' see `, element);
            return [];
        }
    });
}

function getNogoZoneFromEntities(entities) {
    // Create a buffer around each entity
    turf_objects = getTurfObjectsFromEntities(entities);
    buffers = turf_objects.map(turf_object => turf.buffer(turf_object, 200, { units: 'meters' }));
    return buffers.reduce((acc, buffer) => turf.union(acc, buffer), buffers[0]);

}

function drawEntities(layer, entities) {
    const shared_style = {
        color: 'orange',
        fillColor: '#f93',
        fillOpacity: 0.5,
    };

    for (let entity of entities) {
        if (entity.type == 'node') {
            let options = { ...shared_style, radius: 5 };
            L.circle([entity.lat, entity.lon], options).addTo(layer);
        } else if (entity.type == 'way') {
            let coordinates = entity.geometry.map(node => [node.lat, node.lon]);
            L.polygon(coordinates, shared_style).addTo(layer);
        } else if (entity.type == 'relation' && entity.tags.type == 'multipolygon') {
            entity.members
                .filter(member => member.type == 'way')
                .forEach(member => drawEntities(layer, [member]));
        } else {
            console.log(`Unknown element type: '${entity.type}' see `, entity);
        }
    }
}

function drawZone(layer, zone) {
    const style = {
        color: 'red',
        fillColor: '#f03',
        fillOpacity: 0.1,
        opacity: 0.8,
    };

    L.geoJSON(zone, style).addTo(layer);
}

// Layer to display the zones
let zoneLayer = L.layerGroup().addTo(map);

L.Control.FindZones = L.Control.extend({
    onAdd: function (map) {
        const text = 'Bereiche anzeigen';

        let btn = L.DomUtil.create('button');
        btn.type = 'button';
        btn.title = text;
        btn.role = 'button';
        btn.ariaLabel = text;
        btn.innerHTML = '<img src="icons/seedling-fill.svg" alt="Find zones">';
        let txt_label = L.DomUtil.create('span');
        txt_label.innerHTML = text;
        btn.appendChild(txt_label);
        btn.onclick = async () => {
            let bbox = map.getBounds();
            let entities = await getNogoEntitiesInBbox(bbox);
            let zone = getNogoZoneFromEntities(entities);
            zoneLayer.clearLayers();
            drawZone(zoneLayer, zone);
            drawEntities(zoneLayer, entities);
        };
        btn.classList.add('leaflet-control-find-zones');
        return btn
    },
    onRemove: function (map) {
        // Nothing to do here
    }
});
L.control.findZones = (opts) => new L.Control.FindZones(opts);
L.control.findZones({ position: 'topright' }).addTo(map);
