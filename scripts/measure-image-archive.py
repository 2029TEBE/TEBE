#!/usr/bin/env python3
"""Count archive bytes and nested OCI gzip layer expansion, without extraction."""
import gzip
import io
import json
import sys
import tarfile

LIMIT = 32 * 1024 ** 3
CHUNK = 1024 * 1024

class Counted:
    def __init__(self, stream):
        self.stream = stream
        self.total = 0
    def read(self, size=-1):
        data = self.stream.read(size)
        self.total += len(data)
        if self.total > LIMIT:
            raise ValueError("expanded archive exceeds 32 GiB")
        return data

class Prefixed:
    def __init__(self, prefix, stream):
        self.prefix = prefix
        self.stream = stream
    def read(self, size=-1):
        if size < 0:
            raise ValueError("unbounded nested read refused")
        data = self.prefix[:size]
        self.prefix = self.prefix[len(data):]
        return data + self.stream.read(size - len(data))

def measure(path):
    extra = 0
    entries = 0
    with gzip.open(path, "rb") as raw:
        counted = Counted(raw)
        with tarfile.open(fileobj=counted, mode="r|") as archive:
            for member in archive:
                entries += 1
                if entries > 100000 or member.size > LIMIT:
                    raise ValueError("archive limits exceeded")
                if not member.isfile():
                    continue
                with archive.extractfile(member) as payload:
                    prefix = payload.read(4)
                    if prefix == b"\x28\xb5\x2f\xfd":
                        raise ValueError("unsupported zstd layer; capacity cannot be attested")
                    if prefix[:2] != b"\x1f\x8b":
                        continue
                    expanded = 0
                    with gzip.GzipFile(fileobj=Prefixed(prefix, payload), mode="rb") as layer:
                        while True:
                            chunk = layer.read(CHUNK)
                            if not chunk:
                                break
                            expanded += len(chunk)
                            if expanded + extra + counted.total > LIMIT:
                                raise ValueError("expanded layers exceed 32 GiB")
                    extra += max(0, expanded - member.size)
        # Drain padding and validate the outer gzip CRC too.
        while counted.read(CHUNK):
            pass
    effective = counted.total + extra
    if entries == 0 or effective <= 0 or effective > LIMIT:
        raise ValueError("invalid image archive capacity")
    return {"expandedBytes": counted.total, "nestedInflationBytes": extra,
            "effectiveExpandedBytes": effective}

try:
    print(json.dumps(measure(sys.argv[1])))
except Exception as error:
    print("BLOCKED: cannot measure image archive: " + str(error), file=sys.stderr)
    sys.exit(1)
