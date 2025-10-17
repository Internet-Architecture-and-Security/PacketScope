use super::elf::Elf64Parser;
use super::tools::search_address_key;

use std::io::{Error, ErrorKind};
use std::mem;
use std::rc::Rc;

#[cfg(test)]
use std::env;

fn decode_leb128(data: &[u8]) -> Option<(u64, u8)> {
    let mut sz = 0;
    let mut v: u64 = 0;
    for c in data {
        v |= ((c & 0x7f) as u64) << sz;
        sz += 7;
        if (c & 0x80) == 0 {
            return Some((v, sz / 7));
        }
    }
    None
}

fn decode_leb128_s(data: &[u8]) -> Option<(i64, u8)> {
    if let Some((v, s)) = decode_leb128(data) {
        let s_mask: u64 = 1 << (s * 7 - 1);
        return if (v & s_mask) != 0 {
            // negative
            Some(((v as i64) - ((s_mask << 1) as i64), s))
        } else {
            Some((v as i64, s))
        };
    }
    None
}

#[inline(always)]
fn decode_uhalf(data: &[u8]) -> u16 {
    (data[0] as u16) | ((data[1] as u16) << 8)
}

#[allow(dead_code)]
#[inline(always)]
fn decode_shalf(data: &[u8]) -> i16 {
    let uh = decode_uhalf(data);
    if uh >= 0x8000 {
        ((uh as i32) - 0x10000) as i16
    } else {
        uh as i16
    }
}

#[inline(always)]
fn decode_uword(data: &[u8]) -> u32 {
    (data[0] as u32) | ((data[1] as u32) << 8) | ((data[2] as u32) << 16) | ((data[3] as u32) << 24)
}

#[allow(dead_code)]
#[inline(always)]
fn decode_sword(data: &[u8]) -> i32 {
    let uw = decode_uword(data);
    if uw >= 0x80000000 {
        ((uw as i64) - 0x100000000) as i32
    } else {
        uw as i32
    }
}

#[inline(always)]
fn decode_udword(data: &[u8]) -> u64 {
    decode_uword(data) as u64 | ((decode_uword(&data[4..]) as u64) << 32)
}

#[allow(dead_code)]
#[inline(always)]
fn decode_swdord(data: &[u8]) -> i64 {
    let udw = decode_udword(data);
    if udw >= 0x8000000000000000 {
        ((udw as i128) - 0x10000000000000000) as i64
    } else {
        udw as i64
    }
}

pub struct ArangesCU {
    pub debug_line_off: usize,
    pub aranges: Vec<(u64, u64)>,
}

fn parse_aranges_cu(data: &[u8]) -> Result<(ArangesCU, usize), Error> {
    if data.len() < 12 {
        return Err(Error::new(
            ErrorKind::InvalidData,
            "invalid arange header (too small)",
        ));
    }
    let len = decode_uword(data);
    let version = decode_uhalf(&data[4..]);
    let offset = decode_uword(&data[6..]);
    let addr_sz = data[10];
    let _seg_sz = data[11];

    if data.len() < (len + 4) as usize {
        return Err(Error::new(
            ErrorKind::InvalidData,
            "data is broken (too small)",
        ));
    }

    // Size of the header
    let mut pos = 12;

    // Padding to align with the size of addresses on the target system.
    pos += addr_sz as usize - 1;
    pos -= pos % addr_sz as usize;

    let mut aranges = Vec::<(u64, u64)>::new();
    match addr_sz {
        4 => {
            while pos < (len + 4 - 8) as usize {
                let start = decode_uword(&data[pos..]);
                pos += 4;
                let size = decode_uword(&data[pos..]);
                pos += 4;

                if start == 0 && size == 0 {
                    break;
                }
                aranges.push((start as u64, size as u64));
            }
        }
        8 => {
            while pos < (len + 4 - 16) as usize {
                let start = decode_udword(&data[pos..]);
                pos += 8;
                let size = decode_udword(&data[pos..]);
                pos += 8;

                if start == 0 && size == 0 {
                    break;
                }
                aranges.push((start, size));
            }
        }
        _ => {
            return Err(Error::new(
                ErrorKind::Unsupported,
                format!(
                    "unsupported address size {} ver {} off 0x{:x}",
                    addr_sz, version, offset
                ),
            ));
        }
    }

    Ok((
        ArangesCU {
            debug_line_off: offset as usize,
            aranges,
        },
        len as usize + 4,
    ))
}

fn parse_aranges_elf_parser(parser: &Elf64Parser) -> Result<Vec<ArangesCU>, Error> {
    let debug_aranges_idx = parser.find_section(".debug_aranges")?;

    let raw_data = parser.read_section_raw(debug_aranges_idx)?;

    let mut pos = 0;
    let mut acus = Vec::<ArangesCU>::new();
    while pos < raw_data.len() {
        let (acu, bytes) = parse_aranges_cu(&raw_data[pos..])?;
        acus.push(acu);
        pos += bytes;
    }

    Ok(acus)
}

