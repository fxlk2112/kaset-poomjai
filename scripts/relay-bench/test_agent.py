import tempfile
import unittest
import uuid
from pathlib import Path
from agent import BenchFault, Controller, Journal, write_frame, crc16

class FakeDriver:
    def __init__(self): self.on=set();self.pulses=0;self.stops=0;self.fail=False
    def read_all(self):
        return [{"id":m,"relay_status":[(m,i+1) in self.on for i in range(8)]} for m in ["RELAY_A","RELAY_B"]]
    def pulse(self,module,channel,deadline,allowed_on=()):
        self.pulses+=1
        if self.fail:raise BenchFault("WRITE_FAILED")
        self.on.add((module,channel))
    def all_off(self):self.on.clear();self.stops+=1
    def channel_off(self,module,channel):self.on.discard((module,channel))

class ControllerTest(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.path=Path(self.temp.name)/"journal.sqlite3"
        self.driver=FakeDriver();self.controller=Controller(self.driver,Journal(self.path));self.controller.seen_stop_seq=1
        self.addCleanup(self.controller.journal.db.close)
    def command(self,channel=1,module="RELAY_A",action="PULSE"):
        return {"id":str(uuid.uuid4()),"module":module,"channel":channel,"action":action,"pulse_seconds":5 if action=="PULSE" else 0,"expires_at":9000,"stop_seq":1}
    def result(self,*commands):
        return {"protocol_version":2,"server_now":1000,"armed_until":900000,"stop_seq":1,"commands":list(commands),"acknowledged_ids":[]}
    def test_frames_allow_only_fixed_pulses_individual_off_and_all_off(self):
        for ch in range(1,9):
            f=write_frame(1,ch);self.assertEqual(f[1],5);self.assertEqual(int.from_bytes(f[2:4],"big"),0x0200+ch-1)
            self.assertEqual(f[4:6],b"\x00\x32");self.assertEqual(crc16(f[:-2]),int.from_bytes(f[-2:],"little"))
            self.assertEqual(write_frame(1,ch,off=True)[2:6],(ch-1).to_bytes(2,"big")+b"\x00\x00")
        self.assertEqual(write_frame(1)[2:6],b"\x00\xff\x00\x00")
        for ch in [0,9,True,"1"]:
            with self.assertRaises(BenchFault):write_frame(1,ch)
    def test_independent_channels_and_early_off_preserve_other_timers(self):
        a,b,c=self.command(),self.command(2),self.command(1,"RELAY_B")
        self.controller.accept(self.result(a,b,c),.1);self.assertEqual(len(self.driver.on),3)
        self.controller.accept(self.result(self.command(action="OFF")),.1)
        self.assertEqual(self.driver.on,{("RELAY_A",2),("RELAY_B",1)})
        self.assertEqual(self.controller.acks[a["id"]]["status"],"OFF_VERIFIED")
        self.driver.on.remove(("RELAY_A",2));self.controller.snapshot()
        self.assertEqual(self.controller.acks[b["id"]]["status"],"OFF_VERIFIED");self.assertEqual(len(self.controller.active),1)
    def test_durable_dedupe_survives_restart_and_lost_ack(self):
        c=self.command();self.controller.accept(self.result(c),.1);self.driver.on.clear();self.controller.snapshot()
        restarted=Controller(self.driver,Journal(self.path));restarted.seen_stop_seq=1;self.addCleanup(restarted.journal.db.close)
        restarted.accept(self.result(c),.1);self.assertEqual(self.driver.pulses,1)
    def test_expiry_bad_duration_unknown_protocol_and_bad_channel_prevent_on(self):
        for key,value in [("expires_at",1001),("pulse_seconds",60),("stop_seq",9),("channel",9)]:
            c=self.command();c[key]=value
            with self.assertRaises(BenchFault):self.controller.accept(self.result(c),.1)
        r=self.result(self.command());r["protocol_version"]=1
        with self.assertRaises(BenchFault):self.controller.accept(r,.1)
        self.assertEqual(self.driver.pulses,0)
    def test_ambiguous_write_stops_all_and_never_replays_on(self):
        c=self.command();self.driver.fail=True
        with self.assertRaises(BenchFault):self.controller.accept(self.result(c),.1)
        self.assertEqual(self.driver.stops,1);self.driver.fail=False
        self.controller.accept(self.result(c),.1);self.assertEqual(self.driver.pulses,1)
    def test_global_stop_and_session_expiry_stop_every_active_channel(self):
        self.controller.accept(self.result(self.command(),self.command(2)),.1)
        r=self.result();r["stop_seq"]=2;self.controller.accept(r,.1)
        self.assertEqual(self.driver.on,set());self.assertEqual(self.controller.active,{})
        self.controller.seen_stop_seq=1;self.controller.accept(self.result(self.command()),.1)
        r=self.result();r["armed_until"]=0;self.controller.accept(r,.1);self.assertEqual(self.driver.on,set())
    def test_idle_fault_recovers_and_acks_are_retained_until_confirmed(self):
        c=self.command();self.controller.accept(self.result(c),.1);self.assertIn(c["id"],self.controller.acks)
        r=self.result();r["acknowledged_ids"]=[c["id"]];self.controller.accept(r,.1);self.assertNotIn(c["id"],self.controller.acks)
        self.controller.fault="READBACK_FAILED";self.controller.accept(self.result(),.1)
        self.assertEqual(self.controller.fault,"NONE");self.assertEqual(self.driver.on,set())
    def test_unexpected_on_faults_and_duplicate_channel_cannot_extend_timer(self):
        self.driver.on.add(("RELAY_B",8))
        with self.assertRaises(BenchFault):self.controller.snapshot()
        self.driver.on.clear();self.controller.accept(self.result(self.command()),.1)
        with self.assertRaises(BenchFault):self.controller.accept(self.result(self.command()),.1)
        self.assertEqual(self.driver.pulses,1);self.assertEqual(self.driver.on,set())

if __name__=="__main__":unittest.main()
