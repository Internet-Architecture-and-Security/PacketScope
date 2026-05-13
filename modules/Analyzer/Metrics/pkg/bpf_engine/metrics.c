// +build ignore

#include "common.h"

char __license[] SEC("license") = "Dual BSD/GPL";

// Include distinct probe hook modules
#include "rx.h"
#include "tx.h"
#include "drop.h"
