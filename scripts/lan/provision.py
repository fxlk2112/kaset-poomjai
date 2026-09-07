#!/usr/bin/env python3
"""Root-only LAN certificate/config provisioning; stdout contains public certificates only."""
import base64
import grp
import ipaddress
import json
import os
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import NameOID, ExtendedKeyUsageOID

ROOT=Path('/etc/sucha-farm-lan')
NAME='farmultimate.local'

def protected(path, value, mode, gid=0):
    path.write_bytes(value)
    os.chown(path,0,gid)
    path.chmod(mode)

def main():
    if os.geteuid()!=0: raise RuntimeError()
    gid=grp.getgrnam('sucha-farm-lan').gr_gid
    route=json.loads(subprocess.check_output(['ip','-j','route','get','1.1.1.1']))[0]
    address=ipaddress.ip_address(route['prefsrc'])
    iface=json.loads(subprocess.check_output(['ip','-j','addr','show','dev',route['dev']]))[0]
    prefix=next(a['prefixlen'] for a in iface['addr_info'] if a['local']==str(address))
    if not address.is_private or not 16<=prefix<=30: raise RuntimeError()
    network=str(ipaddress.ip_network(str(address)+'/'+str(prefix),strict=False))
    ROOT.mkdir(exist_ok=True,mode=0o750);os.chown(ROOT,0,gid)
    authority=ROOT/'authority';authority.mkdir(exist_ok=True,mode=0o700)
    tls=ROOT/'tls';tls.mkdir(exist_ok=True,mode=0o750);os.chown(tls,0,gid)
    now=datetime.utcnow()
    if not (authority/'ca.key').exists():
        key=ec.generate_private_key(ec.SECP256R1())
        subject=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,'FARMULTIMATE Farm LAN CA')])
        ca=(x509.CertificateBuilder().subject_name(subject).issuer_name(subject).public_key(key.public_key())
            .serial_number(x509.random_serial_number()).not_valid_before(now-timedelta(minutes=5))
            .not_valid_after(now+timedelta(days=1825)).add_extension(x509.BasicConstraints(ca=True,path_length=0),critical=True)
            .add_extension(x509.KeyUsage(False,False,False,False,False,True,True,False,False),critical=True)
            .add_extension(x509.NameConstraints(permitted_subtrees=[x509.DNSName(NAME)],excluded_subtrees=None),critical=True)
            .sign(key,hashes.SHA256()))
        protected(authority/'ca.key',key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()),0o600)
        protected(authority/'ca.crt',ca.public_bytes(serialization.Encoding.PEM),0o644)
    key=serialization.load_pem_private_key((authority/'ca.key').read_bytes(),password=None)
    ca=x509.load_pem_x509_certificate((authority/'ca.crt').read_bytes())
    existing=x509.load_pem_x509_certificate((tls/'server.crt').read_bytes()) if (tls/'server.crt').exists() else None
    if not existing or existing.not_valid_after<now+timedelta(days=30):
        server=ec.generate_private_key(ec.SECP256R1())
        cert=(x509.CertificateBuilder().subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,NAME)]))
            .issuer_name(ca.subject).public_key(server.public_key()).serial_number(x509.random_serial_number())
            .not_valid_before(now-timedelta(minutes=5)).not_valid_after(now+timedelta(days=365))
            .add_extension(x509.BasicConstraints(ca=False,path_length=None),critical=True)
            .add_extension(x509.SubjectAlternativeName([x509.DNSName(NAME)]),critical=False)
            .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]),critical=False)
            .sign(key,hashes.SHA256()))
        protected(tls/'server.key',server.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()),0o640,gid)
        protected(tls/'server.crt',cert.public_bytes(serialization.Encoding.PEM),0o644,gid)
    config={'host':NAME+':8443','bind':str(address)+':8443','allow_networks':[network,'127.0.0.0/8'],
        'assets':'/opt/sucha-farm-lan/current','auth_database':'/var/lib/sucha-farm-lan/auth.sqlite3',
        'owner_file':str(ROOT/'owner.json'),'control_socket':'/run/sucha-relay-bench/control.sock',
        'publisher':'/opt/sucha-owner-monitor/publisher.py','water_database':'/var/lib/sucha-water-dashboard/water-level.sqlite3',
        'relay_snapshot':'/var/lib/sucha-relay-observer/latest.json','weather_file':'/var/lib/sucha-owner-weather/latest.json'}
    config_path=ROOT/'config.json'
    if config_path.exists() and json.loads(config_path.read_text())!=config: raise RuntimeError('CONFIG_DRIFT')
    protected(config_path,json.dumps(config).encode(),0o640,gid)
    cert=x509.load_pem_x509_certificate((tls/'server.crt').read_bytes())
    public=cert.public_key().public_bytes(serialization.Encoding.DER,serialization.PublicFormat.SubjectPublicKeyInfo)
    digest=hashes.Hash(hashes.SHA256());digest.update(public)
    print(json.dumps({'ca_pem':ca.public_bytes(serialization.Encoding.PEM).decode(),
        'ca_der':base64.b64encode(ca.public_bytes(serialization.Encoding.DER)).decode(),
        'leaf_pin':base64.b64encode(digest.finalize()).decode()}))

if __name__=='__main__':
    try: main()
    except Exception: raise SystemExit('PROVISION_FAILED')
