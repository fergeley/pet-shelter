# "It rendered" is not correctness when the artifact looks valid

**Learned:** 2026-09-03

`qrcode-generator`'s default byte mode is `charCodeAt(i) & 0xff`. An em dash
encodes as byte `0x14`. It does not throw — it emits a perfectly scannable QR
carrying a corrupted payment string, so a donor scans a valid code and the money
goes nowhere.

Test encoders with non-ASCII input specifically, and cap payload length in
encoded bytes rather than UTF-16 units: QR capacity is a byte budget.
