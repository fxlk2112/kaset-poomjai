"""Run the unchanged read-only observer with a shared per-connection lock."""
import importlib.util
import sys
from bus_lock import serialized_bus

spec=importlib.util.spec_from_file_location('relay_observer','/opt/sucha-relay-observer/app/relay_observer.py')
observer=importlib.util.module_from_spec(spec)
sys.modules[spec.name]=observer
spec.loader.exec_module(observer)
read_device=observer.ModbusReadClient.read_device
def read_serialized(self,device):
    with serialized_bus():
        return read_device(self,device)
observer.ModbusReadClient.read_device=read_serialized
if __name__=='__main__':
    raise SystemExit(observer.main())
