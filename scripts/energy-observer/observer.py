"""Poll locally; durable outbox is acknowledged only after Pi 5 commits."""
import json
import os
import queue
import signal
import threading
import time
from pathlib import Path
import paho.mqtt.client as mqtt
from energy_observations import ACK_TOPIC, TOPIC, acknowledge, event, insert, open_store
from serial_reader import Reader

def run(config):
    stop = threading.Event()
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, lambda *_: stop.set())
    acks = queue.SimpleQueue()
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id='sucha-energy-observer-v1', protocol=mqtt.MQTTv311)
    credential = Path(os.environ['CREDENTIALS_DIRECTORY']) / 'mqtt-password'
    client.username_pw_set(config['mqtt_user'], credential.read_text().strip())
    client.connect_timeout = 5
    client.reconnect_delay_set(1, 30)
    client.max_queued_messages_set(64)
    client.on_connect = lambda c, u, f, rc, p: c.subscribe(ACK_TOPIC, qos=1) if rc == 0 else None
    def on_message(c, u, message):
        if message.topic != ACK_TOPIC or len(message.payload) > 256:
            return
        try:
            acks.put(json.loads(message.payload))
        except (ValueError, TypeError):
            pass
    client.on_message = on_message
    client.connect_async(config['mqtt_host'], int(config['mqtt_port']), keepalive=30)
    client.loop_start()
    def sender():
        db = open_store(config['database'])
        last_sent = {}
        try:
            while not stop.is_set():
                while not acks.empty():
                    ack = acks.get()
                    acknowledge(db, ack)
                    if isinstance(ack, dict):
                        last_sent.pop(ack.get('id'), None)
                if client.is_connected():
                    rows = db.execute('SELECT id,body FROM observations WHERE acked=0 ORDER BY observed_epoch LIMIT 32').fetchall()
                    for key, body in rows:
                        if time.monotonic() - last_sent.get(key, -100) < 10:
                            continue
                        info = client.publish(TOPIC, body, qos=1, retain=False)
                        if info.rc == mqtt.MQTT_ERR_SUCCESS:
                            last_sent[key] = time.monotonic()
                stop.wait(0.5)
        except Exception as error:
            print(json.dumps({'sender_error': type(error).__name__}), flush=True)
            stop.set()
        finally:
            db.close()
    db = open_store(config['database'])
    thread = threading.Thread(target=sender, daemon=True)
    thread.start()
    reader = Reader(config['serial_port'])
    last_status = None
    try:
        while not stop.is_set():
            start = time.monotonic()
            if time.time() < 1700000000:
                stop.wait(15)
                continue
            try:
                row = event(reader.snapshot())
            except (OSError, ValueError, TimeoutError):
                row = event(error='READ_FAILED')
            insert(db, row)
            with db:
                dropped = db.execute('SELECT COUNT(*) FROM observations WHERE acked=0 AND observed_epoch<?', (time.time() - 7 * 86400,)).fetchone()[0]
                db.execute('DELETE FROM observations WHERE observed_epoch<?', (time.time() - 7 * 86400,))
            if dropped:
                print(json.dumps({'expired_unacknowledged': dropped}), flush=True)
            if row['quality'] != last_status:
                print(json.dumps({'status': row['quality'], 'observation_only': True}), flush=True)
                last_status = row['quality']
            stop.wait(max(0, 15 - (time.monotonic() - start)))
    finally:
        stop.set()
        reader.close()
        thread.join(timeout=6)
        client.disconnect()
        client.loop_stop()
        db.close()

if __name__ == '__main__':
    run(json.loads(Path('/etc/sucha-energy-observer/config.json').read_text()))
