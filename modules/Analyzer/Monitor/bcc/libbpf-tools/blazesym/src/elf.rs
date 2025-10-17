use std::borrow::BorrowMut;
use std::cmp::Ordering;
use std::fs::File;
use std::io::{Error, ErrorKind, Read, Seek, SeekFrom};
use std::mem;

use std::cell::RefCell;

use crate::tools::{extract_string, search_address_opt_key};

const EI_NIDENT: usize = 16;

#[allow(non_camel_case_types)]
type Elf64_Addr = u64;
#[allow(non_camel_case_types)]
type Elf64_Half = u16;
#[allow(non_camel_case_types)]
#[allow(dead_code)]
type Elf64_SHalf = u16;
#[allow(non_camel_case_types)]
type Elf64_Off = u64;
#[allow(non_camel_case_types)]
#[allow(dead_code)]
type Elf64_Sword = i32;
#[allow(non_camel_case_types)]
type Elf64_Word = u32;
#[allow(non_camel_case_types)]
type Elf64_Xword = u64;
#[allow(non_camel_case_types)]
type Elf64_Sxword = i64;

#[allow(dead_code)]
pub const ET_NONE: u16 = 0;
#[allow(dead_code)]
pub const ET_REL: u16 = 1;
#[allow(dead_code)]
pub const ET_EXEC: u16 = 2;
#[allow(dead_code)]
pub const ET_DYN: u16 = 3;
#[allow(dead_code)]
pub const ET_CORE: u16 = 4;
#[allow(dead_code)]
pub const ET_LOPROC: u16 = 0xff00;
#[allow(dead_code)]
pub const ET_HIPROC: u16 = 0xffff;

#[repr(C)]
struct Elf64_Ehdr {
    e_ident: [u8; EI_NIDENT], /* ELF "magic number" */
    e_type: Elf64_Half,
    e_machine: Elf64_Half,
    e_version: Elf64_Word,
    e_entry: Elf64_Addr, /* Entry point virtual address */
    e_phoff: Elf64_Off,  /* Program header table file offset */
    e_shoff: Elf64_Off,  /* Section header table file offset */
    e_flags: Elf64_Word,
    e_ehsize: Elf64_Half,
    e_phentsize: Elf64_Half,
    e_phnum: Elf64_Half,
    e_shentsize: Elf64_Half,
    e_shnum: Elf64_Half,
    e_shstrndx: Elf64_Half,
}

#[allow(dead_code)]
pub const PT_NULL: u32 = 0;
#[allow(dead_code)]
pub const PT_LOAD: u32 = 1;
#[allow(dead_code)]
pub const PT_DYNAMIC: u32 = 2;
#[allow(dead_code)]
pub const PT_INTERP: u32 = 3;
#[allow(dead_code)]
pub const PT_NOTE: u32 = 4;
#[allow(dead_code)]
pub const PT_SHLIB: u32 = 5;
#[allow(dead_code)]
pub const PT_PHDR: u32 = 6;
#[allow(dead_code)]
pub const PT_TLS: u32 = 7; /* Thread local storage segment */
#[allow(dead_code)]
pub const PT_LOOS: u32 = 0x60000000; /* OS-specific */
#[allow(dead_code)]
pub const PT_HIOS: u32 = 0x6fffffff; /* OS-specific */
#[allow(dead_code)]
pub const PT_LOPROC: u32 = 0x70000000;
#[allow(dead_code)]
pub const PT_HIPROC: u32 = 0x7fffffff;
#[allow(dead_code)]
pub const PT_GNU_EH_FRAME: u32 = 0x6474e550;
#[allow(dead_code)]
pub const PT_GNU_PROPERTY: u32 = 0x6474e553;

#[allow(dead_code)]
pub const PT_GNU_STACK: u32 = PT_LOOS + 0x474e551;

