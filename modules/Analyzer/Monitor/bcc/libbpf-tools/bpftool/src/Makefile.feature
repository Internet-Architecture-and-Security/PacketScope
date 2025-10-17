# SPDX-License-Identifier: (GPL-2.0-only OR BSD-2-Clause)

pound := \#

CFLAGS_BACKUP := $(CFLAGS)
ifneq ($(LLVM),)
  CFLAGS += -Wno-unused-command-line-argument
endif

### feature-clang-bpf-co-re

feature-clang-bpf-co-re := \
  $(shell printf '%s\n' 'struct s { int i; } __attribute__((preserve_access_index)); struct s foo;' | \
    $(CLANG) -g -target bpf -S -o - -x c - 2>/dev/null | grep -q BTF_KIND_VAR && echo 1)

### feature-libbfd

LIBBFD_PROBE := '$(pound)include <bfd.h>\n'
LIBBFD_PROBE += 'int main(void) {'
LIBBFD_PROBE += '	bfd_demangle(0, 0, 0);'
LIBBFD_PROBE += '	return 0;'
LIBBFD_PROBE += '}'

define libbfd_build
  $(shell printf '%b\n' $(LIBBFD_PROBE) | \
    $(CC) $(CFLAGS) -Wall -Werror $(LDFLAGS) -x c - $(1) -S -o - >/dev/null 2>&1 \
    && echo 1)
endef

feature-libbfd := \
  $(findstring 1,$(call libbfd_build,-lbfd -ldl))
ifneq ($(feature-libbfd),1)
  feature-libbfd-liberty := \
    $(findstring 1,$(call libbfd_build,-lbfd -ldl -liberty))
  ifneq ($(feature-libbfd-liberty),1)
    feature-libbfd-liberty-z := \
      $(findstring 1,$(call libbfd_build,-lbfd -ldl -liberty -lz))
  endif
endif
HAS_LIBBFD := $(findstring 1, \
  $(feature-libbfd)$(feature-libbfd-liberty)$(feature-libbfd-liberty-z))

### feature-disassembler-four-args

DISASSEMBLER_PROBE := '$(pound)include <dis-asm.h>\n'
DISASSEMBLER_PROBE += 'int main(void) {'
DISASSEMBLER_PROBE += '	disassembler((enum bfd_architecture)0, 0, 0, NULL);'
DISASSEMBLER_PROBE += '	return 0;'
DISASSEMBLER_PROBE += '}'

define disassembler_build
  $(shell printf '%b\n' $(1) | \
    $(CC) $(CFLAGS) -Wall -Werror $(LDFLAGS) -x c - -lbfd -lopcodes -S -o - >/dev/null 2>&1 \
    && echo 1)
endef

feature-disassembler-four-args := \
    $(findstring 1, $(call disassembler_build,$(DISASSEMBLER_PROBE)))

### feature-disassembler-init-styled

DISASSEMBLER_STYLED_PROBE := '$(pound)include <dis-asm.h>\n'
DISASSEMBLER_STYLED_PROBE += 'int main(void) {'
DISASSEMBLER_STYLED_PROBE += '	init_disassemble_info(NULL, 0, NULL, NULL);'
DISASSEMBLER_STYLED_PROBE += '	return 0;'
DISASSEMBLER_STYLED_PROBE += '}'

feature-disassembler-init-styled := \
    $(findstring 1, $(call disassembler_build,$(DISASSEMBLER_STYLED_PROBE)))

### feature-libcap

LIBCAP_PROBE := '$(pound)include <sys/capability.h>\n'
LIBCAP_PROBE += 'int main(void) {'
LIBCAP_PROBE += '	cap_free(0);'
LIBCAP_PROBE += '	return 0;'
LIBCAP_PROBE += '}'

define libcap_build
  $(shell printf '%b\n' $(LIBCAP_PROBE) | \
    $(CC) $(CFLAGS) -Wall -Werror $(LDFLAGS) -x c - -lcap -S -o - >/dev/null 2>&1 \
    && echo 1)
endef

feature-libcap := $(findstring 1, $(call libcap_build))

### Print detection results

define print_status
  ifeq ($(1), 1)
    MSG = $(shell printf '...%30s: [ \033[32mon\033[m  ]' $(2))
  else
    MSG = $(shell printf '...%30s: [ \033[31mOFF\033[m ]' $(2))
  endif
endef
feature_print_status = $(eval $(print_status)) $(info $(MSG))

$(call feature_print_status,$(HAS_LIBBFD),libbfd)

$(foreach feature,$(filter-out libbfd,$(FEATURE_DISPLAY)), \
  $(call feature_print_status,$(feature-$(feature)),$(feature)))

CFLAGS := $(CFLAGS_BACKUP)