pub fn parse_aranges_elf(filename: &str) -> Result<Vec<ArangesCU>, Error> {
    let parser = Elf64Parser::open(filename)?;
    parse_aranges_elf_parser(&parser)
}

#[repr(packed)]
struct DebugLinePrologueV2 {
    total_length: u32,
    version: u16,
    prologue_length: u32,
    minimum_instruction_length: u8,
    default_is_stmt: u8,
    line_base: i8,
    line_range: u8,
    opcode_base: u8,
}

/// DebugLinePrologue is actually a V4.
///
/// DebugLinePrologueV2 will be converted to this type.
#[allow(dead_code)]
#[repr(packed)]
struct DebugLinePrologue {
    total_length: u32,
    version: u16,
    prologue_length: u32,
    minimum_instruction_length: u8,
    maximum_ops_per_instruction: u8,
    default_is_stmt: u8,
    line_base: i8,
    line_range: u8,
    opcode_base: u8,
}

/// The file information of a file for a CU.
struct DebugLineFileInfo {
    name: String,
    dir_idx: u32, // Index to include_directories of DebugLineCU.
    #[allow(dead_code)]
    mod_tm: u64,
    #[allow(dead_code)]
    size: usize,
}

/// Represent a Compile Unit (CU) in a .debug_line section.
struct DebugLineCU {
    prologue: DebugLinePrologue,
    #[allow(dead_code)]
    standard_opcode_lengths: Vec<u8>,
    include_directories: Vec<String>,
    files: Vec<DebugLineFileInfo>,
    matrix: Vec<DebugLineStates>,
}

impl DebugLineCU {
    fn find_line(&self, address: u64) -> Option<(&str, &str, usize)> {
        let idx = search_address_key(&self.matrix, address, &|x: &DebugLineStates| -> u64 {
            x.address
        })?;

        let states = &self.matrix[idx];
        if states.end_sequence {
            // This is the first byte after the last instruction
            return None;
        }

        self.stringify_row(idx as usize)
    }

    fn stringify_row(&self, idx: usize) -> Option<(&str, &str, usize)> {
        let states = &self.matrix[idx];
        let (dir, file) = {
            if states.file > 0 {
                let file = &self.files[states.file - 1];
                let dir = {
                    if file.dir_idx == 0 {
                        ""
                    } else {
                        self.include_directories[file.dir_idx as usize - 1].as_str()
                    }
                };
                (dir, file.name.as_str())
            } else {
                ("", "")
            }
        };

        Some((dir, file, states.line as usize))
    }
}

/// Parse the list of directory paths for a CU.
fn parse_debug_line_dirs(data_buf: &[u8]) -> Result<(Vec<String>, usize), Error> {
    let mut strs = Vec::<String>::new();
    let mut pos = 0;

    while pos < data_buf.len() {
        if data_buf[pos] == 0 {
            return Ok((strs, pos + 1));
        }

        // Find NULL byte
        let mut end = pos;
        while end < data_buf.len() && data_buf[end] != 0 {
            end += 1;
        }
        if end < data_buf.len() {
            let mut str_vec = Vec::<u8>::with_capacity(end - pos);
            str_vec.extend_from_slice(&data_buf[pos..end]);

            let str_r = String::from_utf8(str_vec);
            if str_r.is_err() {
                return Err(Error::new(ErrorKind::InvalidData, "Invalid UTF-8 string"));
            }

            strs.push(str_r.unwrap());
            end += 1;
        }
        pos = end;
    }

    Err(Error::new(
        ErrorKind::InvalidData,
        "Do not found null string",
    ))
}

/// Parse the list of file information for a CU.
fn parse_debug_line_files(data_buf: &[u8]) -> Result<(Vec<DebugLineFileInfo>, usize), Error> {
    let mut strs = Vec::<DebugLineFileInfo>::new();
    let mut pos = 0;

    while pos < data_buf.len() {
        if data_buf[pos] == 0 {
            return Ok((strs, pos + 1));
        }

        // Find NULL byte
        let mut end = pos;
        while end < data_buf.len() && data_buf[end] != 0 {
            end += 1;
        }
        if end < data_buf.len() {
            // Null terminated file name string
            let mut str_vec = Vec::<u8>::with_capacity(end - pos);
            str_vec.extend_from_slice(&data_buf[pos..end]);

            let str_r = String::from_utf8(str_vec);
            if str_r.is_err() {
                return Err(Error::new(ErrorKind::InvalidData, "Invalid UTF-8 string"));
            }
            end += 1;

            // LEB128 directory index
            let dir_idx_r = decode_leb128(&data_buf[end..]);
            if dir_idx_r.is_none() {
                return Err(Error::new(
                    ErrorKind::InvalidData,
                    "Invliad directory index",
                ));
            }
            let (dir_idx, bytes) = dir_idx_r.unwrap();
            end += bytes as usize;

            // LEB128 last modified time
            let mod_tm_r = decode_leb128(&data_buf[end..]);
            if mod_tm_r.is_none() {
                return Err(Error::new(
                    ErrorKind::InvalidData,
                    "Invalid last modified time",
                ));
            }
            let (mod_tm, bytes) = mod_tm_r.unwrap();
            end += bytes as usize;

            // LEB128 file size
            let flen_r = decode_leb128(&data_buf[end..]);
            if flen_r.is_none() {
                return Err(Error::new(ErrorKind::InvalidData, "Invalid file size"));
            }
            let (flen, bytes) = flen_r.unwrap();
            end += bytes as usize;

            strs.push(DebugLineFileInfo {
                name: str_r.unwrap(),
                dir_idx: dir_idx as u32,
                mod_tm,
                size: flen as usize,
            });
        }
        pos = end;
    }

    Err(Error::new(
        ErrorKind::InvalidData,
        "Do not found null string",
    ))
}

