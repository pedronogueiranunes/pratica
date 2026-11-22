use std::io::{self, Read};
fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let request: serde_json::Value = serde_json::from_str(&input).unwrap();
    let mut store = practice_store::Store::open(std::env::args().nth(1).unwrap()).unwrap();
    match store.request(request["operation"].as_str().unwrap(), &request["data"]) {
        Ok(value) => println!("{}", serde_json::json!({"ok":value})),
        Err(error) => println!("{}", serde_json::json!({"error":error})),
    }
}
