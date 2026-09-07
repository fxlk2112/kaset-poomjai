import json
from pathlib import Path
config=json.loads(Path('/etc/sucha-farm-lan/config.json').read_text())
bind=config['bind']
workers=1
threads=8
worker_class='gthread'
timeout=30
graceful_timeout=15
keepalive=2
accesslog=None
errorlog='-'
loglevel='critical'
limit_request_line=4096
limit_request_fields=40
limit_request_field_size=8190
forwarded_allow_ips=''
certfile='/etc/sucha-farm-lan/tls/server.crt'
keyfile='/etc/sucha-farm-lan/tls/server.key'
def ssl_context(conf, factory):
    import ssl
    context=factory()
    context.minimum_version=ssl.TLSVersion.TLSv1_2
    return context