#[repr(C)]
pub struct Elf64_Phdr {
    pub p_type: Elf64_Word,
    pub p_flags: Elf64_Word,
    pub p_offset: Elf64_Off,   /* Segment file offset */
    pub p_vaddr: Elf64_Addr,   /* Segment virtual address */
    pub p_paddr: Elf64_Addr,   /* Segment physical address */
    pub p_filesz: Elf64_Xword, /* Segment size in file */
    pub p_memsz: Elf64_Xword,  /* Segment size in memory */
    pub p_align: Elf64_Xword,  /* Segment alignment, file & memory */
}

#[allow(dead_code)]
pub const PF_X: Elf64_Word = 1;
#[allow(dead_code)]
pub const PF_W: Elf64_Word = 2;
#[allow(dead_code)]
pub const PF_R: Elf64_Word = 4;

#[repr(C)]
struct Elf64_Shdr {
    sh_name: Elf64_Word,       /* Section name, index in string tbl */
    sh_type: Elf64_Word,       /* Type of section */
    sh_flags: Elf64_Xword,     /* Miscellaneous section attributes */
    sh_addr: Elf64_Addr,       /* Section virtual addr at execution */
    sh_offset: Elf64_Off,      /* Section file offset */
    sh_size: Elf64_Xword,      /* Size of section in bytes */
    sh_link: Elf64_Word,       /* Index of another section */
    sh_info: Elf64_Word,       /* Additional section information */
    sh_addralign: Elf64_Xword, /* Section alignment */
    sh_entsize: Elf64_Xword,   /* Entry size if section holds table */
}

pub const SHN_UNDEF: u16 = 0;

#[allow(dead_code)]
pub const STT_NOTYPE: u8 = 0;
#[allow(dead_code)]
pub const STT_OBJECT: u8 = 1;
#[allow(dead_code)]
pub const STT_FUNC: u8 = 2;

#[derive(Clone)]
#[repr(C)]
pub struct Elf64_Sym {
    st_name: Elf64_Word,  /* Symbol name, index in string tbl */
    st_info: u8,          /* Type and binding attributes */
    st_other: u8,         /* No defined meaning, 0 */
    st_shndx: Elf64_Half, /* Associated section index */
    st_value: Elf64_Addr, /* Value of the symbol */
    st_size: Elf64_Xword, /* Associated symbol size */
}

#[allow(dead_code)]
impl Elf64_Sym {
    fn get_type(&self) -> u8 {
        self.st_info & 0xf
    }

    fn is_undef(&self) -> bool {
        self.st_shndx == SHN_UNDEF
    }
}

#[allow(dead_code)]
#[repr(C)]
struct Elf64_Rel {
    r_offset: Elf64_Addr, /* Location at which to apply the action */
    r_info: Elf64_Xword,  /* index and type of relocation */
}

#[allow(dead_code)]
#[repr(C)]
struct Elf64_Rela {
    r_offset: Elf64_Addr,   /* Location at which to apply the action */
    r_info: Elf64_Xword,    /* index and type of relocation */
    r_addend: Elf64_Sxword, /* Constant addend used to compute value */
}

#[allow(dead_code)]
#[repr(C)]
union Elf64_Dyn_un {
    d_val: Elf64_Xword,
    d_ptr: Elf64_Addr,
}

#[allow(dead_code)]
#[repr(C)]
struct Elf64_Dyn {
    d_tag: Elf64_Sxword, /* entry tag value */
    d_un: Elf64_Dyn_un,
}

fn read_u8(file: &mut File, off: u64, size: usize) -> Result<Vec<u8>, Error> {
    let mut buf = vec![0; size];

    file.seek(SeekFrom::Start(off))?;
    file.read_exact(buf.as_mut_slice())?;

    Ok(buf)
}

fn read_elf_header(file: &mut File) -> Result<Elf64_Ehdr, Error> {
    const DSZ: usize = mem::size_of::<Elf64_Ehdr>();
    let mut buf = Box::new([0_u8; DSZ]);

    let buf_m: &mut [u8; DSZ] = buf.borrow_mut();
    file.read_exact(buf_m)?;

    let ehdr: Box<Elf64_Ehdr> = unsafe {
        // A complicated type casting hacking!!
        let ehdr_raw_ptr = (Box::leak(buf) as *mut u8) as *mut Elf64_Ehdr;
        Box::from_raw(ehdr_raw_ptr)
    };

    Ok(*ehdr)
}

