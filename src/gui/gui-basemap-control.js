import { internal, geom, error } from './gui-core';
import { SimpleButton } from './gui-elements';
import { El } from './gui-el';
import { fromWebMercator, scaleToZoom } from './gui-dynamic-crs';
import { setLoggingForGUI } from './gui-proxy';
import { getDatasetCrsInfo } from './gui-display-utils';

function loadScript(url, cb) {
  var script = document.createElement('script');
  script.onload = cb;
  script.src = url;
  document.head.appendChild(script);
}

function loadStylesheet(url) {
  var el = document.createElement('link');
  el.rel = 'stylesheet';
  el.type = 'text/css';
  el.media = 'screen';
  el.href = url;
  document.head.appendChild(el);
}

export function Basemap(gui, ext) {
  var menu = gui.container.findChild('.basemap-options');
  var list = menu.findChild('.basemap-styles');
  var container = gui.container.findChild('.basemap-container');
  var basemapBtn = gui.container.findChild('.basemap-btn');
  var basemapNote = gui.container.findChild('.basemap-note');
  var basemapWarning = gui.container.findChild('.basemap-warning');
  var mapEl = gui.container.findChild('.basemap');
  var extentNote = El('div').addClass('basemap-prompt').appendTo(container).hide();
  var params = window.mapboxParams;
  var map;
  var activeStyle;
  var loading = false;

  if (params) {
    init();
  } else {
    basemapBtn.hide();
  }

  function init() {
    gui.addMode('basemap', turnOn, turnOff, basemapBtn);

    new SimpleButton(menu.findChild('.close-btn')).on('click', function() {
      gui.clearMode();
      turnOff();
    });

    gui.on('map_click', function() {
      // close menu if user click on the map
      if (gui.getMode() == 'basemap') gui.clearMode();
    });

    params.styles.forEach(function(style) {
      var btn = El('div').html(`<div class="basemap-style-btn"><img src="${style.icon}"></img></div><div class="basemap-style-label">${style.name}</div>`);
      btn.findChild('.basemap-style-btn').on('click', function() {
        updateStyle(style == activeStyle ? null : style);
        updateButtons();
      });
      btn.appendTo(list);
    });
  }

  function updateStyle(style) {
    activeStyle = style || null;
    // TODO: consider enabling this
    // Make sure that the selected layer style gets updated in gui-map.js
    // gui.state.dark_basemap = style && style.dark || false;
    if (!style) {
      gui.map.setDisplayCRS(null);
      hide();
    } else if (map) {
      map.setStyle(style.url);
      refresh();
    } else {
      initMap();
    }
  }

  function updateButtons() {
    list.findChildren('.basemap-style-btn').forEach(function(el, i) {
      el.classed('active', params.styles[i] == activeStyle);
    });
  }

  function turnOn() {
    var activeLyr = gui.model.getActiveLayer();
    var info = getDatasetCrsInfo(activeLyr.dataset);
    var dataCRS = info.crs || null;
    var displayCRS = gui.map.getDisplayCRS();
    var warning;

    if (!dataCRS || !displayCRS || !crsIsUsable(displayCRS) || !crsIsUsable(dataCRS)) {
      warning = 'The current layer is not compatible with the projection used by the basemaps.';
      basemapWarning.html(warning).show();
      basemapNote.hide();
    } else {
      basemapNote.show();
    }
    menu.show();
  }

  function turnOff() {
    basemapWarning.hide();
    basemapNote.hide();
    menu.hide();
  }

  function enabled() {
    return !!(mapEl && params);
  }

  function show() {
    gui.container.addClass('basemap-on');
    mapEl.node().style.display = 'block';
  }

  function hide() {
    gui.container.removeClass('basemap-on');
    mapEl.node().style.display = 'none';
  }

  function getLonLatBounds() {
    var bbox = ext.getBounds().toArray();
    var tr = fromWebMercator(bbox[2], bbox[3]);
    var bl = fromWebMercator(bbox[0], bbox[1]);
    return bl.concat(tr);
  }


  function initMap() {
    if (!enabled() || map || loading) return;
    loading = true;
    loadStylesheet(params.css);
    loadScript(params.js, function() {
      map = new window.mapboxgl.Map({
        accessToken: params.key,
        logoPosition: 'bottom-left',
        container: mapEl.node(),
        style: activeStyle.url,
        bounds: getLonLatBounds(),
        doubleClickZoom: false,
        dragPan: false,
        dragRotate: false,
        scrollZoom: false,
        interactive: false,
        keyboard: false,
        maxPitch: 0,
        renderWorldCopies: true // false // false prevents panning off the map
      });
      map.on('load', function() {
        loading = false;
        refresh();
      });
    });
  }

  // @bbox: latlon bounding box of current map extent
  function checkBounds(bbox) {
    var mpp = ext.getBounds().width() / ext.width();
    var z = scaleToZoom(mpp);
    var msg;
    if (bbox[1] >= -85 && bbox[3] <= 85 && z <= 20) {
      extentNote.hide();
      return true;
    }
    if (z > 20) {
      msg = 'zoom out';
    } else if (bbox[1] > 0) {
      msg = 'pan south';
    } else if (bbox[3] < 0) {
      msg = 'pan north';
    } else {
      msg = msg = 'zoom in';
    }
    extentNote.html(msg + ' to see the basemap').show();
    return false;
  }

  function crsIsUsable(crs) {
    if (!crs) return false;
    if (!internal.isInvertibleCRS(crs)) return false;
    return true;
  }

  function refresh() {
    if (!enabled() || !map || loading || !activeStyle) return;
    var crs = gui.map.getDisplayCRS();
    if (!crsIsUsable(crs)) {
      hide();
      return;
    }
    if (!internal.isWebMercator(crs)) {
      gui.map.setDisplayCRS(internal.getCRS('webmercator'));
    }
    var bbox = getLonLatBounds();
    if (!checkBounds(bbox)) {
      // map does not display outside these bounds
      hide();
    } else {
      show();
      map.resize();
      map.fitBounds(bbox, {animate: false});
    }
  }

  return {refresh: refresh}; // called by map when extent changes
}
