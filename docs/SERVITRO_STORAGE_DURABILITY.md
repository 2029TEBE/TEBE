# Servitro deployment storage — 18 November 2026

## Evidence and cause

Run 44354722675 stopped before artifact download: 3,022,604 KiB free
versus 3,176,164 KiB required; 2,180,600 inodes free. This is byte
capacity exhaustion, not inode exhaustion or dependency-audit failure.

Protected diagnostic run 44359137952 confirms runner servitro-tebe,
user tebe-ci, work /home/tebe-ci/runner/_work, and production Docker
and application all share the 19 GiB /dev/vda1 filesystem.
Mounted persistent filesystems are root and boot/EFI only; /mnt and /srv
are empty directories on root. Moving work there would not add capacity.
No runner registration, ownership, service settings or mounts are changed.

Docker inventory shows six untagged images, 45–48 hours old, referenced
by no containers. Seven-day dangling retention reclaimed zero bytes.
Tagged epmo-api/epmo-web rollback-20261111 images and all four healthy
production containers must remain intact. Runner home is only 942 MiB;
package caches, logs and /tmp are not the main storage consumers.

## Retention and prevention

- Maintenance and deployment share GitHub concurrency group
  epmo-production-deployment, cancel-in-progress false.
- Maintenance additionally locks its existing deployment user's private
  host lock; scheduled every six hours and manually dispatchable.
- Only dangling, unused Docker images expire after 24 hours.
- Only unused build cache expires after seven days.
- Only generated epmo-release-api/web aliases with exact 40-hex revision
  tags expire after seven days, excluding container-referenced images.
  No force image removal, volume pruning or container deletion.
- Before replacing production containers, fixed epmo-rollback-api/web:previous
  aliases preserve their exact previous image IDs. Existing explicit rollback
  tags are never targeted. Current images remain container-referenced.
- Deployment scratch remains private, removed with always() on success,
  failure and cancellation; abandoned matching directories expire after
  three hours. Process termination outside Actions is recovered by maintenance.
- Artifact download keeps its existing artifact-size budget and 2 GiB reserve.
  After manifest/hash verification, gzip is streamed to count actual expanded
  bytes without materializing another archive. Docker and containerd each
  require twice that expansion plus 2 GiB free; runner retains 2 GiB.
  Capacity failures report actual free and required KiB and stop before sync.
- The running content IDs must equal the tested image IDs. Read-only production
  health, anonymous authorization and forged tenant-header denials must pass
  before the workflow records the deployed revision.

## Rollback

Keep database backups and protected rsync snapshots. If application rollback
is needed, first assess whether migrations are compatible; never restore or
downgrade a database automatically. The immediately previous API/web IDs are
available through epmo-rollback-api:previous and epmo-rollback-web:previous.
Promote those exact IDs using the existing reviewed Compose release process.
Existing historical rollback-20261111 images remain untouched.
Revert the repository change to restore the prior retention rules; this does
not restore removed disposable images, which are reproducible from CI.

## Verification and limitations

Record before/after capacity, a successful verified production deployment,
its actual revision and image IDs, and a subsequent maintenance cycle in the
execution result. A successful inventory or maintenance job is not completion.
No purchases, disk resizing, database changes for storage maintenance, or
service restarts are authorized by this change. If fail-closed capacity still
cannot be met, report the measured deficit and request separately approved
persistent capacity. Authentication smoke proves anonymous/forged-header
denial; authenticated cross-tenant acceptance remains covered by isolated CI.