fn parse_debug_line_cu(
    parser: &Elf64Parser,
    addresses: &[u64],
    reused_buf: &mut Vec<u8>,
) -> Result<DebugLineCU, Error> {
    let mut prologue_sz: usize = mem::size_of::<DebugLinePrologueV2>();
    let prologue_v4_sz: usize = mem::size_of::<DebugLinePrologue>();
    let buf = reused_buf;

    buf.resize(prologue_sz, 0);
    let prologue = unsafe {
        parser.read_raw(buf.as_mut_slice())?;
        let prologue_raw = buf.as_mut_ptr() as *mut DebugLinePrologueV2;
        let v2 = Box::<DebugLinePrologueV2>::from_raw(prologue_raw);

        if v2.version != 0x2 && v2.version != 0x4 {
            let version = v2.version;
            Box::leak(v2);
            return Err(Error::new(
                ErrorKind::Unsupported,
                format!("Support DWARF version 2 & 4 (version: {})", version),
            ));
        }

        if v2.version == 0x4 {
            // Upgrade to V4.
            // V4 has more fields to read.
            Box::leak(v2);
            buf.resize(prologue_v4_sz, 0);
            parser.read_raw(&mut buf.as_mut_slice()[prologue_sz..])?;
            let prologue_raw = buf.as_mut_ptr() as *mut DebugLinePrologue;
            let v4 = Box::<DebugLinePrologue>::from_raw(prologue_raw);
            prologue_sz = prologue_v4_sz;
            let prologue_v4 = DebugLinePrologue { ..(*v4) };
            Box::leak(v4);
            prologue_v4
        } else {
            // Convert V2 to V4
            let prologue_v4 = DebugLinePrologue {
                total_length: v2.total_length,
                version: v2.version,
                prologue_length: v2.prologue_length,
                minimum_instruction_length: v2.minimum_instruction_length,
                maximum_ops_per_instruction: 0,
                default_is_stmt: v2.default_is_stmt,
                line_base: v2.line_base,
                line_range: v2.line_range,
                opcode_base: v2.opcode_base,
            };
            Box::leak(v2);
            prologue_v4
        }
    };

    let to_read = prologue.total_length as usize + 4 - prologue_sz;
    let data_buf = buf;
    if to_read <= data_buf.capacity() {
        // Gain better performance by skipping initialization.
        unsafe { data_buf.set_len(to_read) };
    } else {
        data_buf.resize(to_read, 0);
    }
    unsafe { parser.read_raw(data_buf.as_mut_slice())? };

    let mut pos = 0;

    let std_op_num = (prologue.opcode_base - 1) as usize;
    let mut std_op_lengths = Vec::<u8>::with_capacity(std_op_num);
    std_op_lengths.extend_from_slice(&data_buf[pos..pos + std_op_num]);
    pos += std_op_num;

    let (inc_dirs, bytes) = parse_debug_line_dirs(&data_buf[pos..])?;
    pos += bytes;

    let (files, bytes) = parse_debug_line_files(&data_buf[pos..])?;
    pos += bytes;

    let matrix = run_debug_line_stmts(&data_buf[pos..], &prologue, addresses)?;

    #[cfg(debug_assertions)]
    for i in 1..matrix.len() {
        if matrix[i].address < matrix[i - 1].address && !matrix[i - 1].end_sequence {
            panic!(
                "Not in ascent order @ [{}] {:?} [{}] {:?}",
                i - 1,
                matrix[i - 1],
                i,
                matrix[i]
            );
        }
    }

    Ok(DebugLineCU {
        prologue,
        standard_opcode_lengths: std_op_lengths,
        include_directories: inc_dirs,
        files,
        matrix,
    })
}

#[derive(Clone, Debug)]
struct DebugLineStates {
    address: u64,
    file: usize,
    line: usize,
    column: usize,
    discriminator: u64,
    is_stmt: bool,
    basic_block: bool,
    end_sequence: bool,
    prologue_end: bool,
    should_reset: bool,
}

