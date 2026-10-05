import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { randomUUID } from 'node:crypto';

const sessions = new Set();

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 64_000) { reject(new Error('payload-too-large')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch (error) { reject(error); }
    });
    req.on('error', reject);
  });
}

function bearer(req) {
  const value = req.headers.authorization || '';
  return value.startsWith('Bearer ') ? value.slice(7) : '';
}

// Demo historian: older samples are synthetic; telemetry after server boot is real simulator output.
const historyRanges = Object.freeze({
  live: { duration: 5 * 60_000, step: 5_000 },
  '1h': { duration: 60 * 60_000, step: 30_000 },
  '24h': { duration: 24 * 60 * 60_000, step: 10 * 60_000 },
  '7d': { duration: 7 * 24 * 60 * 60_000, step: 60 * 60_000 },
  '30d': { duration: 30 * 24 * 60 * 60_000, step: 4 * 60 * 60_000 }
});
const liveHistory = [];
function currentSample() {
  return { timestamp: Date.now(), pressure: Number(state.pressureBar.toFixed(3)), flow: Number(state.flowLpm.toFixed(3)) };
}
function getHistory(range) {
  const {duration, step} = historyRanges[range];
  const now = Date.now(), end = Math.floor(now / step) * step;
  const samples = [];
  for (let at = end - duration; at <= end; at += step) {
    // Deterministic waveform with daily load variation, no random jitter between requests.
    const hour = at / 3_600_000;
    const dayPhase = 2 * Math.PI * (hour % 24) / 24;
    const shortPhase = hour * 1.31;
    const pressure = clamp(3.3 + .34 * Math.sin(dayPhase - .8) + .19 * Math.sin(shortPhase) + .08 * Math.sin(hour * 5.2), 1.5, 5.9);
    const flow = clamp(17.6 + 5.6 * Math.sin(dayPhase - 1.2) + 2.5 * Math.sin(shortPhase + .6) + 1.1 * Math.cos(hour * 3.9), 1, 36);
    samples.push({ timestamp: at, pressure: Number(pressure.toFixed(2)), flow: Number(flow.toFixed(2)) });
  }
  // Use actual simulator readings when available; do not pretend old sample values are measured.
  const start = now - duration;
  const actual = liveHistory.filter(item => item.timestamp >= start);
  for (const item of actual) {
    const ix = samples.findIndex(row => Math.abs(row.timestamp - item.timestamp) < step / 2);
    if (ix >= 0) samples[ix] = item;
  }
  return { range, source: 'SIMULATED_WITH_LIVE_SAMPLES', samples, generatedAt: now };
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    });
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url?.startsWith('/api/history')) {
    const token = bearer(req);
    if (!sessions.has(token)) return json(res, 401, { error: 'UNAUTHORIZED' });
    const url = new URL(req.url, 'http://localhost');
    const range = url.searchParams.get('range') || 'live';
    if (!Object.hasOwn(historyRanges, range)) return json(res, 400, { error: 'INVALID_RANGE' });
    return json(res, 200, getHistory(range));
  }

  if (req.url === '/api/login' && req.method === 'POST') {
    try {
      const body = await readJson(req);
      if (body.username !== 'admin' || body.password !== 'admin') {
        json(res, 401, { error: 'INVALID_CREDENTIALS' });
        return;
      }
      const token = randomUUID();
      sessions.add(token);
      json(res, 200, { token, user: { username: 'admin', displayName: 'Administrator', role: 'Control Administrator' } });
    } catch {
      json(res, 400, { error: 'INVALID_REQUEST' });
    }
    return;
  }

  if (req.url === '/api/logout' && req.method === 'POST') {
    const token = bearer(req);
    if (token) sessions.delete(token);
    json(res, 200, { ok: true });
    return;
  }

  if (req.url === '/api/session' && req.method === 'GET') {
    const token = bearer(req);
    json(res, sessions.has(token) ? 200 : 401, sessions.has(token) ? { ok: true } : { ok: false });
    return;
  }

  json(res, 404, { error: 'NOT_FOUND' });
});

const wss = new WebSocketServer({ server });

const state = {
  pressureBar: 3.2,
  flowLpm: 18.4,
  rpm: 2160,
  powerKw: 0.82,
  temperatureC: 43.5,
  tankLevelPct: 74,
  valvePct: 68,
  pumpRunning: true,
  mode: 'AUTO',
  targetPressureBar: 3.4,

  boilerEnabled: true,
  boilerColdInletC: 21.4,
  boilerHotOutletC: 47.5,
  boilerSupplyC: 55.8,
  boilerReturnC: 41.6,
  heatExchangerC: 63.5,
  burnerOn: true,
  radiatorValvePct: 82,
  radiatorValvePcts: [100, 88, 78, 92, 70],
  radiatorTempsC: [49.2, 47.9, 46.8, 45.7, 44.8],
  roomTempsC: [23.4, 22.8, 22.3, 21.9, 22.1],
  heatingFaultMode: 'NONE'
};

