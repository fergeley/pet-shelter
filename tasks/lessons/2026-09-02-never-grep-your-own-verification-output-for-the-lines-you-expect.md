# Never grep your own verification output for the lines you expect

**Learned:** 2026-09-02

To confirm a new `pretest` hook fired, I ran `npm run test:all | grep -E 'pretest|Test Files|Tests
|FAIL'` and read back "pretest fires, 775 tests pass". The run had in fact exited **1** with
`Errors 4`: an entire test tier failed to start. My pattern matched `FAIL` but not `Errors`, so the
one line that said the run was broken was the one line filtered out. I reported a green that did not
exist.

The tooling was honest. The filter was mine, and it was built from what I expected to see.

**Rule:** capture the whole output to a file and check the **exit code separately** — `cmd > out
2>&1; echo $?` — then grep the file. Never `cmd | grep …; echo $?`, which reports *grep's* status,
nor a pattern list assembled from the outcomes you anticipated. A filter written before the result
is a hypothesis, and grepping with it tests nothing.
