"""Dedicated local MQTT receiver; ack after SQLite commit, no water DB writes."""
import json
import signal
import time
import paho.mqtt.client as mqtt
from energy_observations import ACK_TOPIC, DATABASE, TOPIC, insert, open_store

def run():
    db = open_store(DATABASE)
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id='sucha-energy-ingest-v1',
                         clean_session=False, protocol=mqtt.MQTTv311, manual_ack=True)
    client.reconnect_delay_set(1, 30)
    def connect(c, u, f, reason, p):
        if reason == 0:
            c.subscribe(TOPIC, qos=1)
    client.on_connect = connect
    def message(c, u, msg):
        if msg.topic != TOPIC or len(msg.payload) > 4096 or msg.retain:
            c.ack(msg.mid, msg.qos)
            return
        try:
            row = json.loads(msg.payload)
            ack = insert(db, row)
        except (ValueError, TypeError, KeyError):
            print(json.dumps({'status': 'INVALID_OBSERVATION_REJECTED'}), flush=True)
            c.ack(msg.mid, msg.qos)
            return
        # A storage failure propagates and restarts the service without acknowledging.
        c.publish(ACK_TOPIC, json.dumps(ack, separators=(',', ':')), qos=1, retain=False)
        c.ack(msg.mid, msg.qos)
        with db:
            db.execute('DELETE FROM observations WHERE observed_epoch<?', (time.time() - 30 * 86400,))
    client.on_message = message
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, lambda *_: client.disconnect())
    client.connect_async('127.0.0.1', 1883, keepalive=30)
    try:
        client.loop_forever(retry_first_connection=True)
    finally:
        db.close()

if __name__ == '__main__':
    run()