fn read_elf_sections(file: &mut File, ehdr: &Elf64_Ehdr) -> Result<Vec<Elf64_Shdr>, Error> {
    const HDRSIZE: usize = mem::size_of::<Elf64_Shdr>();
    let off = ehdr.e_shoff as usize;
    let num = ehdr.e_shnum as usize;

    let mut buf = read_u8(file, off as u64, num * HDRSIZE)?;

    let shdrs: Vec<Elf64_Shdr> = unsafe {
        let shdrs_ptr = buf.as_mut_ptr() as *mut Elf64_Shdr;
        buf.leak();
        Vec::from_raw_parts(shdrs_ptr, num, num)
    };
    Ok(shdrs)
}

fn read_elf_program_headers(file: &mut File, ehdr: &Elf64_Ehdr) -> Result<Vec<Elf64_Phdr>, Error> {
    const HDRSIZE: usize = mem::size_of::<Elf64_Phdr>();
    let off = ehdr.e_phoff as usize;
    let num = ehdr.e_phnum as usize;

    let mut buf = read_u8(file, off as u64, num * HDRSIZE)?;

    let phdrs: Vec<Elf64_Phdr> = unsafe {
        let phdrs_ptr = buf.as_mut_ptr() as *mut Elf64_Phdr;
        buf.leak();
        Vec::from_raw_parts(phdrs_ptr, num, num)
    };
    Ok(phdrs)
}

fn read_elf_section_raw(file: &mut File, section: &Elf64_Shdr) -> Result<Vec<u8>, Error> {
    read_u8(file, section.sh_offset as u64, section.sh_size as usize)
}

fn read_elf_section_seek(file: &mut File, section: &Elf64_Shdr) -> Result<(), Error> {
    file.seek(SeekFrom::Start(section.sh_offset as u64))?;
    Ok(())
}

fn read_elf_section_offset_seek(
    file: &mut File,
    section: &Elf64_Shdr,
    offset: usize,
) -> Result<(), Error> {
    if offset as u64 >= section.sh_size {
        return Err(Error::new(ErrorKind::InvalidInput, "the offset is too big"));
    }
    file.seek(SeekFrom::Start(section.sh_offset as u64 + offset as u64))?;
    Ok(())
}

fn get_elf_section_name<'a>(sect: &Elf64_Shdr, strtab: &'a [u8]) -> Option<&'a str> {
    extract_string(strtab, sect.sh_name as usize)
}

struct Elf64ParserBack {
    ehdr: Option<Elf64_Ehdr>,
    shdrs: Option<Vec<Elf64_Shdr>>,
    shstrtab: Option<Vec<u8>>,
    phdrs: Option<Vec<Elf64_Phdr>>,
    symtab: Option<Vec<Elf64_Sym>>,        // in address order
    symtab_origin: Option<Vec<Elf64_Sym>>, // The copy in the same order as the file
    strtab: Option<Vec<u8>>,
    str2symtab: Option<Vec<(usize, usize)>>, // strtab offset to symtab in the dictionary order
}

/// A parser against ELF64 format.
///
pub struct Elf64Parser {
    filename: String,
    file: RefCell<File>,
    backobj: RefCell<Elf64ParserBack>,
}

impl Elf64Parser {
    pub fn open_file(file: File) -> Result<Elf64Parser, Error> {
        let parser = Elf64Parser {
            filename: String::from(""),
            file: RefCell::new(file),
            backobj: RefCell::new(Elf64ParserBack {
                ehdr: None,
                shdrs: None,
                shstrtab: None,
                phdrs: None,
                symtab: None,
                symtab_origin: None,
                strtab: None,
                str2symtab: None,
            }),
        };
        Ok(parser)
    }

    pub fn open(filename: &str) -> Result<Elf64Parser, Error> {
        let file = File::open(filename)?;
        let parser = Self::open_file(file);
        if let Ok(mut parser) = parser {
            parser.filename = filename.to_string();
            Ok(parser)
        } else {
            parser
        }
    }

