import { BroadcastSatellite, CityLocation, ScannedChannel, Transponder } from '../types/simulator';

interface ParsedM3UEntry {
  name: string;
  category: string;
  streamUrl: string;
  resolution: string;
}

const m3uCache = new Map<string, ParsedM3UEntry[]>();

/**
 * Parses standard #EXTM3U playlist text from GitHub iptv-org
 * Filters strictly for HTTPS .m3u8 streams so Netlify HTTPS deployments never encounter Mixed Content blocks.
 */
export function parseM3UPlaylist(m3uText: string, maxItems = 18): ParsedM3UEntry[] {
  const lines = m3uText.split(/\r?\n/);
  const results: ParsedM3UEntry[] = [];
  let currentName = '';
  let currentCategory = 'General TV';
  let currentRes = '1080p HD';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      // Extract group-title if available
      const groupMatch = line.match(/group-title="([^"]+)"/i);
      currentCategory = groupMatch && groupMatch[1] ? groupMatch[1].split(';')[0] : 'Broadcast TV';

      // Extract channel display name after the last comma
      const commaIndex = line.lastIndexOf(',');
      if (commaIndex !== -1) {
        currentName = line.slice(commaIndex + 1).trim();
      } else {
        currentName = 'Satellite FTA Service';
      }

      if (currentName.includes('1080p')) currentRes = '1080p HD';
      else if (currentName.includes('720p')) currentRes = '720p HD';
      else if (currentName.includes('4K') || currentName.includes('2160p')) currentRes = '4K UHD';
      else currentRes = '1080p HD';

      // Clean resolution and status tags from name for cleaner OSD
      currentName = currentName
        .replace(/\s*\(\d+p\)\s*/gi, ' ')
        .replace(/\s*\[.*?\]\s*/g, ' ')
        .trim();
    } else if (!line.startsWith('#') && line.startsWith('https://') && line.includes('.m3u8')) {
      if (currentName && !results.some((r) => r.name.toLowerCase() === currentName.toLowerCase())) {
        results.push({
          name: currentName,
          category: currentCategory || 'Satellite TV',
          streamUrl: line,
          resolution: currentRes,
        });
        if (results.length >= maxItems) break;
      }
      currentName = '';
    }
  }

  return results;
}

/**
 * Fetches live M3U playlist from GitHub iptv-org for a given country code.
 * Uses Netlify edge rewrite endpoints alongside direct GitHub CDN endpoints for maximum reliability.
 */
export async function fetchGitHubIptvByCountry(
  countryCode: string,
  maxItems = 14
): Promise<ParsedM3UEntry[]> {
  const code = countryCode.toLowerCase();
  if (m3uCache.has(code)) {
    return m3uCache.get(code)!;
  }

  const candidateUrls = [
    `https://iptv-org.github.io/iptv/countries/${code}.m3u`,
    `https://raw.githubusercontent.com/iptv-org/iptv/master/streams/${code}.m3u`,
    `/api/iptv/countries/${code}.m3u`,
    `/api/github-iptv/${code}.m3u`,
  ];

  for (const url of candidateUrls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      if (!response.ok) continue;
      const text = await response.text();

      // Verify response is an authentic M3U playlist and not an HTML fallback page
      if (!text.trimStart().startsWith('#EXTM3U')) continue;

      const parsed = parseM3UPlaylist(text, maxItems);
      if (parsed.length > 0) {
        m3uCache.set(code, parsed);
        return parsed;
      }
    } catch {
      // Try next endpoint in fallback chain
    }
  }

  return [];
}

/**
 * Scans a locked satellite's transponders (or single transponder) and builds the ScannedChannel list
 * combining verified satellite multiplex streams with live GitHub iptv-org M3U streams for the region/country.
 */
export async function scanSatelliteTransponders(
  satellite: BroadcastSatellite,
  city: CityLocation,
  existingChannels: ScannedChannel[],
  specificTransponder?: Transponder,
  onProgress?: (tp: Transponder, progressPct: number, foundSoFar: number) => void
): Promise<ScannedChannel[]> {
  const transpondersToScan = specificTransponder
    ? [specificTransponder]
    : satellite.transponders;

  // Determine country codes carried on this satellite + the user's selected city countryCode
  const targetCountryCodes = Array.from(
    new Set([
      city.countryCode.toLowerCase(),
      ...transpondersToScan.flatMap((tp) => tp.defaultChannels.map((c) => c.countryCode.toLowerCase())),
    ])
  ).slice(0, 2);

  // Fetch real M3U playlists from GitHub iptv-org in parallel
  const githubEntriesNested = await Promise.all(
    targetCountryCodes.map((cc) => fetchGitHubIptvByCountry(cc, 10))
  );
  const githubEntries = githubEntriesNested.flat();

  const discovered: ScannedChannel[] = [];
  let nextChannelNum = existingChannels.length + 1;
  let ghIndex = 0;

  for (let i = 0; i < transpondersToScan.length; i++) {
    const tp = transpondersToScan[i];

    // Simulate realistic DVB-S2 PLL tuner lock & PAT/PMT table demux delay
    await new Promise((r) => setTimeout(r, 420));

    // 1. Add the transponder's verified high-reliability DVB-S2 broadcast streams
    for (const seed of tp.defaultChannels) {
      const id = `${satellite.id}-${tp.frequency}-${seed.name.replace(/\s+/g, '-').toLowerCase()}`;
      if (
        !existingChannels.some((c) => c.id === id) &&
        !discovered.some((c) => c.id === id)
      ) {
        discovered.push({
          id,
          channelNumber: nextChannelNum++,
          name: seed.name,
          satelliteId: satellite.id,
          satelliteName: satellite.name,
          orbitalSlot: satellite.orbitalSlot,
          transponderFreq: tp.frequency,
          polarization: tp.polarization,
          symbolRate: tp.symbolRate,
          category: seed.category,
          countryCode: seed.countryCode.toUpperCase(),
          streamUrl: seed.streamUrl,
          resolution: seed.resolution,
          source: 'DVB-S2 Satellite Mux',
        });
      }
    }

    // 2. Inject real channels parsed live from GitHub iptv-org M3U onto this transponder multiplex
    const countPerTp = Math.min(4, Math.ceil(githubEntries.length / transpondersToScan.length));
    for (let k = 0; k < countPerTp && ghIndex < githubEntries.length; k++) {
      const gh = githubEntries[ghIndex++];
      const id = `${satellite.id}-${tp.frequency}-gh-${gh.name.replace(/\s+/g, '-').toLowerCase()}`;
      if (
        !existingChannels.some((c) => c.name.toLowerCase() === gh.name.toLowerCase()) &&
        !discovered.some((c) => c.name.toLowerCase() === gh.name.toLowerCase())
      ) {
        discovered.push({
          id,
          channelNumber: nextChannelNum++,
          name: gh.name,
          satelliteId: satellite.id,
          satelliteName: satellite.name,
          orbitalSlot: satellite.orbitalSlot,
          transponderFreq: tp.frequency,
          polarization: tp.polarization,
          symbolRate: tp.symbolRate,
          category: gh.category,
          countryCode: city.countryCode.toUpperCase(),
          streamUrl: gh.streamUrl,
          resolution: gh.resolution,
          source: 'GitHub IPTV-org Live',
        });
      }
    }

    if (onProgress) {
      const pct = Math.round(((i + 1) / transpondersToScan.length) * 100);
      onProgress(tp, pct, discovered.length);
    }
  }

  return discovered;
}
