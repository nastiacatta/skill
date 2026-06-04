"""Mechanism correctness audit harness (bug conditions A–E).

All tests in this package are gated by ``@pytest.mark.audit`` (and the
long-running subset by ``@pytest.mark.audit_slow``).  This audit
harness is organised by bug-condition class (A–E).
"""
