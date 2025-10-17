extern crate blazesym;

use blazesym::dwarf::DwarfResolver;
use std::env;

fn show_usage() {
    let args: Vec<String> = env::args().collect();
    println!("Usage: {} <file> <address>", args[0]);
}

fn main() {
    let args: Vec<String> = env::args().collect();

    if args.len() != 3 {
        show_usage();
        return;
    }

    let bin_name = &args[1];
    let mut addr_str = &args[2][..];

    if &addr_str[0..2] == "0x" {
        // Remove prefixed 0x
        addr_str = &addr_str[2..];
    }
    let addr = u64::from_str_radix(addr_str, 16).unwrap();

    let resolver = DwarfResolver::open_for_addresses(bin_name, &[addr]).unwrap();
    if let Some((dir, file, line)) = resolver.find_line(addr) {
        println!("0x{:x} @ {}/{}:{}", addr, dir, file, line);
    } else {
        println!("0x{:x} is not found", addr);
    }
}
