/**
 * Pre-computes land dot positions for DottedGlobe and writes them as a JSON array.
 *
 * Usage: npx tsx packages/shared/scripts/generate-land-dots.ts
 */
import { feature } from "topojson-client";

const DEG = Math.PI / 180;
const LAND_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json";

function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0],
      yi = ring[i][1];
    const xj = ring[j][0],
      yj = ring[j][1];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function isLand(lng: number, lat: number, geometry: any): boolean {
  if (geometry.type === "Polygon") return pointInRing(lng, lat, geometry.coordinates[0]);
  if (geometry.type === "MultiPolygon")
    return geometry.coordinates.some((poly: number[][][]) => pointInRing(lng, lat, poly[0]));
  return false;
}

function latLngToVec3(lat: number, lng: number, r: number): [number, number, number] {
  const phi = (90 - lat) * DEG;
  const theta = (180 + lng) * DEG;
  return [
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  ];
}

function collectGeometries(geojson: any): any[] {
  if (geojson.type === "FeatureCollection")
    return geojson.features.flatMap((f: any) => collectGeometries(f));
  if (geojson.type === "Feature") return geojson.geometry ? [geojson.geometry] : [];
  if (geojson.type === "GeometryCollection") return geojson.geometries ?? [];
  return [geojson];
}

async function main() {
  const step = 1.1;
  const radius = 1; // unit sphere — scaled at render time

  const res = await fetch(LAND_URL);
  const topology = await res.json();
  const land = feature(topology, topology.objects.land);
  const geometries = collectGeometries(land);

  const positions: number[] = [];
  for (let lat = -90 + step / 2; lat < 90; lat += step) {
    const cosLat = Math.cos(lat * DEG);
    const lngStep = cosLat > 0.05 ? step / cosLat : 360;
    for (let lng = -180 + lngStep / 2; lng < 180; lng += lngStep) {
      if (geometries.some((g: any) => isLand(lng, lat, g))) {
        const [x, y, z] = latLngToVec3(lat, lng, radius);
        positions.push(
          Math.round(x * 100000) / 100000,
          Math.round(y * 100000) / 100000,
          Math.round(z * 100000) / 100000,
        );
      }
    }
  }

  const fs = await import("fs");
  const path = await import("path");
  const outPath = path.resolve(import.meta.dirname!, "../src/land-dots.json");
  fs.writeFileSync(outPath, JSON.stringify(positions));
  console.log(
    `Wrote ${positions.length / 3} dots (${positions.length} floats) to src/land-dots.json`,
  );
}

main();
