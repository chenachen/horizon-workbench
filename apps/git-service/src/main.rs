use std::io::{self, Read};

fn main() {
    let mut input = String::new();
    let result = io::stdin()
        .take(1024 * 1024)
        .read_to_string(&mut input)
        .map_err(|e| horizon_git::Error::new("IO_ERROR", e.to_string()))
        .and_then(|_| {
            serde_json::from_str(&input)
                .map_err(|e| horizon_git::Error::new("INVALID_ARGUMENT", e.to_string()))
        })
        .and_then(horizon_git::dispatch);
    let output = match result {
        Ok(value) => serde_json::json!({"type":"result","data":value}),
        Err(error) => serde_json::json!({"type":"error","error":error}),
    };
    println!("{output}");
}
