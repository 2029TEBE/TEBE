# Docker image identity parity — 18 November 2026

Protected server diagnostics (PR #643) established:
- CI used Docker Engine 28.0.4 with the classic image store.
- Servitro uses Docker Engine 29.1.3 with the containerd image store.
- Both loaded API and web revisions and canonical runtime digests exactly
  matched CI, although daemon image IDs differed.

CI now builds release images in a separate, pinned Docker 29.1.3 context with
containerd-snapshotter enabled. The original CI PostgreSQL/Redis service
daemon and production server configuration remain unchanged. The official
setup action is pinned by commit.

A hosted-CI-only save/remove-private-alias/load test requires identical IDs,
revision labels and runtime digests before acceptance evidence is recorded.
Production retains its original strict ID and source revision comparisons,
archive hash verification, healthy running-image checks and HTTP boundaries.
No ID mismatch is ignored or treated as an approved exception.

Storage measurement streams both classic tar layers and nested OCI gzip
layers, without extracting files. It counts nested inflation before reserving
two expanded copies plus 2 GiB. Unsupported compression fails closed.
Python 3 is an explicit standard-library-only runner prerequisite.

The immediately previous images, historical rollback tags, database backups,
volumes, pinned SSH trust and protected deployment environment remain intact.
