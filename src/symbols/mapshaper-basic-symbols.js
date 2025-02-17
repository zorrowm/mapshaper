import { getPlanarSegmentEndpoint } from '../geom/mapshaper-geodesic';
import { stop } from '../utils/mapshaper-logging';

export function getPolygonCoords(d) {
  var radius = d.radius || d.length || d.r,
      sides = +d.sides || getSidesByType(d.type),
      rotated = sides % 2 == 1,
      coords = [],
      angle, b;

  if (radius > 0 === false) return null;
  if (sides >= 3 === false) {
    stop(`Invalid number of sides (${sides})`);
  }
  if (d.orientation == 'b' || d.flipped || d.rotated) {
    rotated = !rotated;
  }
  b = rotated ? 0 : 0.5;
  for (var i=0; i<sides; i++) {
    angle = (i + b) / sides * 360;
    coords.push(getPlanarSegmentEndpoint(0, 0, angle, radius));
  }
  coords.push(coords[0].concat());
  return [coords];
}

function getSidesByType(type) {
  return {
    circle: 72,
    triangle: 3,
    square: 4,
    pentagon: 5,
    hexagon: 6,
    heptagon: 7,
    octagon: 8,
    nonagon: 9,
    decagon: 10
  }[type] || 4;
}
