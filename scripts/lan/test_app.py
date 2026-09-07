import base64
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from app import create_app

class LanAuthTest(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        root=Path(self.temp.name);(root/'index.html').write_text('local site');(root/'asset-manifest.json').write_text('["index.html"]')
        salt=b'fixture-salt-for-test';password='fixture-lan-password'
        encoded='pbkdf2$10000$'+base64.b64encode(salt).decode()+'$'+base64.b64encode(hashlib.pbkdf2_hmac('sha256',password.encode(),salt,10000,32)).decode()
        self.owner=root/'owner.json';self.owner.write_text(json.dumps({'email':'qa@example.invalid','pass_hash':encoded}))
        self.config={'allow_networks':['127.0.0.0/8'],'host':'farmultimate.local:8443','assets':str(root),'auth_database':str(root/'auth.sqlite3'),'owner_file':str(self.owner),'control_socket':str(root/'absent.sock'),'publisher':str(Path(__file__).resolve().parents[1]/'owner-monitor/publisher.py'),'weather_file':str(root/'absent-weather.json'),'water_database':str(root/'absent-water.sqlite3'),'relay_snapshot':str(root/'absent-relay.json')}
        self.app=create_app(self.config);self.client=self.app.test_client();self.base='https://farmultimate.local:8443';self.actions=[]
        def ipc(action,p=None):
            self.actions.append(action)
            return {'ok':True,'data':{'connected':True,'cloud_connected':False,'control_source':'LAN'}}
        self.app.extensions['lan_ipc']=ipc
    def post(self,path,data):return self.client.post(path,json=data,base_url=self.base)
    def login(self):return self.post('/api/lan/login',{'email':'qa@example.invalid','password':'fixture-lan-password'})
    def test_local_password_verifier_works_without_cloud_and_cookie_is_protected(self):
        r=self.login();self.assertEqual(r.status_code,200)
        cookie=r.headers['Set-Cookie'];self.assertIn('Secure',cookie);self.assertIn('HttpOnly',cookie);self.assertIn('SameSite=Strict',cookie)
        self.assertNotIn('token',r.get_json());self.assertTrue(self.client.get('/api/lan/status',base_url=self.base).json['data']['authenticated'])
    def test_control_requires_cookie_not_a_fabricated_body_token(self):
        self.assertEqual(self.post('/api/relay-bench/pulse',{'token':'fake-owner-session'}).status_code,401);self.assertEqual(self.actions,[])
        self.login();self.assertEqual(self.post('/api/relay-bench/arm',{'no_load_confirmed':True}).status_code,200);self.assertEqual(self.actions,['arm'])
    def test_host_origin_and_network_boundaries(self):
        self.assertEqual(self.client.get('/',base_url='https://other.invalid').status_code,403)
        self.assertEqual(self.client.post('/api/lan/login',json={},base_url=self.base,headers={'Origin':'https://other.invalid'}).status_code,403)
        self.assertEqual(self.client.get('/',base_url=self.base,environ_base={'REMOTE_ADDR':'203.0.113.8'}).status_code,403)
    def test_password_rotation_invalidates_existing_local_session(self):
        self.login();p=json.loads(self.owner.read_text());p['pass_hash']+='changed';self.owner.write_text(json.dumps(p))
        self.assertEqual(self.post('/api/relay-bench/read',{}).status_code,401)
    def test_logout_disarms_and_revokes_session(self):
        self.login();self.assertEqual(self.post('/api/lan/logout',{}).status_code,200);self.assertEqual(self.actions,['disarm']);self.assertEqual(self.post('/api/relay-bench/read',{}).status_code,401)
    def test_private_files_and_business_writes_are_not_served(self):
        self.assertEqual(self.client.get('/owner.json',base_url=self.base).status_code,404)
        self.assertEqual(self.client.get('/../owner.json',base_url=self.base).status_code,404)
        self.login();self.assertEqual(self.post('/api',{'action':'save','data':'not allowed'}).status_code,403)
    def test_wrong_password_rate_limit_and_no_session(self):
        for _ in range(10):self.assertEqual(self.post('/api/lan/login',{'email':'qa@example.invalid','password':'wrong'}).status_code,401)
        self.assertEqual(self.login().status_code,429)

if __name__=='__main__':unittest.main()
