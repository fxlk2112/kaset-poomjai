import tempfile
import time
import unittest
import uuid
from pathlib import Path
from agent import Controller,Journal
from dual_agent import Coordinator
from test_agent import FakeDriver

class Driver(FakeDriver):
    def read_all(self):
        return [{**m,'online':True,'identity_verified':True,'crc_valid':True,'mode_verified':True,'digital_inputs':[False]*8} for m in super().read_all()]

class DualTest(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.driver=Driver();journal=Journal(Path(self.temp.name)/'journal.sqlite3',threaded=True);self.addCleanup(journal.db.close)
        self.b=Coordinator(Controller(self.driver,journal));self.b.tick()
    def arm(self):
        self.assertTrue(self.b.local('arm',{'no_load_confirmed':True})['ok'])
    def command(self,ch=1):
        return {'id':str(uuid.uuid4()),'module':'RELAY_A','channel':ch,'pulse_seconds':5,'issued_at':int(time.time()*1000),'control_epoch':self.b.epoch}
    def test_lan_operates_through_cloud_failure_without_second_writer(self):
        self.arm();self.assertTrue(self.b.local('pulse',self.command())['ok']);self.b.cloud_failure(self.b.epoch)
        self.assertEqual(len(self.driver.on),1);self.assertTrue(self.b.local('pulse',self.command(2))['ok']);self.assertEqual(len(self.driver.on),2)
    def test_delayed_cloud_response_is_discarded_after_lan_takeover(self):
        epoch,_=self.b.cloud_payload();self.arm();self.b.cloud_result(epoch,{'broken':'old response'},0);self.assertEqual(self.b.source,'LAN');self.assertEqual(self.driver.pulses,0)
    def test_cloud_outage_disarms_and_rotates_instance_before_reconnect(self):
        self.b.cloud_seen=True;old=self.b.instance;epoch=self.b.epoch;self.b.cloud_until=time.monotonic()+500
        self.b.cloud_failure(epoch);self.assertNotEqual(self.b.instance,old);self.assertEqual(self.b.cloud_until,0);self.assertEqual(self.b.c.seen_stop_seq,-1)
    def test_off_tombstone_and_epoch_prevent_late_on_replay(self):
        self.arm();late=self.command();off=self.command();off['cancel_id']=late['id'];self.assertTrue(self.b.local('off',off)['ok'])
        self.assertTrue(self.b.local('pulse',late)['ok']);self.assertEqual(self.driver.pulses,0)
        late=self.command();self.b.local('off',{});self.assertFalse(self.b.local('pulse',late)['ok']);self.assertEqual(self.driver.pulses,0)
    def test_expired_or_future_request_and_wrong_session_never_write(self):
        self.arm()
        for mutate in (lambda c:c.update(issued_at=0),lambda c:c.update(issued_at=int(time.time()*1000)+60000),lambda c:c.update(control_epoch='wrong')):
            p=self.command();mutate(p);self.assertFalse(self.b.local('pulse',p)['ok'])
        self.assertEqual(self.driver.pulses,0)
    def test_session_expiry_and_restart_disarm(self):
        self.arm();self.b.local('pulse',self.command());self.b.lan_until=time.monotonic()-1;self.b.tick();self.assertEqual(self.driver.on,set());self.assertEqual(self.b.source,'CLOUD')
        c=Coordinator(self.b.c);self.assertFalse(c.public()['session_active']);self.assertEqual(self.driver.on,set())
    def test_active_cloud_session_is_not_stolen_by_lan(self):
        self.b.cloud_until=time.monotonic()+300
        self.assertEqual(self.b.local('arm',{'no_load_confirmed':True})['error'],'CLOUD_CONTROL_ACTIVE')

if __name__=='__main__':unittest.main()
