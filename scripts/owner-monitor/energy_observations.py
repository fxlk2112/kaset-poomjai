"""Uncommissioned meter observations. Never produce GOOD or pump run-state.

This database and wire schema are deliberately distinct from commissioned
energy_samples. Raw FC03 frames stay local; owner projections contain numbers
and explicit verification flags only.
"""
import hashlib
import json
import math
import sqlite3
import struct
import time
import uuid
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

SCHEMA = 'farmultimate.energy.observation.v1'
SOURCE = 'UNASSIGNED_METER_01'
TOPIC = 'irrigation/sensors/energy/' + SOURCE + '/observation'
ACK_TOPIC = 'irrigation/sensors/energy/' + SOURCE + '/ack'
DATABASE = '/var/lib/sucha-energy-monitor/energy.sqlite3'
MAP_ID = 'ACREL_ADL400N_CT_EXTERNAL_CT_MANUAL_V1_5_FAST_READ_V1'
FIELDS = {
    'voltage_l1_v': (0x2100, 2, 0, 600), 'voltage_l2_v': (0x2102, 2, 0, 600),
    'voltage_l3_v': (0x2104, 2, 0, 600), 'current_l1_a': (0x210C, 2, 0, 10000),
    'current_l2_a': (0x210E, 2, 0, 10000), 'current_l3_a': (0x2110, 2, 0, 10000),
    'active_power_total_kw': (0x211A, 2, -10000, 10000),
    'power_factor_total': (0x2132, 2, -1, 1), 'frequency_hz': (0x2134, 2, 45, 65),
    'import_energy_total_kwh': (0x3004, 4, 0, 1e12),
}

def crc(data):
    value = 0xFFFF
    for byte in data:
        value ^= byte
        for _ in range(8):
            value = (value >> 1) ^ (0xA001 if value & 1 else 0)
    return value

def request(start, count):
    if (start, count) not in ((0x2100, 54), (0x3000, 8)):
        raise ValueError('READ_BLOCK_DENIED')
    data = struct.pack('>BBHH', 1, 3, start, count)
    return data + struct.pack('<H', crc(data))

def registers(frame, count):
    if not isinstance(frame, str) or len(frame) != (5 + count * 2) * 2:
        raise ValueError('FRAME_LENGTH')
    data = bytes.fromhex(frame)
    if data[:3] != bytes((1, 3, count * 2)) or struct.pack('<H', crc(data[:-2])) != data[-2:]:
        raise ValueError('FRAME_CRC_OR_PROTOCOL')
    return struct.unpack('>' + 'H' * count, data[3:-2])

def decode(frames):
    if not isinstance(frames, dict) or set(frames) != {'fast', 'energy'}:
        raise ValueError('FRAME_BLOCKS')
    values = {0x2100 + i: v for i, v in enumerate(registers(frames['fast'], 54))}
    values.update({0x3000 + i: v for i, v in enumerate(registers(frames['energy'], 8))})
    out = {}
    for name, (start, count, low, high) in FIELDS.items():
        raw = b''.join(values[start + i].to_bytes(2, 'big') for i in range(count))
        value = struct.unpack('>f' if count == 2 else '>d', raw)[0]
        if not math.isfinite(value) or not low <= value <= high:
            raise ValueError('OBSERVATION_RANGE')
        out[name] = round(value, 6)
    return out

def event(frames=None, now=None, error=None):
    now = time.time() if now is None else now
    value = {'schema': SCHEMA, 'id': str(uuid.uuid4()), 'source_id': SOURCE,
             'observed_at': datetime.fromtimestamp(now, timezone.utc).isoformat(),
             'quality': 'UNVERIFIED' if frames is not None else 'SENSOR_FAULT',
             'observation_only': True, 'output_control_allowed': False, 'modbus_write_allowed': False,
             'ct_ratio_verified': False, 'direction_verified': False, 'display_comparison_verified': False,
             'phase_mapping_verified': False, 'isolated_interface_verified': False,
             'word_byte_order_verified': False, 'frames': frames,
             'error': error if error in ('READ_FAILED', 'CLOCK_INVALID') else None}
    validate(value, now)
    return value

