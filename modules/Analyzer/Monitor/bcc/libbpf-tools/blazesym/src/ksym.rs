use std::cell::RefCell;
use std::collections::HashMap;
use std::default::Default;
use std::ffi::CString;
use std::fs::File;
use std::io::{BufRead, BufReader, Error};
use std::rc::Rc;
use std::u64;

use crate::SymResolver;

const KALLSYMS: &str = "/proc/kallsyms";
const DFL_KSYM_CAP: usize = 200000;

pub struct Ksym {
    pub addr: u64,
    pub name: String,
    pub c_name: RefCell<Option<CString>>,
}

/// The symbol resolver for /proc/kallsyms.
///
/// The users should provide the path of kallsyms, so you can provide
/// a copy from other devices.
pub struct KSymResolver {
    syms: Vec<Ksym>,
    sym_to_addr: RefCell<HashMap<&'static str, u64>>,
}

impl KSymResolver {
    pub fn new() -> KSymResolver {
        Default::default()
    }

    pub fn load_file_name(&mut self, filename: &str) -> Result<(), std::io::Error> {
        let f = File::open(filename)?;
        let mut reader = BufReader::new(f);
        let mut line = String::new();

        while let Ok(sz) = reader.read_line(&mut line) {
            if sz == 0 {
                break;
            }
            let tokens: Vec<&str> = line.split_whitespace().collect();
            if tokens.len() < 3 {
                break;
            }
            let (addr, _symbol, func) = (tokens[0], tokens[1], tokens[2]);
            if let Ok(addr) = u64::from_str_radix(addr, 16) {
                let name = String::from(func);
                self.syms.push(Ksym {
                    addr,
                    name,
                    c_name: RefCell::new(None),
                });
            }

            line.truncate(0);
        }

        self.syms.sort_by(|a, b| a.addr.cmp(&b.addr));

        Ok(())
    }

    pub fn load(&mut self) -> Result<(), std::io::Error> {
        self.load_file_name(KALLSYMS)
    }

    fn ensure_sym_to_addr(&self) {
        if self.sym_to_addr.borrow().len() > 0 {
            return;
        }
        let mut sym_to_addr = self.sym_to_addr.borrow_mut();
        for Ksym {
            name,
            addr,
            c_name: _,
        } in self.syms.iter()
        {
            // Performance & lifetime hacking
            let name_static = unsafe { &*(name as *const String) };
            sym_to_addr.insert(name_static, *addr);
        }
    }

    pub fn find_address_ksym(&self, addr: u64) -> Option<&Ksym> {
        let mut l = 0;
        let mut r = self.syms.len();

        if !self.syms.is_empty() && self.syms[0].addr > addr {
            return None;
        }

        while l < (r - 1) {
            let v = (l + r) / 2;
            let sym = &self.syms[v];

            if sym.addr == addr {
                return Some(sym);
            }
            if addr < sym.addr {
                r = v;
            } else {
                l = v;
            }
        }

        Some(&self.syms[l])
    }
}

impl Default for KSymResolver {
    fn default() -> Self {
        KSymResolver {
            syms: Vec::with_capacity(DFL_KSYM_CAP),
            sym_to_addr: RefCell::new(HashMap::new()),
        }
    }
}

impl SymResolver for KSymResolver {
    fn get_address_range(&self) -> (u64, u64) {
        (0xffffffff80000000, 0xffffffffffffffff)
    }

    fn find_symbol(&self, addr: u64) -> Option<(&str, u64)> {
        if let Some(sym) = self.find_address_ksym(addr) {
            return Some((&sym.name, sym.addr));
        }
        None
    }

    fn find_address(&self, name: &str) -> Option<u64> {
        self.ensure_sym_to_addr();

        if let Some(addr) = self.sym_to_addr.borrow().get(name) {
            return Some(*addr);
        }
        None
    }

    fn find_line_info(&self, _addr: u64) -> Option<super::AddressLineInfo> {
        None
    }

    fn repr(&self) -> String {
        String::from("KSymResolver")
    }
}

/// Cache of KSymResolver.
///
/// It returns the same isntance if path is the same.
pub struct KSymCache {
    resolvers: RefCell<HashMap<String, Rc<KSymResolver>>>,
}

impl KSymCache {
    pub fn new() -> KSymCache {
        KSymCache {
            resolvers: RefCell::new(HashMap::new()),
        }
    }

    /// Find an instance of KSymResolver from the cache or create a new one.
    pub fn get_resolver(&self, path: &str) -> Result<Rc<KSymResolver>, Error> {
        let mut resolvers = self.resolvers.borrow_mut();
        if let Some(resolver) = resolvers.get(path) {
            return Ok(resolver.clone());
        }

        let mut resolver = Rc::new(KSymResolver::new());
        Rc::get_mut(&mut resolver).unwrap().load_file_name(path)?;
        resolvers.insert(path.to_string(), resolver.clone());
        Ok(resolver)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ksym_resolver_load_find() {
        let mut resolver = KSymResolver::new();
        assert!(resolver.load().is_ok());

        assert!(resolver.syms.len() > 100000);

        // Find the address of the symbol placed at the middle
        let sym = &resolver.syms[resolver.syms.len() / 2];
        let addr = sym.addr;
        let name = sym.name.clone();
        let found = resolver.find_symbol(addr);
        assert!(found.is_some());
        assert_eq!(found.unwrap().0, &name);
        let addr = addr + 1;
        let found = resolver.find_symbol(addr);
        assert!(found.is_some());
        assert_eq!(found.unwrap().0, &name);

        // Find the address of the first symbol
        let found = resolver.find_symbol(0);
        assert!(found.is_some());

        // Find the address of the last symbol
        let sym = &resolver.syms.last().unwrap();
        let addr = sym.addr;
        let name = sym.name.clone();
        let found = resolver.find_symbol(addr);
        assert!(found.is_some());
        assert_eq!(found.unwrap().0, &name);
        let found = resolver.find_symbol(addr + 1);
        assert!(found.is_some());
        assert_eq!(found.unwrap().0, &name);

        // Find the symbol placed at the one third
        let sym = &resolver.syms[resolver.syms.len() / 3];
        let addr = sym.addr;
        let name = sym.name.clone();
        let found = resolver.find_address(&name);
        assert!(found.is_some());
        assert_eq!(found.unwrap(), addr);
    }

    #[test]
    fn ksym_cache() {
        let cache = KSymCache::new();
        let resolver = cache.get_resolver(KALLSYMS);
        let resolver1 = cache.get_resolver(KALLSYMS);
        assert!(resolver.is_ok());
        assert!(resolver1.is_ok());
    }
}
