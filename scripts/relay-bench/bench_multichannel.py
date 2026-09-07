"""Explicit no-load hardware QA. Stop the daemon first; owns the same writer lock."""
import argparse
import fcntl
import json
import tempfile
import time
import uuid
from pathlib import Path
from agent import Controller, Journal, load_driver

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--confirm-no-load',action='store_true')
    if not parser.parse_args().confirm_no_load:raise SystemExit('NO_LOAD_CONFIRMATION_REQUIRED')
    driver=load_driver('/etc/sucha-relay-bench/config.json')
    with Path('/var/lib/sucha-relay-bench/writer.lock').open('a') as lock, tempfile.TemporaryDirectory() as temp:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        controller=Controller(driver,Journal(Path(temp)/'qa.sqlite3'));controller.seen_stop_seq=1
        def command(module,channel,action='PULSE'):
            return {'id':str(uuid.uuid4()),'module':module,'channel':channel,'action':action,'pulse_seconds':5 if action=='PULSE' else 0,'stop_seq':1,'expires_at':int(time.time()*1000)+8000}
        def accept(commands):
            now=int(time.time()*1000)
            controller.accept({'protocol_version':2,'server_now':now,'armed_until':now+900000,'stop_seq':1,'commands':commands,'acknowledged_ids':[]},0)
        def on():
            return {(m['id'],i+1) for m in driver.read_all() for i,v in enumerate(m['relay_status']) if v}
        report={'mode':'REAL_NO_LOAD_LOCAL_PI_CONTROLLER','cloud_owner_session_test':False}
        controller.stop()
        try:
            start=time.monotonic();accept([command(m,ch) for m in ['RELAY_A','RELAY_B'] for ch in range(1,9)])
            report['sixteen_channel_batch_ms']=round((time.monotonic()-start)*1000)
            report['simultaneous_on_count']=len(on())
            if report['simultaneous_on_count']!=16:raise AssertionError('ALL_CHANNELS_ON_NOT_VERIFIED')
            time.sleep(5.3);report['hardware_auto_off_all']=len(on())==0
            if not report['hardware_auto_off_all']:raise AssertionError('AUTO_OFF_NOT_VERIFIED')
            controller.snapshot()
            accept([command('RELAY_A',1),command('RELAY_A',2),command('RELAY_B',1)])
            if len(on())!=3:raise AssertionError('THREE_CHANNEL_ON_NOT_VERIFIED')
            start=time.monotonic();accept([command('RELAY_A',1,'OFF')]);report['individual_off_ms']=round((time.monotonic()-start)*1000)
            report['individual_off_preserves_other_channels']=on()=={('RELAY_A',2),('RELAY_B',1)}
            if not report['individual_off_preserves_other_channels']:raise AssertionError('INDEPENDENT_OFF_NOT_VERIFIED')
            controller.stop();report['global_off_verified']=len(on())==0
            if not report['global_off_verified']:raise AssertionError('GLOBAL_OFF_NOT_VERIFIED')
            report['result']='MULTICHANNEL_HARDWARE_PASS'
            print(json.dumps(report),flush=True)
        finally:
            controller.stop();controller.journal.db.close()

if __name__=='__main__':main()
