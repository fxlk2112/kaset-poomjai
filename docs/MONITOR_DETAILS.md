# OWNER-MONITOR-DETAILS-003

Owner: SUCHA. Source: `b137b08`. Branch: `pick/energy-water-details-v1`.
Extend the existing owner Cloud/LAN dashboard without changing acquisition,
calibration, controller services, credentials, database schema or hardware outputs.

## Energy

Pi 5's existing observation database retains 30 days. The owner projection now
adds bounded history windows: 1 hour at 1 minute, 24 hours at 15 minutes, 7 days
at 2 hours, and 30 days at 8 hours. Each bucket uses its final actual observation;
the first actual point in the window is preserved for counter reconciliation.
Each window has at most 120 points. Original 24-hour history stays compatible.

Graphs can display signed active power or the meter's cumulative import-energy
counter. Summary cards show counter growth over the actual covered span and
minimum/maximum sampled power. A decreasing counter prevents a misleading total;
the cumulative graph breaks across the decrease. Sample maximum is not a demand
measurement. Faults and large gaps break the trace. History coverage is explicit;
30-day selection does not claim 30 days of measurements since installation.

All observations retain UNVERIFIED/SENSOR_FAULT semantics and the canonical
current fields remain null. The Worker allowlists window values and strips extras.
No new endpoint, increased Cloud publish cadence or API backend deployment.

## Reservoir

The live source schema contains level, current signal and derived volume, but no
water temperature, inlet/outlet flow or measured evaporation. The new details
show signed net storage/level change, actual-span average rates, a recent-hour
rate, sampled extrema, coverage/gaps and an actual-time level graph. Rates require
three good points spanning at least 30 minutes. The current API returns bounded
recent history; the UI reports its real span instead of implying full coverage.

Net decline is not proof of seepage: inflow, withdrawal, rain, evaporation and
overflow remain separate unknowns. Volume uses the existing uncalibrated geometry
model unchanged. Air and Pi temperatures are never substituted for water temperature.

The optional evaporation calculator is an explicitly labelled user scenario,
with no default values, persistence or hardware effect: area in square metres ×
evaporation in mm/day ÷ 1000 yields m³/day. It is not measured loss or crop ET0.
Reference: https://www.fao.org/fishery/static/FAO_Training/FAO_Training/General/x6705e/x6705e02.htm

## Validation and release

- JavaScript checks 136/136, relay 9 messages; Python observation tests 8/8,
  owner-monitor tests 6/6.
- Live read-only extraction confirmed 30-day store exists, roughly five hours of
  energy history at implementation time, and no water-temperature field.
- Preview used an isolated local page with a real-data extract, not a live owner
  login. Range controls and separate energy metrics are tested; screenshots were
  visually inspected in CUA on mobile and desktop. No overflow or console errors.
- The evaporation example of 1000 m² and 5 mm/day returned 5 m³/day and 5000 L/day;
  these are synthetic input assumptions, not the farm's measured area/rate.
- Production release/readback details are appended after deployment. LAN browser
  trust limitation from the previous task remains; no certificate warning bypass.

Safety: DATA_ONLY / SAFE_OFF / uncommissioned observations / no actuator actions.