    fn ensure_ehdr(&self) -> Result<(), Error> {
        let mut me = self.backobj.borrow_mut();

        if me.ehdr.is_some() {
            return Ok(());
        }

        let ehdr = read_elf_header(&mut *self.file.borrow_mut())?;
        if !(ehdr.e_ident[0] == 0x7f
            && ehdr.e_ident[1] == 0x45
            && ehdr.e_ident[2] == 0x4c
            && ehdr.e_ident[3] == 0x46)
        {
            return Err(Error::new(ErrorKind::InvalidData, "e_ident is wrong"));
        }

        me.ehdr = Some(ehdr);

        Ok(())
    }

    fn ensure_shdrs(&self) -> Result<(), Error> {
        self.ensure_ehdr()?;

        let mut me = self.backobj.borrow_mut();

        if me.shdrs.is_some() {
            return Ok(());
        }

        let shdrs = read_elf_sections(&mut *self.file.borrow_mut(), me.ehdr.as_ref().unwrap())?;
        me.shdrs = Some(shdrs);

        Ok(())
    }

    fn ensure_phdrs(&self) -> Result<(), Error> {
        self.ensure_ehdr()?;

        let mut me = self.backobj.borrow_mut();

        if me.phdrs.is_some() {
            return Ok(());
        }

        let phdrs =
            read_elf_program_headers(&mut *self.file.borrow_mut(), me.ehdr.as_ref().unwrap())?;
        me.phdrs = Some(phdrs);

        Ok(())
    }

    fn ensure_shstrtab(&self) -> Result<(), Error> {
        self.ensure_shdrs()?;

        let mut me = self.backobj.borrow_mut();

        if me.shstrtab.is_some() {
            return Ok(());
        }

        let shstrndx = me.ehdr.as_ref().unwrap().e_shstrndx;
        let shstrtab_sec = &me.shdrs.as_ref().unwrap()[shstrndx as usize];
        let shstrtab = read_elf_section_raw(&mut *self.file.borrow_mut(), shstrtab_sec)?;
        me.shstrtab = Some(shstrtab);

        Ok(())
    }

    fn ensure_symtab(&self) -> Result<(), Error> {
        {
            let me = self.backobj.borrow();

            if me.symtab.is_some() {
                return Ok(());
            }
        }

        let sect_idx = if let Ok(idx) = self.find_section(".symtab") {
            idx
        } else {
            self.find_section(".dynsym")?
        };
        let symtab_raw = self.read_section_raw(sect_idx)?;

        if symtab_raw.len() % mem::size_of::<Elf64_Sym>() != 0 {
            return Err(Error::new(
                ErrorKind::InvalidData,
                "size of the .symtab section does not match",
            ));
        }
        let cnt = symtab_raw.len() / mem::size_of::<Elf64_Sym>();
        let mut symtab: Vec<Elf64_Sym> = unsafe {
            let symtab_ptr = symtab_raw.as_ptr() as *mut Elf64_Sym;
            symtab_raw.leak();
            Vec::from_raw_parts(symtab_ptr, cnt, cnt)
        };
        let origin = symtab.clone();
        symtab.sort_by_key(|x| x.st_value);

        let mut me = self.backobj.borrow_mut();
        me.symtab = Some(symtab);
        me.symtab_origin = Some(origin);

        Ok(())
    }

    fn ensure_strtab(&self) -> Result<(), Error> {
        {
            let me = self.backobj.borrow();

            if me.strtab.is_some() {
                return Ok(());
            }
        }

        let sect_idx = if let Ok(idx) = self.find_section(".strtab") {
            idx
        } else {
            self.find_section(".dynstr")?
        };
        let strtab = self.read_section_raw(sect_idx)?;

        let mut me = self.backobj.borrow_mut();
        me.strtab = Some(strtab);

        Ok(())
    }

