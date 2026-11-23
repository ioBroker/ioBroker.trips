import type { TrackPoint } from './tripDetector';
import type { TripSummary } from './summary';

function escapeXml(text: string): string {
    return text.replace(/[<>&'"]/g, c => `&${{ '<': 'lt', '>': 'gt', '&': 'amp', "'": 'apos', '"': 'quot' }[c]};`);
}

/** Splits the track at the gaps: the way between them is unknown */
function segments(points: TrackPoint[]): TrackPoint[][] {
    const result: TrackPoint[][] = [];
    let current: TrackPoint[] = [];
    for (const point of points) {
        if (point.gap && current.length) {
            result.push(current);
            current = [];
        }
        current.push(point);
    }
    if (current.length) {
        result.push(current);
    }
    return result;
}

export function toGpx(summary: TripSummary, points: TrackPoint[], name: string): string {
    const lines: string[] = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<gpx version="1.1" creator="ioBroker.trips" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">',
        '  <metadata>',
        `    <name>${escapeXml(name)}</name>`,
        `    <time>${new Date(summary.start).toISOString()}</time>`,
        '  </metadata>',
    ];
    for (const stop of summary.stops) {
        if (stop.lat === null || stop.lon === null) {
            continue;
        }
        lines.push(
            `  <wpt lat="${stop.lat.toFixed(7)}" lon="${stop.lon.toFixed(7)}">`,
            `    <time>${new Date(stop.start).toISOString()}</time>`,
            `    <name>${escapeXml(stop.place || `Stop ${Math.round((stop.end - stop.start) / 60000)} min`)}</name>`,
            '  </wpt>',
        );
    }
    lines.push('  <trk>', `    <name>${escapeXml(name)}</name>`);
    for (const segment of segments(points)) {
        lines.push('    <trkseg>');
        for (const p of segment) {
            const ele = typeof p.alt === 'number' ? `<ele>${p.alt}</ele>` : '';
            lines.push(
                `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}">${ele}<time>${new Date(p.ts).toISOString()}</time></trkpt>`,
            );
        }
        lines.push('    </trkseg>');
    }
    lines.push('  </trk>', '</gpx>', '');
    return lines.join('\n');
}

/**
 * GeoJSON FeatureCollection: the track as (Multi)LineString with the summary as properties,
 * the times in `coordTimes` (the usual extension, e.g. of togeojson), and the stops as points.
 */
export function toGeoJson(summary: TripSummary, points: TrackPoint[]): string {
    const parts = segments(points);
    const coordinates = parts.map(segment =>
        segment.map(p => (typeof p.alt === 'number' ? [p.lon, p.lat, p.alt] : [p.lon, p.lat])),
    );
    const times = parts.map(segment => segment.map(p => p.ts));
    const speeds = parts.map(segment => segment.map(p => p.speed ?? null));
    const features: any[] = [
        {
            type: 'Feature',
            geometry:
                parts.length === 1
                    ? { type: 'LineString', coordinates: coordinates[0] }
                    : { type: 'MultiLineString', coordinates },
            properties: {
                ...summary,
                coordTimes: parts.length === 1 ? times[0] : times,
                speeds: parts.length === 1 ? speeds[0] : speeds,
            },
        },
    ];
    for (const stop of summary.stops) {
        if (stop.lat === null || stop.lon === null) {
            continue;
        }
        features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [stop.lon, stop.lat] },
            properties: { kind: 'stop', ...stop },
        });
    }
    return JSON.stringify({ type: 'FeatureCollection', features });
}

/** Reads the points back from a stored GeoJSON */
export function pointsFromGeoJson(text: string): TrackPoint[] {
    const json = JSON.parse(text);
    const track = json?.features?.[0];
    if (!track?.geometry) {
        return [];
    }
    const multi = track.geometry.type === 'MultiLineString';
    const coordinates: number[][][] = multi ? track.geometry.coordinates : [track.geometry.coordinates];
    const times: number[][] = multi ? track.properties.coordTimes : [track.properties.coordTimes];
    const speeds: (number | null)[][] = multi ? track.properties.speeds || [] : [track.properties.speeds || []];
    const points: TrackPoint[] = [];
    coordinates.forEach((segment, s) => {
        segment.forEach((c, i) => {
            const point: TrackPoint = { lon: c[0], lat: c[1], ts: times?.[s]?.[i] ?? 0 };
            if (typeof c[2] === 'number') {
                point.alt = c[2];
            }
            const speed = speeds?.[s]?.[i];
            if (typeof speed === 'number') {
                point.speed = speed;
            }
            if (s > 0 && i === 0) {
                point.gap = true;
            }
            points.push(point);
        });
    });
    return points;
}
