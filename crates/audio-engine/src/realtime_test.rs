//! Instrumentação só dos testes, por thread; não entra no binário do app.
use std::alloc::{GlobalAlloc, Layout, System};
use std::cell::Cell;
thread_local! {
    static ACTIVE: Cell<bool> = const { Cell::new(false) };
    static COUNT: Cell<usize> = const { Cell::new(0) };
}
struct Allocator;
fn track() { let _ = ACTIVE.try_with(|active| { if active.get() { let _ = COUNT.try_with(|n| n.set(n.get() + 1)); } }); }
unsafe impl GlobalAlloc for Allocator {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 { track(); unsafe { System.alloc(layout) } }
    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) { track(); unsafe { System.dealloc(ptr, layout) } }
    unsafe fn realloc(&self, ptr: *mut u8, layout: Layout, size: usize) -> *mut u8 { track(); unsafe { System.realloc(ptr, layout, size) } }
}
#[global_allocator]
static ALLOCATOR: Allocator = Allocator;
pub fn count(f: impl FnOnce()) -> usize {
    COUNT.with(|n| n.set(0)); ACTIVE.with(|a| a.set(true));
    f(); ACTIVE.with(|a| a.set(false)); COUNT.with(Cell::get)
}
