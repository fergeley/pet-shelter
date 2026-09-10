# Persisted-but-unrendered data is a promise you have not kept

**Learned:** 2026-09-03

`tngQrUrl` and `bankQrUrl` shipped with a column, a validator, provider context
and a working upload control, and nothing that displayed them. The admin field
said "not yet shown to donors", but the upload succeeded and the image landed in
Postgres, so the interface still said "this works".

A field the user can fill in is a claim that filling it does something. Either
wire it end to end or do not ship the input; a caveat in help text does not
cancel a working button.
