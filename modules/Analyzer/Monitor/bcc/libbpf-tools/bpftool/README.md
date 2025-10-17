bpftool
=======

This is a mirror of [bpf-next Linux source tree's
`tools/bpf/bpftool`](https://git.kernel.org/pub/scm/linux/kernel/git/bpf/bpf-next.git/tree/tools/bpf/bpftool)
directory, plus its few dependencies from under `kernel/bpf/`, and its
supporting header files.

All the gory details of syncing can be found in `scripts/sync-kernel.sh`
script.

Some header files in this repo (`include/linux/*.h`) are reduced versions of
their counterpart files at
[bpf-next](https://git.kernel.org/pub/scm/linux/kernel/git/bpf/bpf-next.git/)'s
`tools/include/linux/*.h` to make compilation successful.

BPF/bpftool usage and questions
-------------------------------

Please check out [the manual pages](docs) for documentation about bpftool. A
number of example invocations are also displayed in [this blog
post](https://qmonnet.github.io/whirl-offload/2021/09/23/bpftool-features-thread/).

All general BPF questions, including kernel functionality, bpftool features and
usage, should be sent to bpf@vger.kernel.org mailing list. You can subscribe to
it [here](http://vger.kernel.org/vger-lists.html#bpf) and search its archive
[here](https://lore.kernel.org/bpf/). Please search the archive before asking
new questions. It very well might be that this was already addressed or
answered before.

bpf@vger.kernel.org is monitored by many more people and they will happily try
to help you with whatever issue you have. This repository's PRs and issues
should be opened only for dealing with issues pertaining to specific way this
bpftool mirror repo is set up and organized.

Dependencies
------------

Required:

- libelf
- zlib

Optional:

- libbfd (for dumping JIT-compiled program instructions)
- libcap (for better feature probing)
- kernel BTF information (for profiling programs or showing PIDs of processes
  referencing BPF objects)
- clang/LLVM (idem)

Build
[![build](https://github.com/libbpf/bpftool/actions/workflows/build.yaml/badge.svg)](https://github.com/libbpf/bpftool/actions/workflows/build.yaml)
-----

### Initialize libbpf submodule

This repository uses libbpf as a submodule. You can initialize it when cloning
bpftool:

```console
$ git clone --recurse-submodules https://github.com/libbpf/bpftool.git
```

Alternatively, if you have already cloned the repository, you can initialize
the submodule by running the following command from within the repository:

```console
$ git submodule update --init
```

### Build bpftool

To build bpftool:

```console
$ cd src
$ make
```

To build and install bpftool on the system:

```console
$ cd src
# make install
```

Building bpftool in a separate directory is supported via the `OUTPUT` variable:

```console
$ mkdir /tmp/bpftool
$ cd src
$ OUTPUT=/tmp/bpftool make
```

Most of the output is suppressed by default, but detailed building logs can be
displayed by passing `V=1`:

```console
$ cd src
$ make V=1
```

Additional `CFLAGS` can be passed to the command line if required. For example,
we can create a static build with the following commands (but note that this
does not work out-of-the-box when linking with libbfd):

```console
$ cd src
$ CFLAGS=--static make
```

### Build bpftool's man pages

The man pages for bpftool can be built with:

```console
$ cd docs
$ make
```

They can be installed on the system with:

```console
$ cd docs
# make install
```

License
-------

This work is dual-licensed under the GNU GPL v2.0 (only) license and the
BSD 2-clause license. You can choose between one of them if you use this work.

`SPDX-License-Identifier: (GPL-2.0-only OR BSD-2-Clause)`
