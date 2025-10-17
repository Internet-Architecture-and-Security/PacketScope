use std::fs;
use std::io::{BufRead, BufReader, Error, ErrorKind};

use regex::Regex;

pub fn search_address_key<T, V: Ord>(
    data: &[T],
    address: V,
    keyfn: &dyn Fn(&T) -> V,
) -> Option<usize> {
    let mut left = 0;
    let mut right = data.len();

    if right == 0 {
        return None;
    }
    if address < keyfn(&data[0]) {
        return None;
    }

    while (left + 1) < right {
        let v = (left + right) / 2;
        let key = keyfn(&data[v]);

        if key == address {
            return Some(v);
        }
        if address < key {
            right = v;
        } else {
            left = v;
        }
    }

    Some(left)
}

/// Do binary search but skip entries not having a key.
pub fn search_address_opt_key<T, V: Ord>(
    data: &[T],
    address: V,
    keyfn: &dyn Fn(&T) -> Option<V>,
) -> Option<usize> {
    let mut left = 0;
    let mut right = data.len();

    while left < right {
        let left_key = keyfn(&data[left]);
        if left_key.is_some() {
            break;
        }
        left += 1;
    }

    if left == right {
        return None;
    }

    if address < keyfn(&data[left]).unwrap() {
        return None;
    }

    while (left + 1) < right {
        let mut v = (left + right) / 2;

        let v_saved = v;
        // Skip entries not having a key
        while v < right {
            let key = keyfn(&data[v]);
            if key.is_some() {
                break;
            }
            v += 1;
        }
        // All entries at the right side haven't keys.
        // Shrink to the left side.
        if v == right {
            right = v_saved;
            continue;
        }

        let key = keyfn(&data[v]).unwrap();

        if key == address {
            return Some(v);
        }
        if address < key {
            right = v;
        } else {
            left = v;
        }
    }

    Some(left)
}

pub fn extract_string(raw: &[u8], off: usize) -> Option<&str> {
    let mut end = off;

    if off >= raw.len() {
        return None;
    }
    while raw[end] != 0 {
        end += 1;
    }
    let blk = raw[off..end].as_ptr() as *mut u8;
    let r = unsafe { String::from_raw_parts(blk, end - off, end - off) };
    let ret = Some(unsafe { &*(r.as_str() as *const str) }); // eliminate lifetime
    r.into_bytes().leak();
    ret
}

#[allow(dead_code)]
pub struct LinuxMapsEntry {
    pub loaded_address: u64,
    pub end_address: u64,
    pub mode: u8,
    pub offset: u64,
    pub path: String,
}

#[allow(dead_code)]
pub fn parse_maps(pid: u32) -> Result<Vec<LinuxMapsEntry>, Error> {
    let mut entries = Vec::<LinuxMapsEntry>::new();
    let file_name = if pid == 0 {
        String::from("/proc/self/maps")
    } else {
        format!("/proc/{}/maps", pid)
    };
    let file = fs::File::open(file_name)?;
    let mut reader = BufReader::new(file);
    let mut line = String::new();
    let re_ptn = Regex::new(
        r"^([0-9a-f]+)-([0-9a-f]+) ([rwxp\\-]+) ([0-9a-f]+) [0-9a-f]+:[0-9a-f]+ [0-9]+ *((/[^/]+)+)$",
    );
    if re_ptn.is_err() {
        println!("{:?}", re_ptn);
        return Err(Error::new(ErrorKind::InvalidData, "Failed to build regex"));
    }
    let re_ptn = re_ptn.unwrap();

    while reader.read_line(&mut line)? > 0 {
        if let Some(caps) = re_ptn.captures(&line) {
            let loaded_address_str = caps.get(1).unwrap().as_str();
            let loaded_address = u64::from_str_radix(loaded_address_str, 16).unwrap();

            let end_address_str = caps.get(2).unwrap().as_str();
            let end_address = u64::from_str_radix(end_address_str, 16).unwrap();

            let mode_str = caps.get(3).unwrap().as_str();
            let mut mode = 0;
            for c in mode_str.chars() {
                mode = (mode << 1) | {
                    if c == '-' {
                        0
                    } else {
                        1
                    }
                };
            }

            let offset = u64::from_str_radix(caps.get(4).unwrap().as_str(), 16).unwrap();
            let path = caps.get(5).unwrap().as_str().strip_suffix('\n').unwrap();
            let mut path_str = path.to_string();
            if let Some(pos) = path.rfind(" (deleted)") {
                if pos == path.len() - " (deleted)".len() {
                    path_str = format!(
                        "/proc/{}/map_files/{:x}-{:x}",
                        pid, loaded_address, end_address
                    );
                }
            }

            let entry = LinuxMapsEntry {
                loaded_address,
                end_address,
                mode,
                offset,
                path: path_str,
            };
            entries.push(entry);
        }
        line.clear();
    }

    Ok(entries)
}