impl DebugLineStates {
    fn new(prologue: &DebugLinePrologue) -> DebugLineStates {
        DebugLineStates {
            address: 0,
            file: 1,
            line: 1,
            column: 0,
            discriminator: 0,
            is_stmt: prologue.default_is_stmt != 0,
            basic_block: false,
            end_sequence: false,
            prologue_end: false,
            should_reset: false,
        }
    }

    fn reset(&mut self, prologue: &DebugLinePrologue) {
        self.address = 0;
        self.file = 1;
        self.line = 1;
        self.column = 0;
        self.discriminator = 0;
        self.is_stmt = prologue.default_is_stmt != 0;
        self.basic_block = false;
        self.end_sequence = false;
        self.prologue_end = false;
        self.should_reset = false;
    }
}

/// Return `Ok((insn_bytes, emit))` if success.  `insn_bytes1 is the
/// size of the instruction at the position given by ip.  `emit` is
/// true if this instruction emit a new row to describe line
/// information of an address.  Not every instructions emit rows.
/// Some instructions create only intermediate states for the next row
/// going to emit.
fn run_debug_line_stmt(
    stmts: &[u8],
    prologue: &DebugLinePrologue,
    ip: usize,
    states: &mut DebugLineStates,
) -> Result<(usize, bool), Error> {
    // Standard opcodes
    const DW_LNS_EXT: u8 = 0;
    const DW_LNS_COPY: u8 = 1;
    const DW_LNS_ADVANCE_PC: u8 = 2;
    const DW_LNS_ADVANCE_LINE: u8 = 3;
    const DW_LNS_SET_FILE: u8 = 4;
    const DW_LNS_SET_COLUMN: u8 = 5;
    const DW_LNS_NEGATE_STMT: u8 = 6;
    const DW_LNS_SET_BASIC_BLOCK: u8 = 7;
    const DW_LNS_CONST_ADD_PC: u8 = 8;
    const DW_LNS_FIXED_ADVANCE_PC: u8 = 9;
    const DW_LNS_SET_PROLOGUE_END: u8 = 10;

    // Extended opcodes
    const DW_LINE_END_SEQUENCE: u8 = 1;
    const DW_LINE_SET_ADDRESS: u8 = 2;
    const DW_LINE_DEFINE_FILE: u8 = 3;
    const DW_LINE_SET_DISCRIMINATOR: u8 = 4;

    let opcode_base = prologue.opcode_base;
    let opcode = stmts[ip];

    match opcode {
        DW_LNS_EXT => {
            // Extended opcodes
            if let Some((insn_size, bytes)) = decode_leb128(&stmts[(ip + 1)..]) {
                if insn_size < 1 {
                    return Err(Error::new(
                        ErrorKind::InvalidData,
                        format!(
                            "invalid extended opcode (ip=0x{:x}, insn_size=0x{:x}",
                            ip, insn_size
                        ),
                    ));
                }
                let ext_opcode = stmts[ip + 1 + bytes as usize];
                match ext_opcode {
                    DW_LINE_END_SEQUENCE => {
                        states.end_sequence = true;
                        states.should_reset = true;
                        Ok((1 + bytes as usize + insn_size as usize, true))
                    }
                    DW_LINE_SET_ADDRESS => match insn_size - 1 {
                        4 => {
                            let address = decode_uword(&stmts[(ip + 1 + bytes as usize + 1)..]);
                            states.address = address as u64;
                            Ok((1 + bytes as usize + insn_size as usize, false))
                        }
                        8 => {
                            let address = decode_udword(&stmts[(ip + 1 + bytes as usize + 1)..]);
                            states.address = address;
                            Ok((1 + bytes as usize + insn_size as usize, false))
                        }
                        _ => Err(Error::new(
                            ErrorKind::Unsupported,
                            format!("unsupported address size ({})", insn_size),
                        )),
                    },
                    DW_LINE_DEFINE_FILE => Err(Error::new(
                        ErrorKind::Unsupported,
                        "DW_LINE_define_file is not supported yet",
                    )),
                    DW_LINE_SET_DISCRIMINATOR => {
                        if let Some((discriminator, discr_bytes)) =
                            decode_leb128(&stmts[(ip + 1 + bytes as usize + 1)..])
                        {
                            if discr_bytes as u64 + 1 == insn_size {
                                states.discriminator = discriminator;
                                Ok((1 + bytes as usize + insn_size as usize, false))
                            } else {
                                Err(Error::new(
                                    ErrorKind::InvalidData,
                                    "unmatched instruction size for DW_LINE_set_discriminator",
                                ))
                            }
                        } else {
                            Err(Error::new(
                                ErrorKind::InvalidData,
                                "discriminator is broken",
                            ))
                        }
                    }
                    _ => Err(Error::new(
                        ErrorKind::Unsupported,
                        format!(
                            "invalid extended opcode (ip=0x{:x}, ext_opcode=0x{:x})",
                            ip, ext_opcode
                        ),
                    )),
                }
            } else {
                Err(Error::new(
                    ErrorKind::InvalidData,
                    format!("invalid extended opcode (ip=0x{:x})", ip),
                ))
            }
        }
        DW_LNS_COPY => Ok((1, true)),
        DW_LNS_ADVANCE_PC => {
            if let Some((adv, bytes)) = decode_leb128(&stmts[(ip + 1)..]) {
                states.address += adv * prologue.minimum_instruction_length as u64;
                Ok((1 + bytes as usize, false))
            } else {
                Err(Error::new(
                    ErrorKind::InvalidData,
                    "the operand of advance_pc is broken",
                ))
            }
        }
        DW_LNS_ADVANCE_LINE => {
            if let Some((adv, bytes)) = decode_leb128_s(&stmts[(ip + 1)..]) {
                states.line = (states.line as i64 + adv) as usize;
                Ok((1 + bytes as usize, false))
            } else {
                Err(Error::new(
                    ErrorKind::InvalidData,
                    "the operand of advance_line is broken",
                ))
            }
        }
        DW_LNS_SET_FILE => {
            if let Some((file_idx, bytes)) = decode_leb128(&stmts[(ip + 1)..]) {
                states.file = file_idx as usize;
                Ok((1 + bytes as usize, false))
            } else {
                Err(Error::new(
                    ErrorKind::InvalidData,
                    "the operand of set_file is broken",
                ))
            }
        }
        DW_LNS_SET_COLUMN => {
            if let Some((column, bytes)) = decode_leb128(&stmts[(ip + 1)..]) {
                states.column = column as usize;
                Ok((1 + bytes as usize, false))
            } else {
                Err(Error::new(
                    ErrorKind::InvalidData,
                    "the operand of set_column is broken",
                ))
            }
        }
        DW_LNS_NEGATE_STMT => {
            states.is_stmt = !states.is_stmt;
            Ok((1, false))
        }
        DW_LNS_SET_BASIC_BLOCK => {
            states.basic_block = true;
            Ok((1, false))
        }
        DW_LNS_CONST_ADD_PC => {
            let addr_adv = (255 - opcode_base) / prologue.line_range;
            states.address += addr_adv as u64 * prologue.minimum_instruction_length as u64;
            Ok((1, false))
        }
        DW_LNS_FIXED_ADVANCE_PC => {
            if (ip + 3) < stmts.len() {
                let addr_adv = decode_uhalf(&stmts[(ip + 1)..]);
                states.address += addr_adv as u64 * prologue.minimum_instruction_length as u64;
                Ok((1, false))
            } else {
                Err(Error::new(
                    ErrorKind::InvalidData,
                    "the operand of fixed_advance_pc is broken",
                ))
            }
        }
        DW_LNS_SET_PROLOGUE_END => {
            states.prologue_end = true;
            Ok((1, false))
        }
        _ => {
            // Special opcodes
            let desired_line_incr = (opcode - opcode_base) % prologue.line_range;
            let addr_adv = (opcode - opcode_base) / prologue.line_range;
            states.address += addr_adv as u64 * prologue.minimum_instruction_length as u64;
            states.line = (states.line as i64
                + (desired_line_incr as i16 + prologue.line_base as i16) as i64
                    * prologue.minimum_instruction_length as i64)
                as usize;
            Ok((1, true))
        }
    }
}

