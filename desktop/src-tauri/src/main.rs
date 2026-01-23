#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod error;

fn main() {
    mosaic_lib::run()
}
