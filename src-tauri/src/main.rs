#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod database;
mod error;

fn main() {
    mosaic_lib::run()
}