def validate(value, now=None):
    now = time.time() if now is None else now
    if not isinstance(value, dict) or value.get('schema') != SCHEMA or value.get('source_id') != SOURCE:
        raise ValueError('OBSERVATION_SCHEMA')
    if str(uuid.UUID(value.get('id', ''))) != value['id']:
        raise ValueError('OBSERVATION_ID')
    if value.get('observation_only') is not True:
        raise ValueError('OBSERVATION_ONLY')
    for k in ('output_control_allowed', 'modbus_write_allowed', 'ct_ratio_verified', 'direction_verified',
              'display_comparison_verified', 'phase_mapping_verified', 'isolated_interface_verified', 'word_byte_order_verified'):
        if value.get(k) is not False:
            raise ValueError('UNCOMMISSIONED_ONLY')
    stamp = datetime.fromisoformat(value['observed_at'].replace('Z', '+00:00'))
    if stamp.tzinfo is None or not now - 7 * 86400 <= stamp.timestamp() <= now + 120:
        raise ValueError('OBSERVATION_TIME')
    if value.get('quality') == 'UNVERIFIED':
        decode(value.get('frames'))
    elif value.get('quality') != 'SENSOR_FAULT' or value.get('frames') is not None:
        raise ValueError('OBSERVATION_QUALITY')
    return stamp.timestamp()

def wire(value):
    raw = json.dumps(value, separators=(',', ':'), sort_keys=True).encode()
    if len(raw) > 4096:
        raise ValueError('OBSERVATION_SIZE')
    return raw, hashlib.sha256(raw).hexdigest()

def open_store(path):
    db = sqlite3.connect(path, timeout=5)
    db.execute('PRAGMA journal_mode=WAL')
    db.execute('PRAGMA synchronous=FULL')
    db.execute('CREATE TABLE IF NOT EXISTS observations(id TEXT PRIMARY KEY,observed_epoch REAL NOT NULL,body TEXT NOT NULL,digest TEXT NOT NULL,acked INTEGER NOT NULL DEFAULT 0)')
    db.execute('CREATE INDEX IF NOT EXISTS observations_time ON observations(observed_epoch)')
    db.execute('CREATE INDEX IF NOT EXISTS observations_pending ON observations(observed_epoch) WHERE acked=0')
    db.commit()
    return db

def insert(db, value, now=None):
    epoch = validate(value, now)
    raw, digest = wire(value)
    old = db.execute('SELECT digest FROM observations WHERE id=?', (value['id'],)).fetchone()
    if old and old[0] != digest:
        raise ValueError('OBSERVATION_ID_CONFLICT')
    with db:
        db.execute('INSERT OR IGNORE INTO observations(id,observed_epoch,body,digest) VALUES(?,?,?,?)',
                   (value['id'], epoch, raw.decode(), digest))
    return {'id': value['id'], 'digest': digest}

def acknowledge(db, ack):
    if not isinstance(ack, dict) or not isinstance(ack.get('id'), str) or not isinstance(ack.get('digest'), str):
        return
    with db:
        db.execute('UPDATE observations SET acked=1 WHERE id=? AND digest=?', (ack['id'], ack['digest']))

def sample(value):
    # Validation happened before durable ingest; historical samples may be older than seven days.
    row = {'observed_at': value['observed_at'], 'quality': value['quality'], 'stale_after_s': 180,
           'observation_only': True, 'ct_ratio_verified': False, 'direction_verified': False,
           'display_comparison_verified': False, 'output_control_allowed': False, 'modbus_write_allowed': False}
    row.update({k: None for k in FIELDS})
    row['observation'] = decode(value['frames']) if value['quality'] == 'UNVERIFIED' else None
    return row

def observation_snapshot(database=DATABASE, now=None):
    now = time.time() if now is None else now
    if not Path(database).is_file():
        return None
    with closing(sqlite3.connect(Path(database).as_uri() + '?mode=ro', uri=True, timeout=3)) as db:
        db.execute('PRAGMA query_only=ON')
        latest = db.execute('SELECT body FROM observations ORDER BY observed_epoch DESC LIMIT 1').fetchone()
        if not latest:
            return None
        history = db.execute('SELECT body,MAX(observed_epoch) FROM observations WHERE observed_epoch>=? GROUP BY CAST(observed_epoch/900 AS INTEGER) ORDER BY MAX(observed_epoch)', (now - 86400,)).fetchall()
    return {'id': SOURCE, 'circuit_role': 'UNASSIGNED', 'meter_model': 'ADL400N-CT/UNVERIFIED',
            'register_map_id': MAP_ID, 'current': sample(json.loads(latest[0])),
            'history': [sample(json.loads(r[0])) for r in history][-100:]}