fn run_debug_line_stmts(
    stmts: &[u8],
    prologue: &DebugLinePrologue,
    addresses: &[u64],
) -> Result<Vec<DebugLineStates>, Error> {
    let mut ip = 0;
    let mut matrix = Vec::<DebugLineStates>::new();
    let mut should_sort = false;
    let mut states_cur = DebugLineStates::new(prologue);
    let mut states_last = states_cur.clone();
    let mut last_ip_pushed = false;
    let mut force_no_emit = false;

    while ip < stmts.len() {
        match run_debug_line_stmt(stmts, prologue, ip, &mut states_cur) {
            Ok((sz, emit)) => {
                ip += sz;
                if emit {
                    if states_cur.address == 0 {
                        // This is a speical case. Somehow, rust
                        // compiler generate debug_line for some
                        // builtin code starting from 0.  And, it
                        // causes incorrect behavior.
                        force_no_emit = true;
                    }
                    if !force_no_emit {
                        if !addresses.is_empty() {
                            let mut pushed = false;
                            for addr in addresses {
                                if *addr == states_cur.address
                                    || (states_last.address != 0
                                        && !states_last.end_sequence
                                        && *addr < states_cur.address
                                        && *addr > states_last.address as u64)
                                {
                                    if !last_ip_pushed && *addr != states_cur.address {
                                        // The address falls between current and last emitted row.
                                        matrix.push(states_last.clone());
                                    }
                                    matrix.push(states_cur.clone());
                                    pushed = true;
                                    break;
                                }
                            }
                            last_ip_pushed = pushed;
                            states_last = states_cur.clone();
                        } else {
                            matrix.push(states_cur.clone());
                        }
                        if states_last.address > states_cur.address {
                            should_sort = true;
                        }
                    }
                }
                if states_cur.should_reset {
                    states_cur.reset(prologue);
                    force_no_emit = false;
                }
            }
            Err(e) => {
                return Err(e);
            }
        }
    }

    if should_sort {
        matrix.sort_by_key(|x| x.address);
    }

    Ok(matrix)
}

