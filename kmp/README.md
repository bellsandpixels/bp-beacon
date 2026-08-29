# @bp/beacon (KMP)

The shared Kotlin Multiplatform Beacon feedback client (client-portal decision #103, the "one Beacon
home"). Extracted from fudemoji's local `:beacon` module so every KMP product speaks ONE native client and
ONE wire contract, the same envelope the web `@bp/beacon` SDK (this repo's root package) and the non-KMP
native clients send.

## What it does

Assembles the consented, allow-list-only feedback envelope (title, details, an optional D3 auto-context,
and an idempotency UUID) and POSTs it to the client-portal anonymous intake endpoint
(`/api/beacon-signal`). The 4a amendment holds by construction: nothing else can leave (no card/study
data, no account, no stable id). See the canonical wire spec in client-portal
`docs/beacon-anon-ingest-spec.md`.

The D3 auto-context carries coarse-only diagnostics: `platform`, `device` (phone/tablet), `os` family,
`osMajor`, `route`, `locale`. Attached only on explicit consent.

## Consuming it (git submodule)

A KMP app adds this repo as a submodule and points a Gradle module at the `kmp/` dir. In
`settings.gradle.kts`:

```kotlin
include(":beacon")
project(":beacon").projectDir = file("vendor/bp-beacon/kmp")
```

The module resolves `ktor` / `kotlinx-serialization` / `coroutines` through the CONSUMER's version
catalog (`libs.*`); fudemoji and bunko already pin identical coordinates. Then depend on `:beacon` from
the app/ui module and build the client with the app's intake product tag:

```kotlin
val client = BeaconClient(product = "bunko")            // Kotlin
BeaconClient.companion.createDefault(product = "bunko")  // Swift-friendly factory
```

`product` must be a value on the portal's `bp_product` option set (Ike/Toudai/Fudemoji/Bunko/Tokei).

## Building / testing

The module builds through its consumer (no standalone wrapper). Windows builds the `androidTarget` +
`commonMain` and runs the `commonTest` wire-contract suite; the `ios*` targets produce `Beacon.framework`
on the Mac host.