    fn ensure_str2symtab(&self) -> Result<(), Error> {
        self.ensure_symtab()?;
        self.ensure_strtab()?;

        // strtab offsets to symtab indices
        let mut me = self.backobj.borrow_mut();
        let strtab = me.strtab.as_ref().unwrap();
        let symtab = me.symtab.as_ref().unwrap();
        let mut str2symtab = Vec::<(usize, usize)>::with_capacity(symtab.len());
        for (sym_i, sym) in symtab.iter().enumerate() {
            let name_off = sym.st_name;
            str2symtab.push((name_off as usize, sym_i));
        }

        // Sort in the dictionary order
        str2symtab.sort_by(|x, y| {
            let mut name_offx = x.0;
            let mut name_offy = y.0;
            loop {
                if strtab[name_offx] < strtab[name_offy] {
                    return Ordering::Less;
                }
                if strtab[name_offx] > strtab[name_offy] {
                    return Ordering::Greater;
                }
                if strtab[name_offx] == 0 {
                    break;
                }
                name_offx += 1;
                name_offy += 1;
            }
            Ordering::Equal
        });

        me.str2symtab = Some(str2symtab);

        Ok(())
    }

    pub fn get_elf_file_type(&self) -> Result<u16, Error> {
        self.ensure_ehdr()?;

        let me = self.backobj.borrow();

        Ok(me.ehdr.as_ref().unwrap().e_type)
    }

    fn check_section_index(&self, sect_idx: usize) -> Result<(), Error> {
        let nsects = self.get_num_sections()?;

        if nsects <= sect_idx {
            return Err(Error::new(ErrorKind::InvalidInput, "the index is too big"));
        }
        Ok(())
    }

    pub fn section_seek(&self, sect_idx: usize) -> Result<(), Error> {
        self.check_section_index(sect_idx)?;
        self.ensure_shdrs()?;
        let me = self.backobj.borrow();
        read_elf_section_seek(
            &mut *self.file.borrow_mut(),
            &me.shdrs.as_ref().unwrap()[sect_idx],
        )
    }

    pub fn section_offset_seek(&self, sect_idx: usize, offset: usize) -> Result<(), Error> {
        self.check_section_index(sect_idx)?;
        self.ensure_shdrs()?;
        let me = self.backobj.borrow();
        read_elf_section_offset_seek(
            &mut *self.file.borrow_mut(),
            &me.shdrs.as_ref().unwrap()[sect_idx],
            offset,
        )
    }

    /// Read the raw data of the section of a given index.
    pub fn read_section_raw(&self, sect_idx: usize) -> Result<Vec<u8>, Error> {
        self.check_section_index(sect_idx)?;
        self.ensure_shdrs()?;

        let me = self.backobj.borrow();
        read_elf_section_raw(
            &mut *self.file.borrow_mut(),
            &me.shdrs.as_ref().unwrap()[sect_idx],
        )
    }

    /// Get the name of the section of a given index.
    pub fn get_section_name(&self, sect_idx: usize) -> Result<&str, Error> {
        self.check_section_index(sect_idx)?;

        self.ensure_shstrtab()?;

        let me = self.backobj.borrow();

        let sect = &me.shdrs.as_ref().unwrap()[sect_idx];
        let name = get_elf_section_name(sect, unsafe {
            (*self.backobj.as_ptr()).shstrtab.as_ref().unwrap()
        });
        if name.is_none() {
            return Err(Error::new(ErrorKind::InvalidData, "invalid section name"));
        }
        Ok(name.unwrap())
    }

    pub fn get_section_size(&self, sect_idx: usize) -> Result<usize, Error> {
        self.check_section_index(sect_idx)?;
        self.ensure_shdrs()?;

        let me = self.backobj.borrow();
        let sect = &me.shdrs.as_ref().unwrap()[sect_idx];
        Ok(sect.sh_size as usize)
    }

    pub fn get_num_sections(&self) -> Result<usize, Error> {
        self.ensure_ehdr()?;
        let me = self.backobj.borrow();
        Ok(me.ehdr.as_ref().unwrap().e_shnum as usize)
    }

    /// Find the section of a given name.
    ///
    /// This function return the index of the section if found.
    pub fn find_section(&self, name: &str) -> Result<usize, Error> {
        let nsects = self.get_num_sections()?;
        for i in 0..nsects {
            if self.get_section_name(i)? == name {
                return Ok(i);
            }
        }
        Err(Error::new(
            ErrorKind::NotFound,
            format!("Does not found the give section: {}", name),
        ))
    }