const alarms = [];
let phase = 0;
let alarmCooldown = 0;
let burnerEventCooldown = 0;
let lastBurnerState = state.burnerOn;

function frame(type, payload) { return JSON.stringify({ type, payload }); }
function broadcast(type, payload) {
  const data = frame(type, payload);
  for (const client of wss.clients) if (client.readyState === 1) client.send(data);
}
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function avg(list) { return list.reduce((sum, value) => sum + value, 0) / Math.max(1, list.length); }
function noise(scale = 1) { return (Math.random() - 0.5) * scale; }

function emitAlarm(severity, title, message) {
  const alarm = { id: randomUUID(), timestamp: Date.now(), severity, title, message, acknowledged: false };
  alarms.unshift(alarm);
  alarms.splice(30);
  broadcast('ALARM', alarm);
}

function updateHydraulics() {
  if (!state.pumpRunning || state.mode === 'OFF') {
    state.rpm += (0 - state.rpm) * 0.16;
    state.flowLpm += (0 - state.flowLpm) * 0.14;
    state.pressureBar += (0.55 - state.pressureBar) * 0.08;
    state.powerKw += (0.03 - state.powerKw) * 0.14;
    state.temperatureC += (30 - state.temperatureC) * 0.015;
  } else {
    const targetRpm = state.mode === 'AUTO'
      ? clamp(1450 + state.targetPressureBar * 260 + (state.targetPressureBar - state.pressureBar) * 420, 1100, 2850)
      : 2250;
    state.rpm += (targetRpm - state.rpm) * 0.12;
    const valveFactor = state.valvePct / 100;
    const targetFlow = 4 + 26 * valveFactor * (state.rpm / 2850);
    state.flowLpm += (targetFlow - state.flowLpm) * 0.12 + noise(0.15);
    const pressurePenalty = state.heatingFaultMode === 'LOW_PRESSURE' ? 1.65 : 0;
    const targetPressure = 0.8 + (state.rpm / 2850) * 3.9 - valveFactor * 0.45 - pressurePenalty;
    state.pressureBar += (targetPressure - state.pressureBar) * 0.15 + Math.sin(phase) * 0.012;
    state.powerKw += ((0.18 + state.rpm / 2850 * 0.95 * valveFactor) - state.powerKw) * 0.11;
    state.temperatureC += ((34 + state.powerKw * 17) - state.temperatureC) * 0.03 + noise(0.04);
    state.tankLevelPct = clamp(state.tankLevelPct - state.flowLpm * 0.0009 + 0.014, 18, 98);
  }

  state.pressureBar = clamp(state.pressureBar, 0, 7.8);
  state.flowLpm = clamp(state.flowLpm, 0, 38);
  state.rpm = clamp(state.rpm, 0, 2900);
  state.powerKw = clamp(state.powerKw, 0, 1.6);
  state.temperatureC = clamp(state.temperatureC, 20, 88);
}