/// If addresses is empty, it return a full version of debug_line matrics.
/// If addresses is not empty, return only data needed to resolve given addresses .
fn parse_debug_line_elf_parser(
    parser: &Elf64Parser,
    addresses: &[u64],
) -> Result<Vec<DebugLineCU>, Error> {
    let debug_line_idx = parser.find_section(".debug_line")?;
    let debug_line_sz = parser.get_section_size(debug_line_idx)?;
    let mut remain_sz = debug_line_sz;
    let prologue_size: usize = mem::size_of::<DebugLinePrologueV2>();
    let mut not_found = Vec::from(addresses);

    parser.section_seek(debug_line_idx)?;

    let mut all_cus = Vec::<DebugLineCU>::new();
    let mut buf = Vec::<u8>::new();
    while remain_sz > prologue_size {
        let debug_line_cu = parse_debug_line_cu(parser, &not_found, &mut buf)?;
        let prologue = &debug_line_cu.prologue;
        remain_sz -= prologue.total_length as usize + 4;

        if debug_line_cu.matrix.is_empty() {
            continue;
        }

        if !addresses.is_empty() {
            let mut last_row = &debug_line_cu.matrix[0];
            for row in debug_line_cu.matrix.as_slice() {
                let mut i = 0;
                // Remove addresses found in this CU from not_found.
                while i < not_found.len() {
                    let addr = addresses[i];
                    if addr == row.address || (addr < row.address && addr > last_row.address) {
                        not_found.remove(i);
                    } else {
                        i += 1;
                    }
                }
                last_row = row;
            }

            all_cus.push(debug_line_cu);

            if not_found.is_empty() {
                return Ok(all_cus);
            }
        } else {
            all_cus.push(debug_line_cu);
        }
    }

    if remain_sz != 0 {
        return Err(Error::new(
            ErrorKind::InvalidData,
            "remain garbage data at the end",
        ));
    }

    Ok(all_cus)
}

#[allow(dead_code)]
fn parse_debug_line_elf(filename: &str) -> Result<Vec<DebugLineCU>, Error> {
    let parser = Elf64Parser::open(filename)?;
    parse_debug_line_elf_parser(&parser, &[])
}

/// DwarfResolver provide abilities to query DWARF information of binaries.
pub struct DwarfResolver {
    parser: Rc<Elf64Parser>,
    debug_line_cus: Vec<DebugLineCU>,
    addr_to_dlcu: Vec<(u64, u32)>,
}

impl DwarfResolver {
    pub fn get_parser(&self) -> &Elf64Parser {
        &*self.parser
    }

    pub fn from_parser_for_addresses(
        parser: Rc<Elf64Parser>,
        addresses: &[u64],
    ) -> Result<DwarfResolver, Error> {
        let debug_line_cus = parse_debug_line_elf_parser(&*parser, addresses)?;

        let mut addr_to_dlcu = Vec::with_capacity(debug_line_cus.len());
        for (idx, dlcu) in debug_line_cus.iter().enumerate() {
            if dlcu.matrix.is_empty() {
                continue;
            }
            let first_addr = dlcu.matrix[0].address;
            addr_to_dlcu.push((first_addr, idx as u32));
        }
        addr_to_dlcu.sort_by_key(|v| v.0);

        #[cfg(debug_assertions)]
        for i in 1..addr_to_dlcu.len() {
            if addr_to_dlcu[i].0 <= addr_to_dlcu[i - 1].0 {
                panic!(
                    "CU's start address should be in strict order: [{}] 0x{:x} [{}] 0x{:x}",
                    i - 1,
                    addr_to_dlcu[i - 1].0,
                    i,
                    addr_to_dlcu[i].0
                );
            }
        }

        Ok(DwarfResolver {
            parser,
            debug_line_cus,
            addr_to_dlcu,
        })
    }

    /// Open a binary to load .debug_line only enough for a given list of addresses.
    ///
    /// When `addresses` is not empty, the returned instance only has
    /// data that related to these addresses.  For this case, the
    /// isntance have the ability that can serve only these addresses.
    /// This would be much faster.
    ///
    /// If `addresses` is empty, the returned instance has all data
    /// from the given file.  If the instance will be used for long
    /// running, you would want to load all data into memory to have
    /// the ability of handling all possible addresses.
    pub fn open_for_addresses(filename: &str, addresses: &[u64]) -> Result<DwarfResolver, Error> {
        let parser = Elf64Parser::open(filename)?;
        Self::from_parser_for_addresses(Rc::new(parser), addresses)
    }