    pub fn find_symbol(&self, address: u64, st_type: u8) -> Result<(&str, u64), Error> {
        self.ensure_symtab()?;
        self.ensure_strtab()?;

        let me = self.backobj.borrow();
        let idx_r =
            search_address_opt_key(me.symtab.as_ref().unwrap(), address, &|sym: &Elf64_Sym| {
                if sym.st_info & 0xf != st_type || sym.st_shndx == SHN_UNDEF {
                    None
                } else {
                    Some(sym.st_value)
                }
            });
        if idx_r.is_none() {
            return Err(Error::new(
                ErrorKind::NotFound,
                "Does not found a symbol for the given address",
            ));
        }
        let idx = idx_r.unwrap();

        let sym = &me.symtab.as_ref().unwrap()[idx];
        let sym_name = match extract_string(
            unsafe { (*self.backobj.as_ptr()).strtab.as_ref().unwrap().as_slice() },
            sym.st_name as usize,
        ) {
            Some(sym_name) => sym_name,
            None => {
                return Err(Error::new(
                    ErrorKind::InvalidData,
                    "invalid symbol name string/offset",
                ));
            }
        };
        Ok((sym_name, sym.st_value))
    }

    pub fn find_address(&self, name: &str) -> Result<u64, Error> {
        self.ensure_str2symtab()?;

        let me = self.backobj.borrow();
        let str2symtab = me.str2symtab.as_ref().unwrap();
        let strtab = me.strtab.as_ref().unwrap();
        let bytes = name.as_bytes();
        let r = str2symtab.binary_search_by(|(off, _sym_i)| {
            // Compare strtab[off] with name with the dictionary order
            for i in 0..bytes.len() {
                if bytes[i] < strtab[off + i] {
                    return Ordering::Greater;
                }
                if bytes[i] > strtab[off + i] {
                    return Ordering::Less;
                }
            }
            if strtab[off + bytes.len()] == 0 {
                Ordering::Equal
            } else {
                Ordering::Greater
            }
        });

        match r {
            Ok(str2sym_i) => {
                let sym_i = str2symtab[str2sym_i].1;
                Ok(me.symtab.as_ref().unwrap()[sym_i].st_value)
            }
            Err(_) => Err(Error::new(ErrorKind::NotFound, "an unknown symbol")),
        }
    }

    pub fn get_num_symbols(&self) -> Result<usize, Error> {
        self.ensure_symtab()?;

        let me = self.backobj.borrow();
        Ok(me.symtab.as_ref().unwrap().len())
    }

    pub fn get_symbol(&self, idx: usize) -> Result<&Elf64_Sym, Error> {
        self.ensure_symtab()?;

        let me = self.backobj.as_ptr();
        Ok(unsafe { &(*me).symtab.as_mut().unwrap()[idx] })
    }

    pub fn get_symbol_origin(&self, idx: usize) -> Result<&Elf64_Sym, Error> {
        self.ensure_symtab()?;

        let me = self.backobj.as_ptr();
        Ok(unsafe { &(*me).symtab_origin.as_mut().unwrap()[idx] })
    }

    pub fn get_symbol_name(&self, idx: usize) -> Result<&str, Error> {
        let sym = self.get_symbol(idx)?;

        let me = self.backobj.as_ptr();
        let sym_name = match extract_string(
            unsafe { (*me).strtab.as_ref().unwrap().as_slice() },
            sym.st_name as usize,
        ) {
            Some(name) => name,
            None => {
                return Err(Error::new(
                    ErrorKind::InvalidData,
                    "invalid symb name string/offset",
                ));
            }
        };

        Ok(sym_name)
    }

    pub fn get_all_symbols(&self) -> Result<&[Elf64_Sym], Error> {
        self.ensure_symtab()?;

        let symtab = unsafe {
            let me = self.backobj.as_ptr();
            let symtab_ref = (*me).symtab.as_mut().unwrap();
            symtab_ref
        };
        Ok(symtab)
    }

