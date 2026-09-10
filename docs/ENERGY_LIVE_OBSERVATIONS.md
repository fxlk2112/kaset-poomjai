# Energy observations — OWNER-ENERGY-LIVE-002

Owner: SUCHA. Branch: `pick/energy-live-observation-v1`. Source baseline: `57b2668`.

The installed meter responds to address 1, 9600 8N1, read-only Modbus FC03 after
the operator selected RS485 on the Waveshare USB TO RS232/485 adapter. The actual
adapter is non-isolated. Exact CT variant, ratio, phase pairing, direction,
display comparison and electrical installation acceptance remain unverified.
No meter settings or outputs are written by this implementation.

## Data path

1. Pi Zero polls only registers `0x2100/54` and `0x3000/8` every 15 seconds.
   The stable serial identity stays in protected device configuration. Exclusive
   serial locking prevents a second reader opening the port.
2. A SQLite WAL outbox retains seven days locally. MQTT QoS 1 publishes only the
   dedicated energy observation topic using the existing protected edge identity.
3. A separate Pi 5 receiver validates schema, CRC, ranges, source and timestamp,
   commits to a dedicated SQLite database, then acknowledges the event ID and
   digest. Retries are idempotent; an ID with different contents is rejected.
4. Pi 5 retains 30 days. Existing owner-monitor publishing remains once per minute.
   LAN reads the same local history without contacting Cloud. The dashboard polls
   every 30 seconds and displays the latest point per 15-minute bucket for 24 hours.

Outages shorter than seven days can replay the Pi Zero outbox. An outage longer
than retention expires old unsent records and logs a count; this is not unlimited
storage. Restarts preserve the outbox. Replayed older records cannot replace a
newer current reading. This task does not perform a physical WAN-disconnection test.

## Measurement boundary

`farmultimate.energy.observation.v1` is separate from commissioned energy samples.
All canonical measurement fields remain null, all verification gates remain false,
and provisional numbers appear only inside `observation`. Quality is `UNVERIFIED`
or `SENSOR_FAULT`, never `GOOD`. The role is `UNASSIGNED`; this does not assert the
meter measures a particular pump or the entire farm.

Signed power and PF are preserved. Negative power does not establish export or
correct CT orientation. Stale/fault current readings are hidden, not replaced with
zero. Raw register frames stay on the Pis; the owner projection omits them.

## Scoped installation and rollback

Stage `scripts/energy-observer/*.py` and
`scripts/owner-monitor/energy_observations.py` together on each device. As root,
run `install.py five` first, then `install.py zero`. The installer creates only
the two energy services and dedicated state directories. Pi Zero gets a private
runtime containing the already installed paho library; it does not gain access
to water-service files. MQTT password remains a systemd credential on the device.

Pi 5 adds only an observation-write and ACK-read ACL for the existing edge user,
then reloads Mosquitto. No listener is added and existing water services and
controllers are not restarted. The dedicated services restart after a fault.

Deploy `publisher.py` and `energy_observations.py` together under the existing
owner-monitor application directory. Deploy the energy-only LAN status change
and release assets; gracefully reload only the LAN web workers. The frontend
owner Worker changes its energy projection; backend Worker and D1 schema do not
change. Preserve current deployed assets as the rollback target.

Each energy installer records protected `rollback.json` with original backups
and installed hashes. Run the installed `uninstall.py` as root for its device;
it refuses changed files, stops only its energy service, restores recorded files
and preserves measurement databases and the private runtime. Do not delete data
as part of rollback. Publisher/LAN changes use separate timestamped backups.

## Verification

- JavaScript contract/UI checks: 132 passing; relay tree: 9 valid messages.
- Python observation checks: 7 passing; owner-monitor checks: 6 passing.
- LAN tests on Pi 5 runtime: 8 passing, including auth, stale observation handling
  and canonical-null preservation. Existing LAN SQLite resource warnings remain.
- Synthetic UI fixture: 390, 840 and 1280 pixel widths, no horizontal overflow or
  browser errors. Mobile and desktop screenshots visually inspected. These
  screenshots demonstrate presentation, not measurement accuracy or owner login.
- Live service, recovery, Cloud and LAN readbacks are recorded in the deployment
  checkpoint after installation.

Safety: `DATA_ONLY / output_control_allowed=false / modbus_write_allowed=false /
HARDWARE_NOT_COMMISSIONED`. Existing Pi 5 remains the sole output writer.