    /// Open a binary to load and parse .debug_line for later uses.
    ///
    /// `filename` is the name of an ELF binary/or shared object that
    /// has .debug_line section.
    pub fn open(filename: &str) -> Result<DwarfResolver, Error> {
        Self::open_for_addresses(filename, &[])
    }

    fn find_dlcu_index(&self, address: u64) -> Option<usize> {
        let a2a = &self.addr_to_dlcu;
        let a2a_idx = search_address_key(a2a, address, &|x: &(u64, u32)| -> u64 { x.0 as u64 })?;
        let dlcu_idx = a2a[a2a_idx].1 as usize;

        Some(dlcu_idx)
    }

    /// Find line information of an address.
    ///
    /// `address` is an offset from the head of the loaded binary/or
    /// shared object.  This function returns a tuple of `(dir_name, file_name, line_no)`.
    pub fn find_line_as_ref(&self, address: u64) -> Option<(&str, &str, usize)> {
        let idx = self.find_dlcu_index(address)?;
        let dlcu = &self.debug_line_cus[idx as usize];

        dlcu.find_line(address)
    }

    /// Find line information of an address.
    ///
    /// `address` is an offset from the head of the loaded binary/or
    /// shared object.  This function returns a tuple of `(dir_name, file_name, line_no)`.
    ///
    /// This function is pretty much the same as `find_line_as_ref()`
    /// except returning a copies of `String` instead of `&str`.
    pub fn find_line(&self, address: u64) -> Option<(String, String, usize)> {
        let (dir, file, line_no) = self.find_line_as_ref(address)?;
        Some((String::from(dir), String::from(file), line_no))
    }