    pub fn get_all_program_headers(&self) -> Result<&[Elf64_Phdr], Error> {
        self.ensure_phdrs()?;

        let phdrs = unsafe {
            let me = self.backobj.as_ptr();
            let phdrs_ref = (*me).phdrs.as_mut().unwrap();
            phdrs_ref
        };
        Ok(phdrs)
    }

    #[allow(dead_code)]
    #[cfg(debug_assertions)]
    fn pick_symtab_addr(&self) -> (&str, u64) {
        self.ensure_symtab().unwrap();
        self.ensure_strtab().unwrap();

        let me = self.backobj.borrow();
        let symtab = me.symtab.as_ref().unwrap();
        let mut idx = symtab.len() / 2;
        while symtab[idx].st_info & 0xf != STT_FUNC || symtab[idx].st_shndx == SHN_UNDEF {
            idx += 1;
        }
        let sym = &symtab[idx];
        let addr = sym.st_value;
        drop(me);

        let sym_name = self.get_symbol_name(idx).unwrap();
        (sym_name, addr)
    }

    /// Read raw data from the file at the current position.
    ///
    /// The caller can use section_seek() to move the current position
    /// of the backed file.  However, this function doesn't promise to
    /// not cross the boundary of the section.  The caller should take
    /// care about it.
    pub unsafe fn read_raw(&self, buf: &mut [u8]) -> Result<(), Error> {
        self.file.borrow_mut().read_exact(buf)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn test_elf_header_sections() {
        let args: Vec<String> = env::args().collect();
        let bin_name = &args[0];

        let mut bin_file = File::open(bin_name).unwrap();
        let ehdr = read_elf_header(&mut bin_file);
        assert!(ehdr.is_ok());
        let ehdr = ehdr.unwrap();
        assert_eq!(
            ehdr.e_ident,
            [
                0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00
            ]
        );
        assert_eq!(ehdr.e_version, 0x1);
        assert_eq!(ehdr.e_shentsize as usize, mem::size_of::<Elf64_Shdr>());

        let shdrs = read_elf_sections(&mut bin_file, &ehdr);
        assert!(shdrs.is_ok());
        let shdrs = shdrs.unwrap();
        let shstrndx = ehdr.e_shstrndx as usize;

        let shstrtab_sec = &shdrs[shstrndx];
        let shstrtab = read_elf_section_raw(&mut bin_file, shstrtab_sec);
        assert!(shstrtab.is_ok());
        let shstrtab = shstrtab.unwrap();

        let sec_name = get_elf_section_name(shstrtab_sec, &shstrtab);
        assert!(sec_name.is_some());
        assert_eq!(sec_name.unwrap(), ".shstrtab");
    }

    #[test]
    fn test_elf64_parser() {
        let args: Vec<String> = env::args().collect();
        let bin_name = &args[0];

        let parser = Elf64Parser::open(bin_name).unwrap();
        assert!(parser.find_section(".shstrtab").is_ok());
    }

    #[test]
    fn test_elf64_symtab() {
        let args: Vec<String> = env::args().collect();
        let bin_name = &args[0];

        let parser = Elf64Parser::open(bin_name).unwrap();
        assert!(parser.find_section(".shstrtab").is_ok());

        let (sym_name, addr) = parser.pick_symtab_addr();

        let sym_r = parser.find_symbol(addr, STT_FUNC);
        assert!(sym_r.is_ok());
        let (sym_name_ret, addr_ret) = sym_r.unwrap();
        assert_eq!(addr_ret, addr);
        assert_eq!(sym_name_ret, sym_name);
    }
    #[test]
    fn test_elf64_find_address() {
        let args: Vec<String> = env::args().collect();
        let bin_name = &args[0];

        let parser = Elf64Parser::open(bin_name).unwrap();
        assert!(parser.find_section(".shstrtab").is_ok());

        let (sym_name, addr) = parser.pick_symtab_addr();

        println!("{}", sym_name);
        let addr_r = parser.find_address(sym_name);
        //assert!(addr_r.is_ok());
        let addr_ret = addr_r.unwrap();
        assert_eq!(addr_ret, addr);
    }
}