function updateHeatingLoop() {
  const ambient = 20.4;
  const avgRadiatorTemp = avg(state.radiatorTempsC);
  const demandOnThreshold = 41.5;
  const demandOffThreshold = 49.5;
  const masterValveFactor = clamp(state.radiatorValvePct / 100, 0, 1);
  const averageZoneValve = avg(state.radiatorValvePcts) / 100;
  const effectiveValveFactor = masterValveFactor * averageZoneValve;
  const boilerFault = state.heatingFaultMode === 'BOILER_FAILURE';
  const lowPressureFault = state.heatingFaultMode === 'LOW_PRESSURE';
  const heatingAvailable = state.pumpRunning && state.mode !== 'OFF' && state.boilerEnabled && state.radiatorValvePct > 2 && !boilerFault;

  if (heatingAvailable) {
    if (!state.burnerOn && avgRadiatorTemp <= demandOnThreshold) state.burnerOn = true;
    else if (state.burnerOn && avgRadiatorTemp >= demandOffThreshold) state.burnerOn = false;
  } else {
    state.burnerOn = false;
  }

  if (state.burnerOn) {
    const targetExchanger = 68 + effectiveValveFactor * 7 + Math.sin(phase * 0.3) * 1.8;
    state.heatExchangerC += (targetExchanger - state.heatExchangerC) * 0.08 + noise(0.25);
    const targetSupply = clamp(50 + effectiveValveFactor * 13 + (demandOffThreshold - avgRadiatorTemp) * 0.82, 45, 68);
    state.boilerSupplyC += (targetSupply - state.boilerSupplyC) * 0.09 + noise(0.15);
    state.boilerHotOutletC += ((state.boilerSupplyC - 4.2) - state.boilerHotOutletC) * 0.12 + noise(0.12);
    state.boilerColdInletC += ((ambient + 1.2) - state.boilerColdInletC) * 0.04 + noise(0.04);
  } else {
    state.heatExchangerC += ((boilerFault ? 26 : 30) - state.heatExchangerC) * 0.05;
    state.boilerSupplyC += ((avgRadiatorTemp + 2.2) - state.boilerSupplyC) * 0.08;
    state.boilerHotOutletC += ((avgRadiatorTemp + 0.8) - state.boilerHotOutletC) * 0.08;
    state.boilerColdInletC += (ambient - state.boilerColdInletC) * 0.05;
  }

  state.radiatorTempsC = state.radiatorTempsC.map((temp, index) => {
    const zoneValve = clamp((state.radiatorValvePcts[index] ?? 0) / 100, 0, 1);
    const airlockPenalty = state.heatingFaultMode === 'AIRLOCK' && index === 2 ? 0.18 : 1;
    const pressureFactor = lowPressureFault ? 0.48 : 1;
    const zoneHeatingFactor = effectiveValveFactor * zoneValve * airlockPenalty * pressureFactor;
    const circuitDrop = index * 1.05 + 2.0;
    const feedTemp = state.boilerSupplyC - circuitDrop;
    const loopPull = heatingAvailable ? (0.015 + zoneHeatingFactor * 0.105) : 0.006;
    const roomCooling = 0.028 + (1 - zoneHeatingFactor) * 0.025 + index * 0.003;
    const warmed = heatingAvailable ? temp + (feedTemp - temp) * loopPull : temp;
    const cooled = warmed + (ambient - warmed) * roomCooling;
    return clamp(cooled, ambient, 72);
  });

  state.roomTempsC = state.roomTempsC.map((roomTemp, index) => {
    const radiatorTemp = state.radiatorTempsC[index] ?? ambient;
    const valve = clamp((state.radiatorValvePcts[index] ?? 0) / 100, 0, 1);
    const airlockPenalty = state.heatingFaultMode === 'AIRLOCK' && index === 2 ? 0.2 : 1;
    const heatGain = Math.max(0, radiatorTemp - roomTemp) * 0.0028 * valve * airlockPenalty;
    const shellLoss = (ambient - roomTemp) * 0.0042;
    return clamp(roomTemp + heatGain + shellLoss, 16, 28);
  });

  const newAverage = avg(state.radiatorTempsC);
  state.boilerReturnC += (((newAverage - 1.4) * Math.max(.2, effectiveValveFactor)) - state.boilerReturnC) * 0.11 + noise(0.08);

  state.boilerColdInletC = clamp(state.boilerColdInletC, 16, 29);
  state.boilerHotOutletC = clamp(state.boilerHotOutletC, 24, 65);
  state.boilerSupplyC = clamp(state.boilerSupplyC, 24, 72);
  state.boilerReturnC = clamp(state.boilerReturnC, 22, 65);
  state.heatExchangerC = clamp(state.heatExchangerC, 24, 82);

  if (lastBurnerState !== state.burnerOn && burnerEventCooldown === 0) {
    burnerEventCooldown = 16;
    if (state.burnerOn) {
      emitAlarm('warning', 'Boiler ignition', 'Radiators cooled down and the boiler burner restarted the heating loop.');
    } else {
      emitAlarm('info', 'Boiler standby', 'Radiator loop reached temperature and the boiler burner returned to standby.');
    }
  }
  lastBurnerState = state.burnerOn;
}

function maybeEmitRandomAlarm() {
  alarmCooldown = Math.max(0, alarmCooldown - 1);
  burnerEventCooldown = Math.max(0, burnerEventCooldown - 1);
  if (alarmCooldown === 0 && Math.random() < 0.008) {
    const templates = [
      ['warning', 'Pressure deviation', 'Discharge pressure moved outside the preferred deadband.'],
      ['info', 'Auto regulation', 'VFD speed was adjusted to maintain the requested pressure.'],
      ['warning', 'Tank level advisory', 'Supply tank trend requires operator attention if demand remains high.']
    ];
    const [severity, title, message] = templates[Math.floor(Math.random() * templates.length)];
    emitAlarm(severity, title, message);
    alarmCooldown = 20;
  }
}

function updatePhysics() {
  phase += 0.17;
  updateHydraulics();
  updateHeatingLoop();
  const sample = currentSample();
  if (liveHistory.length === 0 || sample.timestamp - liveHistory[liveHistory.length - 1].timestamp > 1500) {
    liveHistory.push(sample);
    if (liveHistory.length > 3600) liveHistory.shift();
  }
  const telemetry = { ...state, timestamp: Date.now() };
  broadcast('TELEMETRY', telemetry);
  maybeEmitRandomAlarm();
}

