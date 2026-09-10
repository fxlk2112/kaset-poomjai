import importlib.util
import json
from pathlib import Path
import sqlite3
import struct
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location('energy_observations', Path(__file__).parents[1] / 'owner-monitor' / 'energy_observations.py')
M = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(M)

def frames(power=-0.25):
    words = {x: 0 for x in range(0x2100, 0x2136)}
    words.update({x: 0 for x in range(0x3000, 0x3008)})
    for name, (address, count, low, high) in M.FIELDS.items():
        value = 230 if name.startswith('voltage') else 4 if name.startswith('current') else power if name == 'active_power_total_kw' else -.08 if name == 'power_factor_total' else 50 if name == 'frequency_hz' else 1234.5
        data = struct.pack('>f' if count == 2 else '>d', value)
        for i in range(count):
            words[address + i] = int.from_bytes(data[i * 2:i * 2 + 2], 'big')
    out = {}
    for name, start, count in (('fast', 0x2100, 54), ('energy', 0x3000, 8)):
        data = bytes((1, 3, count * 2)) + b''.join(words[start + i].to_bytes(2, 'big') for i in range(count))
        out[name] = (data + struct.pack('<H', M.crc(data))).hex()
    return out

class ObservationTests(unittest.TestCase):
    def store(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        path = Path(directory.name) / 'energy.sqlite3'
        return path, M.open_store(path)

    def test_crc_fixed_reads_and_broadcast_not_exposed(self):
        for start, count in ((0x2100, 54), (0x3000, 8)):
            frame = M.request(start, count)
            self.assertEqual(frame[:2], bytes((1, 3)))
            self.assertEqual(frame[-2:], struct.pack('<H', M.crc(frame[:-2])))
        with self.assertRaises(ValueError):
            M.request(0, 1)

    def test_signed_observation_cannot_be_good_or_canonical(self):
        value = M.event(frames())
        row = M.sample(value)
        self.assertEqual(row['quality'], 'UNVERIFIED')
        self.assertEqual(row['observation']['active_power_total_kw'], -.25)
        self.assertIsNone(row['active_power_total_kw'])
        self.assertFalse(row['ct_ratio_verified'])
        for key in ('ct_ratio_verified', 'direction_verified', 'word_byte_order_verified', 'modbus_write_allowed'):
            with self.assertRaises(ValueError):
                M.validate({**value, key: True})
        with self.assertRaises(ValueError):
            M.validate({**value, 'quality': 'GOOD'})

    def test_corrupt_reply_and_nan_rejected(self):
        bad = frames()
        bad['fast'] = bad['fast'][:-4] + '0000'
        with self.assertRaises(ValueError):
            M.event(bad)
        with self.assertRaises(ValueError):
            M.event(frames(float('nan')))

    def test_spool_survives_reopen_and_ack_requires_matching_digest(self):
        path, db = self.store()
        value = M.event(frames())
        ack = M.insert(db, value)
        db.close()
        db = M.open_store(path)
        self.addCleanup(db.close)
        self.assertEqual(db.execute('select count(*) from observations where acked=0').fetchone()[0], 1)
        M.acknowledge(db, {**ack, 'digest': 'wrong'})
        self.assertEqual(db.execute('select acked from observations').fetchone()[0], 0)
        M.acknowledge(db, ack)
        self.assertEqual(db.execute('select acked from observations').fetchone()[0], 1)

    def test_duplicate_delivery_idempotent_conflicting_id_rejected(self):
        path, db = self.store()
        self.addCleanup(db.close)
        value = M.event(frames())
        self.assertEqual(M.insert(db, value), M.insert(db, value))
        self.assertEqual(db.execute('select count(*) from observations').fetchone()[0], 1)
        changed = M.event(frames(.5)); changed['id'] = value['id']
        with self.assertRaises(ValueError):
            M.insert(db, changed)

    def test_fault_remains_null_and_history_order_does_not_follow_delivery_order(self):
        path, db = self.store()
        now = 1800000000
        fault = M.event(now=now, error='READ_FAILED')
        M.insert(db, fault, now)
        M.insert(db, M.event(frames(), now=now - 1000), now)
        db.close()
        snapshot = M.observation_snapshot(path, now)
        self.assertEqual(snapshot['current']['quality'], 'SENSOR_FAULT')
        self.assertIsNone(snapshot['current']['observation'])
        self.assertEqual(len(snapshot['history']), 2)
        self.assertNotIn('frames', json.dumps(snapshot))

    def test_clock_future_and_ancient_replay_rejected(self):
        now = 1800000000
        value = M.event(frames(), now=now)
        with self.assertRaises(ValueError):
            M.validate(value, now - 121)
        with self.assertRaises(ValueError):
            M.validate(value, now + 8 * 86400)

    def test_history_windows_preserve_thirty_days_without_inventing_coverage(self):
        path, db = self.store()
        now = 1800000000
        for hours in (31*24, 29*24, 6*24, 23, .8, .4, 0):
            timestamp=now-hours*3600
            M.insert(db,M.event(frames(),now=timestamp),timestamp)
        db.close()
        windows=M.observation_snapshot(path,now)['windows']
        self.assertEqual(set(windows), {'1','24','168','720'})
        self.assertEqual(len(windows['1']['points']),3)
        self.assertEqual(len(windows['720']['points']),5) # newest three share one eight-hour bucket
        for key, window in windows.items():
            self.assertLessEqual(len(window['points']),120)
            self.assertTrue(all(row['quality']=='UNVERIFIED' for row in window['points']))
            self.assertNotIn('frames',json.dumps(window))

if __name__ == '__main__':
    unittest.main()
