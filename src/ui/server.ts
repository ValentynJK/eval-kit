import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { caseFields, loadCase, loadCases } from '../engine/loadCases';
import { fieldProblems } from '../engine/fieldGradeSummary';
import { loadGradeCriteria } from '../engine/gradeCriteria';
import {
  listRunFiles,
  listTracks,
  loadPreviousRun,
  loadRun,
} from '../engine/loadRuns';

// the one place that hardcodes its own file location -- engine/ finds data via process.cwd() to stay portable, but the UI just needs its own index.html
const HERE = path.dirname(fileURLToPath(import.meta.url));
const INDEX_HTML_PATH = path.join(HERE, 'index.html');

// read fresh per-request, not cached at startup, so an html edit shows up without restarting the server
function readIndexHtml(): string {
  return fs.readFileSync(INDEX_HTML_PATH, 'utf8');
}

// not 6666 -- chrome treats it as an unsafe port (ERR_UNSAFE_PORT) and refuses to load it
const PORT = Number(process.env.PORT) || 7766;

function sendJson(
  res: http.ServerResponse,
  status: number,
  body: unknown
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

// URLs use the bare run id (no .json); run files on disk keep the extension
const toRunId = (fileName: string): string => fileName.replace(/\.json$/, '');
const toFileName = (runId: string): string => `${runId}.json`;

// a track is identified as `feature/track`, not by its name alone -- two features can both have a track with the same name
const trackId = (one: { feature: string; track: string }): string =>
  `${one.feature}/${one.track}`;

function findTrack(id: string): { feature: string; track: string } | null {
  return listTracks().find(one => trackId(one) === id) ?? null;
}

function servePage(res: http.ServerResponse): void {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(readIndexHtml());
}

function redirect(res: http.ServerResponse, location: string): void {
  res.writeHead(302, { Location: location });
  res.end();
}

function handleIndex(query: URLSearchParams, res: http.ServerResponse): void {
  const tracks = listTracks();
  if (!tracks.length) return sendJson(res, 200, { tracks: [] });

  const requestedTrack = query.get('track');
  const active = requestedTrack ? findTrack(requestedTrack) : tracks[0];
  if (!active)
    return sendJson(res, 404, { error: `track not found: ${requestedTrack}` });

  const trackIds = tracks.map(trackId);
  const runFiles = listRunFiles(active.feature, active.track);
  if (!runFiles.length) {
    return sendJson(res, 200, {
      tracks: trackIds,
      track: trackId(active),
      runFiles: [],
    });
  }

  const requestedRunId = query.get('run');
  const runFile =
    requestedRunId && runFiles.includes(toFileName(requestedRunId))
      ? toFileName(requestedRunId)
      : runFiles[0];
  const run = loadRun(active.feature, active.track, runFile);
  if (!run)
    return sendJson(res, 404, { error: `run not found: ${toRunId(runFile)}` });

  const previous =
    loadPreviousRun(active.feature, active.track, runFile)?.run ?? null;
  const fields = caseFields(loadCases(active.feature, active.track));
  const weakFields = fieldProblems(run.results, run.pass_threshold).slice(0, 5);

  sendJson(res, 200, {
    tracks: trackIds,
    track: trackId(active),
    runFiles: runFiles.map(toRunId),
    runId: toRunId(runFile),
    run,
    previous,
    fields,
    weakFields,
  });
}

function handleCase(query: URLSearchParams, res: http.ServerResponse): void {
  const track = query.get('track');
  const runId = query.get('run');
  const caseId = query.get('caseId');
  if (!track || !runId || !caseId) {
    return sendJson(res, 400, { error: 'track, run and caseId are required' });
  }

  const active = findTrack(track);
  if (!active)
    return sendJson(res, 404, { error: `track not found: ${track}` });

  const runFile = toFileName(runId);
  const runFiles = listRunFiles(active.feature, active.track);
  if (!runFiles.includes(runFile)) {
    return sendJson(res, 404, { error: `run not found: ${runId}` });
  }
  const run = loadRun(active.feature, active.track, runFile);
  if (!run) return sendJson(res, 404, { error: `run not found: ${runId}` });

  const evalCase = loadCase(active.feature, active.track, caseId);
  const result = run.results.find(one => one.case_id === caseId) ?? null;
  if (!evalCase || !result) {
    return sendJson(res, 404, {
      error: `case not found in this run: ${caseId}`,
    });
  }

  const fields = caseFields([evalCase]);
  const criteria = loadGradeCriteria(active.feature, active.track);

  sendJson(res, 200, { runId, run, evalCase, result, fields, criteria });
}

function pathSegments(pathname: string): string[] {
  return pathname.split('/').filter(Boolean).map(decodeURIComponent);
}

// GET /<feature>/<track>/<runId>/<caseId> -- a missing track or run redirects to the current default so the URL always fully identifies what's on screen
function handlePage(pathname: string, res: http.ServerResponse): void {
  const [featureSeg, trackSeg, runSeg] = pathSegments(pathname);
  const tracks = listTracks();

  if (!featureSeg || !trackSeg) {
    if (!tracks.length) return servePage(res);
    const { feature, track } = tracks[0];
    return redirect(
      res,
      `/${encodeURIComponent(feature)}/${encodeURIComponent(track)}`
    );
  }

  const active = findTrack(`${featureSeg}/${trackSeg}`);
  if (!active) return servePage(res);

  if (!runSeg) {
    const runFiles = listRunFiles(active.feature, active.track);
    if (!runFiles.length) return servePage(res);
    return redirect(
      res,
      `/${encodeURIComponent(active.feature)}/${encodeURIComponent(active.track)}/${encodeURIComponent(toRunId(runFiles[0]))}`
    );
  }

  return servePage(res);
}

export function startUi(): void {
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

      if (url.pathname === '/api/index')
        return handleIndex(url.searchParams, res);
      if (url.pathname === '/api/case')
        return handleCase(url.searchParams, res);
      if (url.pathname.startsWith('/api/')) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('not found');
      }

      return handlePage(url.pathname, res);
    } catch (error) {
      // a bad run/case file on disk should 500, not kill the process
      console.error(error);
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : 'internal error',
      });
    }
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log('----------------------------------------------------------');
    console.log(`===> Eval UI running on http://localhost:${PORT}`);
    console.log('----------------------------------------------------------');
  });
}
