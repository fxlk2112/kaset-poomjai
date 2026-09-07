"""LAN HTTPS gateway. Auth and observations are local; only IPC can request bench control."""
import base64
import hashlib
import hmac
import importlib.util
import ipaddress
import json
import math
import os
import secrets
import socket
import sqlite3
import threading
import time
from pathlib import Path
from datetime import datetime, timezone
from flask import Flask, request, jsonify, send_from_directory

def create_app(config):
    app=Flask(__name__,static_folder=None)
    app.config['MAX_CONTENT_LENGTH']=8192
    cfg=dict(config)
    networks=[ipaddress.ip_network(v) for v in cfg['allow_networks']]
    asset_root=Path(cfg['assets']).resolve()
    allowed=set(json.loads((asset_root/'asset-manifest.json').read_text()))
    database=Path(cfg['auth_database'])
    lock=threading.Lock()
    attempts={}
    monitor_spec=importlib.util.spec_from_file_location('lan_readonly_monitor',cfg['publisher'])
    monitor=importlib.util.module_from_spec(monitor_spec)
    monitor_spec.loader.exec_module(monitor)
    def db():
        c=sqlite3.connect(database,timeout=4)
        c.row_factory=sqlite3.Row
        return c
    with db() as c:
        c.execute('CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,expires REAL NOT NULL,owner_version TEXT NOT NULL)')
    def owner():
        p=json.loads(Path(cfg['owner_file']).read_text())
        if not isinstance(p.get('email'),str) or not isinstance(p.get('pass_hash'),str): raise ValueError()
        return p
    def version(p): return hashlib.sha256((p['email'].lower()+'\0'+p['pass_hash']).encode()).hexdigest()
    def session():
        raw=request.cookies.get('__Host-farm-lan','')
        if len(raw)!=64: return False
        with db() as c:
            row=c.execute('SELECT expires,owner_version FROM sessions WHERE hash=?',(hashlib.sha256(raw.encode()).hexdigest(),)).fetchone()
        return bool(row and row['expires']>time.time() and hmac.compare_digest(row['owner_version'],version(owner())))
    def ipc(action, p=None):
        payload={**(p or {}),'action':action}
        with socket.socket(socket.AF_UNIX,socket.SOCK_STREAM) as s:
            s.settimeout(12)
            s.connect(cfg['control_socket'])
            s.sendall(json.dumps(payload,separators=(',',':')).encode()+b'\n')
            raw=b''
            while not raw.endswith(b'\n'):
                part=s.recv(65536)
                if not part or len(raw)+len(part)>131072: raise ValueError()
                raw+=part
            return json.loads(raw)
    app.extensions['lan_ipc']=ipc
    def error(code,status): return jsonify(ok=False,error=code),status
    @app.before_request
    def boundary():
        try:
            peer=ipaddress.ip_address(request.remote_addr)
            if not any(peer in n for n in networks): return error('LAN_ONLY',403)
        except ValueError: return error('LAN_ONLY',403)
        if request.host.lower()!=cfg['host'].lower(): return error('HOST_DENIED',403)
        if request.headers.get('Origin') not in (None,'https://'+cfg['host']): return error('ORIGIN_DENIED',403)
        if request.headers.get('Sec-Fetch-Site')=='cross-site': return error('ORIGIN_DENIED',403)
        if request.method not in ('GET','POST','HEAD'): return error('METHOD_DENIED',405)
        if request.method=='POST' and not request.is_json: return error('JSON_REQUIRED',415)
    @app.after_request
    def headers(response):
        response.headers['Cache-Control']='no-store' if request.path.startswith('/api') else 'no-cache'
        response.headers['X-Content-Type-Options']='nosniff'
        response.headers['X-Frame-Options']='DENY'
        response.headers['Referrer-Policy']='no-referrer'
        response.headers['Content-Security-Policy']="default-src 'self'; connect-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'"
        return response
    @app.errorhandler(Exception)
    def unexpected(_): return error('LAN_REQUEST_FAILED',400)
    @app.get('/api/lan/status')
    def status():
        try:
            state=app.extensions['lan_ipc']('read').get('data',{})
            return jsonify(ok=True,data={'transport':'LAN','controller_connected':state.get('connected') is True,'cloud_connected':state.get('cloud_connected') is True,'control_source':state.get('control_source','UNKNOWN'),'authenticated':session()})
        except Exception: return jsonify(ok=True,data={'transport':'LAN','controller_connected':False,'cloud_connected':False,'control_source':'UNKNOWN','authenticated':session()})
    @app.post('/api/lan/login')
    def login():
        data=request.get_json()
        password=data.get('password','');email=data.get('email','')
        if not isinstance(password,str) or not isinstance(email,str) or len(password)>256 or len(email)>254: return error('LOGIN_FAILED',401)
        now=time.monotonic()
        with lock:
            recent=[t for t in attempts.get('owner',[]) if now-t<300]
            if len(recent)>=10: return error('LOGIN_RATE_LIMIT',429)
            attempts['owner']=recent+[now]
        p=owner();parts=p['pass_hash'].split('$')
        if len(parts)!=4 or parts[0]!='pbkdf2' or not 10000<=int(parts[1])<=1000000: return error('OWNER_NOT_READY',503)
        salt=base64.b64decode(parts[2],validate=True)
        actual=hashlib.pbkdf2_hmac('sha256',password.encode(),salt,int(parts[1]),32)
        valid=hmac.compare_digest(actual,base64.b64decode(parts[3],validate=True))
        if not valid or not hmac.compare_digest(email.strip().lower().encode(),p['email'].strip().lower().encode()): return error('LOGIN_FAILED',401)
        raw=secrets.token_hex(32)
        with db() as c:
            c.execute('DELETE FROM sessions WHERE expires<=?',(time.time(),))
            c.execute('INSERT INTO sessions VALUES(?,?,?)',(hashlib.sha256(raw.encode()).hexdigest(),time.time()+28800,version(p)))
        with lock: attempts.clear()
        response=jsonify(ok=True)
        response.set_cookie('__Host-farm-lan',raw,max_age=28800,secure=True,httponly=True,samesite='Strict',path='/')
        return response
    @app.post('/api/lan/logout')
    def logout():
        if not session(): return error('OWNER_LOGIN_REQUIRED',401)
        # A successful logout closes the active LAN bench session first.
        reply=app.extensions['lan_ipc']('disarm')
        if not reply.get('ok'): return error('CONTROLLER_UNAVAILABLE',503)
        raw=request.cookies.get('__Host-farm-lan','')
        with db() as c: c.execute('DELETE FROM sessions WHERE hash=?',(hashlib.sha256(raw.encode()).hexdigest(),))
        response=jsonify(ok=True)
        response.delete_cookie('__Host-farm-lan',path='/',secure=True,httponly=True,samesite='Strict')
        return response
    @app.post('/api/relay-bench/<action>')
    def control(action):
        if not session(): return error('OWNER_LOGIN_REQUIRED',401)
        if action not in ('read','arm','pulse','off','disarm'): return error('METHOD_DENIED',405)
        result=app.extensions['lan_ipc'](action,request.get_json())
        return jsonify(result),200 if result.get('ok') else 409
    def health():
        value=monitor.health_snapshot(cfg['water_database'],relay_path=cfg['relay_snapshot'])
        now=time.time()
        for s in value['sources'].values():
            current=s.get('current')
            if current:
                age=max(0,now-datetime.fromisoformat(current['observed_at'].replace('Z','+00:00')).timestamp())
                current['age_s']=round(age)
                s['status']='STALE' if age>180 else current['quality']
            else: s['status']='NO_DATA'
        energy=value['energy']
        for source in energy['sources']:
            current=source['current']
            if not current:
                source['status']='NO_DATA'
                continue
            age=now-datetime.fromisoformat(current['observed_at'].replace('Z','+00:00')).timestamp()
            verified=all(current.get(g) is True for g in ('ct_ratio_verified','direction_verified','display_comparison_verified'))
            source['status']='UNCOMMISSIONED' if not verified else 'STALE' if age< -120 or age>current['stale_after_s'] else current['quality']
        energy['schema']='farmultimate.energy.v1'
        return value
    @app.post('/api/monitor/read')
    def monitor_read():
        if not session(): return error('OWNER_LOGIN_REQUIRED',401)
        return jsonify(ok=True,data=health())
    @app.get('/api/monitor/weather')
    def weather():
        try:
            p=json.loads(Path(cfg['weather_file']).read_text())
            if p.get('output_control_allowed') is not False or p.get('forecast_only') is not True: raise ValueError()
            return jsonify(ok=True,data=p)
        except Exception: return error('NO_FORECAST',404)
    @app.route('/api',methods=['POST'])
    @app.route('/api/health',methods=['GET'])
    def api():
        p=request.get_json(silent=True) or {}
        action=p.get('action','health')
        if action=='health': return jsonify(ok=True,data={'mode':'SENSOR_PHASE1_READ_ONLY','output_control_allowed':False})
        if not session(): return error('ยังไม่ได้ล็อกอิน',401)
        if action not in ('sensor_current','sensor_history'): return error('LAN_MONITOR_ONLY',403)
        if p.get('source_id')!='MAIN_WATER_LEVEL_PI_ZERO_01': return error('SOURCE_DENIED',403)
        with sqlite3.connect(Path(cfg['water_database']).as_uri()+'?mode=ro',uri=True) as c:
            c.row_factory=sqlite3.Row
            c.execute('PRAGMA query_only=ON')
            columns='observed_at,observed_epoch,quality,voltage_v,current_ma,depth_m,staff_gauge_m,volume_m3,capacity_percent,stale_after_s'
            if action=='sensor_current':
                row=c.execute('SELECT '+columns+' FROM water_level_samples WHERE source_id=? ORDER BY observed_epoch DESC LIMIT 1',(p['source_id'],)).fetchone()
                value=dict(row) if row else None
                if value: value['observed_ts']=value.pop('observed_epoch')*1000
                age=max(0,(time.time()*1000-value['observed_ts'])/1000) if value else None
                return jsonify(ok=True,data={'output_control_allowed':False,'current':value,'age_s':age,'status':('STALE' if age>value['stale_after_s'] else value['quality']) if value else 'NO_DATA'})
            hours=168 if p.get('hours')==168 else 24
            rows=c.execute('SELECT '+columns+' FROM water_level_samples WHERE source_id=? AND observed_epoch>=? ORDER BY observed_epoch DESC LIMIT 400',(p['source_id'],time.time()-hours*3600)).fetchall()
            result=[]
            for row in reversed(rows):
                value=dict(row);value['observed_ts']=value.pop('observed_epoch')*1000;result.append(value)
            return jsonify(ok=True,data={'output_control_allowed':False,'rows':result,'hours':hours})
    @app.get('/')
    @app.get('/<path:filename>')
    def assets(filename='index.html'):
        if filename not in allowed or not (asset_root/filename).is_file(): return error('NOT_FOUND',404)
        mime={'lan-setup.mobileconfig':'application/x-apple-aspen-config','lan-ca.cer':'application/pkix-cert'}.get(filename)
        return send_from_directory(asset_root,filename,mimetype=mime)
    return app

def production_app():
    return create_app(json.loads(Path(os.environ.get('FARMULTIMATE_LAN_CONFIG','/etc/sucha-farm-lan/config.json')).read_text()))
