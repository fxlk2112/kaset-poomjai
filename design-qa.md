# Master Farm Map Design QA

## Verified target

- Map revision: `OWNER_LAYOUT_2026_09_01_C`
- Source artwork: `images/farm-map/pixel-art-farm-master-v1.png`
- Source SHA256: `D65676108F678AF7D21EFEE2F88B38ED2E5AF6FCF872C4ED6D2EE487DD4F13D3`
- Desktop evidence: `qa/implementation-master-map-desktop.png` (`1280 x 720`)
- Mobile evidence: `qa/implementation-master-map-mobile.png` (`390 x 844` viewport)
- Safety state: `DATA_ONLY`, `SAFE_OFF`, `output control = disabled`

## Owner-confirmed layout

- E1-E4 retain their four central plots.
- E5 is a compact strip beside the head of E4/E1. Its height follows E4 plus E1,
  while its usable width is approximately half of an E plot.
- The E5 automation overlay excludes the pond edge and staff accommodation.
- G and J use their corrected physical locations.
- The main pond is selectable and hands off to the existing read-only level,
  estimated-volume, and history view.

This overlay is an owner-confirmed operational diagram, not a surveyed GIS
boundary. Keep the polygon as schematic until measured coordinates or a survey
drawing are approved.

## Visual review

- Desktop preserves the map-left/detail-right hierarchy and keeps the farm artwork
  sharp at the target viewport.
- E5 and pond labels are visually separated; the compact E5 boundary follows the
  usable strip without covering staff buildings.
- E1-E5, the pond, G, and J are readable without changing the source raster.
- Mobile collapses to map-then-detail with no visible horizontal overflow.
- The cyan automation outline, pond outline, dark-teal surface, and safety badges
  match the existing FARMULTIMATE visual system.
- Every mapped area remains keyboard-focusable and has an accessible name.

## Functional and safety review

- Selecting E1-E5 shows `PRE-COMMISSIONING`, `SAFE_OFF`, and `UNASSIGNED`.
- Selecting the pond opens the existing telemetry view and provides a return action
  to the Master Map.
- No pump, valve, relay, Modbus, or other actuator command is rendered.
- Raspberry Pi 5 remains the sole eventual output writer; the dashboard is a
  supervisory/read-only surface.
- The multi-model weather snapshot is marked forecast-only and cannot authorize
  irrigation output.

## Validation

- `npm run check`: `56/56 PASS`
- Map coverage tests include E1-E5 and the corrected G/J locations.
- E5 geometry test locks the compact revision-C polygon.
- Direct-open regression tests confirm there is no blocking login page while
  owner-only cloud data remains protected by its API session boundary.
- Screenshot review completed for the committed desktop and mobile evidence.

## Held local evidence

The following working files are useful for local comparison but are not required
in the shared baseline and remain outside the baseline commit:

- `qa/comparison-reference-vs-master-map.png`
- `qa/e5-geometry-preview.png`
- `qa/e5-source-crop.png`
- `qa/reference-booking-desktop-normalized.png`
- `qa/reference-booking-desktop.png`

final result: passed