function handleCommand(ws, command) {
  switch (command?.type) {
    case 'SET_MODE':
      state.mode = command.mode;
      if (command.mode === 'OFF') state.pumpRunning = false;
      ws.send(frame('COMMAND_ACK', { message: `Mode changed to ${command.mode}` }));
      break;
    case 'SET_TARGET_PRESSURE':
      state.targetPressureBar = clamp(Number(command.value), 1.5, 5.5);
      ws.send(frame('COMMAND_ACK', { message: `Pressure setpoint ${state.targetPressureBar.toFixed(1)} bar` }));
      break;
    case 'SET_VALVE':
      state.valvePct = clamp(Number(command.value), 10, 100);
      ws.send(frame('COMMAND_ACK', { message: `Outlet valve ${state.valvePct.toFixed(0)}%` }));
      break;
    case 'SET_BOILER_ENABLED':
      state.boilerEnabled = Boolean(command.value);
      if (!state.boilerEnabled) state.burnerOn = false;
      emitAlarm('info', state.boilerEnabled ? 'Boiler package enabled' : 'Boiler package disabled', state.boilerEnabled ? 'The domestic boiler package was enabled by the operator.' : 'The domestic boiler package was turned off by the operator.');
      ws.send(frame('COMMAND_ACK', { message: `Boiler package ${state.boilerEnabled ? 'enabled' : 'disabled'}` }));
      break;
    case 'SET_RADIATOR_VALVE': {
      state.radiatorValvePct = clamp(Number(command.value), 0, 100);
      if (state.radiatorValvePct === 0) emitAlarm('warning', 'Radiator valve closed', 'The radiator loop valve is fully closed and heating circulation is interrupted.');
      ws.send(frame('COMMAND_ACK', { message: `Radiator valve ${state.radiatorValvePct.toFixed(0)}%` }));
      break;
    }
    case 'SET_RADIATOR_ZONE_VALVE': {
      const index = clamp(Number(command.index), 0, 4);
      const value = clamp(Number(command.value), 0, 100);
      state.radiatorValvePcts[index] = value;
      ws.send(frame('COMMAND_ACK', { message: `Radiator ${index + 1} valve ${value.toFixed(0)}%` }));
      break;
    }
    case 'SET_HEATING_FAULT': {
      const allowed = new Set(['NONE', 'BOILER_FAILURE', 'LOW_PRESSURE', 'AIRLOCK']);
      const next = allowed.has(command.mode) ? command.mode : 'NONE';
      state.heatingFaultMode = next;
      if (next === 'BOILER_FAILURE') state.burnerOn = false;
      if (next === 'NONE') emitAlarm('info', 'Fault simulation cleared', 'Heating system fault simulation returned to normal operation.');
      if (next === 'BOILER_FAILURE') emitAlarm('critical', 'Boiler failure simulated', 'The boiler burner has been locked out and heat generation is unavailable.');
      if (next === 'LOW_PRESSURE') emitAlarm('critical', 'Low pressure simulated', 'Hydronic pressure has dropped and circulation performance is degraded.');
      if (next === 'AIRLOCK') emitAlarm('warning', 'Radiator airlock simulated', 'Radiator 3 is partially airlocked and heat transfer is reduced.');
      ws.send(frame('COMMAND_ACK', { message: `Heating fault mode ${next}` }));
      break;
    }
    case 'START':
      state.pumpRunning = true;
      if (state.mode === 'OFF') state.mode = 'MANUAL';
      ws.send(frame('COMMAND_ACK', { message: 'Pump start command accepted' }));
      break;
    case 'STOP':
      state.pumpRunning = false;
      ws.send(frame('COMMAND_ACK', { message: 'Pump stop command accepted' }));
      break;
    case 'ACK_ALARM': {
      const alarm = alarms.find(item => item.id === command.id);
      if (alarm) alarm.acknowledged = true;
      ws.send(frame('COMMAND_ACK', { message: 'Alarm acknowledged' }));
      break;
    }
  }
}

wss.on('connection', (ws, request) => {
  const url = new URL(request.url || '/', 'http://localhost');
  const token = url.searchParams.get('token') || '';
  if (!sessions.has(token)) {
    ws.close(4401, 'Unauthorized');
    return;
  }
  ws.send(frame('SNAPSHOT', { telemetry: { ...state, timestamp: Date.now() }, alarms }));
  ws.on('message', raw => {
    try {
      const message = JSON.parse(raw.toString());
      if (message.type === 'COMMAND') handleCommand(ws, message.payload);
    } catch {
      // demo server ignores invalid frames
    }
  });
});

setInterval(updatePhysics, 700);
server.listen(8081, '0.0.0.0', () => {
  console.log('Hydro Control API + WebSocket server: http://localhost:8081 · ws://localhost:8081');
  console.log('Demo login: admin / admin');
});