    #[cfg(test)]
    fn pick_address_for_test(&self) -> (u64, &str, &str, usize) {
        let (addr, idx) = self.addr_to_dlcu[self.addr_to_dlcu.len() / 3];
        let dlcu = &self.debug_line_cus[idx as usize];
        let (dir, file, line) = dlcu.stringify_row(0).unwrap();
        (addr, dir, file, line)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decode_leb128() {
        let data = vec![0xf4, 0xf3, 0x75];
        let result = decode_leb128(&data);
        assert!(result.is_some());
        if let Some((v, s)) = result {
            assert_eq!(v, 0x1d79f4);
            assert_eq!(s, 3);
        }

        let result = decode_leb128_s(&data);
        assert!(result.is_some());
        if let Some((v, s)) = result {
            assert_eq!(v, -165388);
            assert_eq!(s, 3);
        }
    }

    #[test]
    fn test_decode_words() {
        let data = vec![0x7f, 0x85, 0x36, 0xf9];
        assert_eq!(decode_uhalf(&data), 0x857f);
        assert_eq!(decode_shalf(&data), -31361);
        assert_eq!(decode_uword(&data), 0xf936857f);
        assert_eq!(decode_sword(&data), -113867393);
    }

    #[test]
    fn test_parse_debug_line_elf() {
        let args: Vec<String> = env::args().collect();
        let bin_name = &args[0];

        let r = parse_debug_line_elf(bin_name);
        if r.is_err() {
            println!("{:?}", r.as_ref().err().unwrap());
        }
        assert!(r.is_ok());
    }

    #[test]
    fn test_run_debug_line_stmts_1() {
        let stmts = [
            0x00, 0x09, 0x02, 0x30, 0x8b, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xa0, 0x04,
            0x01, 0x05, 0x06, 0x0a, 0x08, 0x30, 0x02, 0x05, 0x00, 0x01, 0x01,
        ];
        let prologue = DebugLinePrologue {
            total_length: 0,
            version: 4,
            prologue_length: 0,
            minimum_instruction_length: 1,
            maximum_ops_per_instruction: 1,
            default_is_stmt: 1,
            line_base: -5,
            line_range: 14,
            opcode_base: 13,
        };

        let result = run_debug_line_stmts(&stmts, &prologue, &[]);
        if result.is_err() {
            let e = result.as_ref().err().unwrap();
            println!("result {:?}", e);
        }
        assert!(result.is_ok());
        let matrix = result.unwrap();
        assert_eq!(matrix.len(), 3);
        assert_eq!(matrix[0].line, 545);
        assert_eq!(matrix[0].address, 0x18b30);
        assert_eq!(matrix[1].line, 547);
        assert_eq!(matrix[1].address, 0x18b43);
        assert_eq!(matrix[2].line, 547);
        assert_eq!(matrix[2].address, 0x18b48);
    }

    #[test]
    fn test_run_debug_line_stmts_2() {
        //	File name                            Line number    Starting address    View    Stmt
        //	    methods.rs                                   789             0x18c70               x
        //	    methods.rs                                   791             0x18c7c               x
        //	    methods.rs                                   791             0x18c81
        //	    methods.rs                                   790             0x18c86               x
        //	    methods.rs                                     0             0x18c88
        //	    methods.rs                                   791             0x18c8c               x
        //	    methods.rs                                     0             0x18c95
        //	    methods.rs                                   792             0x18c99               x
        //	    methods.rs                                   792             0x18c9d
        //	    methods.rs                                     0             0x18ca4
        //	    methods.rs                                   791             0x18ca8               x
        //	    methods.rs                                   792             0x18caf               x
        //	    methods.rs                                     0             0x18cb6
        //	    methods.rs                                   792             0x18cba
        //	    methods.rs                                     0             0x18cc4
        //	    methods.rs                                   792             0x18cc8
        //	    methods.rs                                   790             0x18cce               x
        //	    methods.rs                                   794             0x18cd0               x
        //	    methods.rs                                   794             0x18cde               x
        let stmts = [
            0x00, 0x09, 0x02, 0x70, 0x8c, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x94, 0x06,
            0x01, 0x05, 0x0d, 0x0a, 0xbc, 0x05, 0x26, 0x06, 0x58, 0x05, 0x09, 0x06, 0x57, 0x06,
            0x03, 0xea, 0x79, 0x2e, 0x05, 0x13, 0x06, 0x03, 0x97, 0x06, 0x4a, 0x06, 0x03, 0xe9,
            0x79, 0x90, 0x05, 0x0d, 0x06, 0x03, 0x98, 0x06, 0x4a, 0x05, 0x12, 0x06, 0x4a, 0x03,
            0xe8, 0x79, 0x74, 0x05, 0x13, 0x06, 0x03, 0x97, 0x06, 0x4a, 0x05, 0x12, 0x75, 0x06,
            0x03, 0xe8, 0x79, 0x74, 0x05, 0x20, 0x03, 0x98, 0x06, 0x4a, 0x03, 0xe8, 0x79, 0x9e,
            0x05, 0x12, 0x03, 0x98, 0x06, 0x4a, 0x05, 0x09, 0x06, 0x64, 0x05, 0x06, 0x32, 0x02,
            0x0e, 0x00, 0x01, 0x01,
        ];
        let prologue = DebugLinePrologue {
            total_length: 0,
            version: 4,
            prologue_length: 0,
            minimum_instruction_length: 1,
            maximum_ops_per_instruction: 1,
            default_is_stmt: 1,
            line_base: -5,
            line_range: 14,
            opcode_base: 13,
        };

        let result = run_debug_line_stmts(&stmts, &prologue, &[]);
        if result.is_err() {
            let e = result.as_ref().err().unwrap();
            println!("result {:?}", e);
        }
        assert!(result.is_ok());
        let matrix = result.unwrap();

        assert_eq!(matrix.len(), 19);
        assert_eq!(matrix[0].line, 789);
        assert_eq!(matrix[0].address, 0x18c70);
        assert_eq!(matrix[0].is_stmt, true);

        assert_eq!(matrix[1].line, 791);
        assert_eq!(matrix[1].address, 0x18c7c);
        assert_eq!(matrix[1].is_stmt, true);

        assert_eq!(matrix[2].line, 791);
        assert_eq!(matrix[2].address, 0x18c81);
        assert_eq!(matrix[2].is_stmt, false);

        assert_eq!(matrix[13].line, 792);
        assert_eq!(matrix[13].address, 0x18cba);
        assert_eq!(matrix[13].is_stmt, false);

        assert_eq!(matrix[14].line, 0);
        assert_eq!(matrix[14].address, 0x18cc4);
        assert_eq!(matrix[14].is_stmt, false);

        assert_eq!(matrix[18].line, 794);
        assert_eq!(matrix[18].address, 0x18cde);
        assert_eq!(matrix[18].is_stmt, true);
    }

    #[test]
    fn test_parse_aranges_elf() {
        let args: Vec<String> = env::args().collect();
        let bin_name = &args[0];

        let r = parse_aranges_elf(bin_name);
        if r.is_err() {
            println!("{:?}", r.as_ref().err().unwrap());
        }
        assert!(r.is_ok());
        let _acus = r.unwrap();
    }

    #[test]
    fn test_dwarf_resolver() {
        let args: Vec<String> = env::args().collect();
        let bin_name = &args[0];
        let resolver_r = DwarfResolver::open(bin_name);
        assert!(resolver_r.is_ok());
        let resolver = resolver_r.unwrap();
        let (addr, dir, file, line) = resolver.pick_address_for_test();

        let line_info = resolver.find_line(addr);
        assert!(line_info.is_some());
        let (dir_ret, file_ret, line_ret) = line_info.unwrap();
        println!("{}/{} {}", dir_ret, file_ret, line_ret);
        assert_eq!(dir, dir_ret);
        assert_eq!(file, file_ret);
        assert_eq!(line, line_ret);
    }
}
