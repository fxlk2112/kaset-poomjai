"""Linux RS485 reader: one port owner, fixed address/settings and FC03 blocks."""
import fcntl
import os
import select
import termios
import time
from energy_observations import registers, request

class Reader:
    def __init__(self, path):
        self.path = path
        self.fd = None

    def open(self):
        if self.fd is not None:
            return
        fd = os.open(self.path, os.O_RDWR | os.O_NOCTTY | os.O_NONBLOCK)
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            fcntl.ioctl(fd, termios.TIOCEXCL)
            self.original = termios.tcgetattr(fd)
            attr = termios.tcgetattr(fd)
            attr[0] = attr[1] = attr[3] = 0
            attr[2] = termios.CLOCAL | termios.CREAD | termios.CS8
            attr[4] = attr[5] = termios.B9600
            attr[6][termios.VMIN] = attr[6][termios.VTIME] = 0
            termios.tcsetattr(fd, termios.TCSANOW, attr)
            self.fd = fd
        except Exception:
            os.close(fd)
            raise

    def close(self):
        if self.fd is None:
            return
        try:
            termios.tcsetattr(self.fd, termios.TCSANOW, self.original)
            fcntl.ioctl(self.fd, termios.TIOCNXCL)
        except OSError:
            pass
        os.close(self.fd)
        self.fd = None

    def read(self, start, count):
        self.open()
        termios.tcflush(self.fd, termios.TCIFLUSH)
        time.sleep(0.01)
        packet = request(start, count)
        if os.write(self.fd, packet) != len(packet):
            raise OSError('SHORT_REQUEST')
        termios.tcdrain(self.fd)
        end, buffer = time.monotonic() + 2, b''
        size = 5 + 2 * count
        while time.monotonic() < end:
            if select.select([self.fd], [], [], max(0, end - time.monotonic()))[0]:
                data = os.read(self.fd, 512)
                if not data:
                    raise OSError('DEVICE_DISCONNECTED')
                buffer += data
                if len(buffer) > 1024:
                    raise ValueError('RESPONSE_TOO_LARGE')
                for i in range(max(0, len(buffer) - size + 1)):
                    frame = buffer[i:i + size]
                    try:
                        registers(frame.hex(), count)
                        return frame.hex()
                    except ValueError:
                        pass
        raise TimeoutError('NO_RESPONSE')

    def snapshot(self):
        try:
            return {'fast': self.read(0x2100, 54), 'energy': self.read(0x3000, 8)}
        except Exception:
            self.close()
            raise
