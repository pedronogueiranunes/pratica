//! Prova de conceito do login do Spotify: Authorization Code com PKCE e
//! redirect por loopback (http://127.0.0.1:PORTA/callback), como o Spotify
//! exige desde 2025. O token fica só na memória por enquanto; na Fase 3 vai
//! para o Keychain.

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use rand::Rng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::State;

const SCOPES: &str = "user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private";
const LOGIN_TIMEOUT: Duration = Duration::from_secs(180);

#[derive(Default)]
pub struct SpotifyState(Mutex<Option<Token>>);

#[derive(Clone, Deserialize)]
struct Token {
    access_token: String,
    #[serde(default)]
    scope: String,
    expires_in: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginResult {
    scope: String,
    expires_in: u64,
    redirect_uri: String,
}

#[derive(Serialize)]
pub struct ApiResponse {
    status: u16,
    body: serde_json::Value,
}

fn random_string(len: usize) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    let mut rng = rand::rng();
    (0..len).map(|_| CHARS[rng.random_range(0..CHARS.len())] as char).collect()
}

fn query_param(query: &str, key: &str) -> Option<String> {
    query.split('&').find_map(|pair| {
        let (k, v) = pair.split_once('=')?;
        (k == key).then(|| v.replace('+', " ")).map(|v| percent_decode(&v))
    })
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(b) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                out.push(b);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Espera o redirect do Spotify no loopback e devolve o `code`.
fn wait_for_code(listener: TcpListener, state: &str) -> Result<String, String> {
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    let deadline = Instant::now() + LOGIN_TIMEOUT;
    loop {
        if Instant::now() > deadline {
            return Err("O login demorou demais. Tente de novo.".into());
        }
        let (mut stream, _) = match listener.accept() {
            Ok(s) => s,
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(100));
                continue;
            }
            Err(e) => return Err(e.to_string()),
        };
        let _ = stream.set_nonblocking(false);
        let mut line = String::new();
        BufReader::new(&stream).read_line(&mut line).map_err(|e| e.to_string())?;
        // "GET /callback?code=...&state=... HTTP/1.1"
        let path = line.split_whitespace().nth(1).unwrap_or("");
        if !path.starts_with("/callback") {
            let _ = stream.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n");
            continue;
        }
        let query = path.split_once('?').map(|(_, q)| q).unwrap_or("");
        let result = if query_param(query, "state").as_deref() != Some(state) {
            Err("Resposta do Spotify não confere. Tente de novo.".to_string())
        } else if let Some(err) = query_param(query, "error") {
            Err(format!("O Spotify recusou o login ({err})."))
        } else {
            query_param(query, "code").ok_or_else(|| "O Spotify não mandou o código.".to_string())
        };
        let message = if result.is_ok() {
            "Pronto. Pode fechar esta aba e voltar para o Prática."
        } else {
            "Não deu certo. Volte para o Prática e tente de novo."
        };
        let html = format!(
            "<!doctype html><meta charset=utf-8><title>Prática</title>\
             <body style=\"font:15px -apple-system,sans-serif;display:grid;place-items:center;height:90vh\">{message}</body>"
        );
        let _ = write!(
            stream,
            "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            html.len(),
            html
        );
        return result;
    }
}

#[tauri::command]
pub async fn spotify_login(
    state: State<'_, SpotifyState>,
    client_id: String,
) -> Result<LoginResult, String> {
    let client_id = client_id.trim().to_string();
    if client_id.is_empty() {
        return Err("Informe o Client ID do seu app no Spotify.".into());
    }
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let redirect_uri = format!("http://127.0.0.1:{port}/callback");
    let verifier = random_string(64);
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let csrf = random_string(24);

    let url = reqwest::Url::parse_with_params(
        "https://accounts.spotify.com/authorize",
        &[
            ("client_id", client_id.as_str()),
            ("response_type", "code"),
            ("redirect_uri", redirect_uri.as_str()),
            ("code_challenge_method", "S256"),
            ("code_challenge", challenge.as_str()),
            ("state", csrf.as_str()),
            ("scope", SCOPES),
        ],
    )
    .map_err(|e| e.to_string())?;

    tauri_plugin_opener::open_url(url.as_str(), None::<&str>).map_err(|e| e.to_string())?;

    let csrf_clone = csrf.clone();
    let code = tauri::async_runtime::spawn_blocking(move || wait_for_code(listener, &csrf_clone))
        .await
        .map_err(|e| e.to_string())??;

    let resp = reqwest::Client::new()
        .post("https://accounts.spotify.com/api/token")
        .form(&[
            ("grant_type", "authorization_code"),
            ("code", code.as_str()),
            ("redirect_uri", redirect_uri.as_str()),
            ("client_id", client_id.as_str()),
            ("code_verifier", verifier.as_str()),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("O Spotify não aceitou o código: {body}"));
    }
    let token: Token = resp.json().await.map_err(|e| e.to_string())?;
    let result = LoginResult { scope: token.scope.clone(), expires_in: token.expires_in, redirect_uri };
    *state.0.lock().map_err(|e| e.to_string())? = Some(token);
    Ok(result)
}

/// Repassa uma chamada à Web API com o token atual. `path` começa com "/".
#[tauri::command]
pub async fn spotify_request(
    state: State<'_, SpotifyState>,
    method: String,
    path: String,
    body: Option<serde_json::Value>,
) -> Result<ApiResponse, String> {
    let token = state
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or("Conecte o Spotify primeiro.")?;
    if !path.starts_with('/') {
        return Err("Caminho inválido.".into());
    }
    let method = reqwest::Method::from_bytes(method.to_uppercase().as_bytes()).map_err(|e| e.to_string())?;
    let mut req = reqwest::Client::new()
        .request(method, format!("https://api.spotify.com/v1{path}"))
        .bearer_auth(&token.access_token);
    if let Some(b) = body {
        req = req.json(&b);
    } else {
        req = req.header("Content-Length", "0");
    }
    let resp = req.send().await.map_err(|e| e.to_string())?;
    let status = resp.status().as_u16();
    let text = resp.text().await.unwrap_or_default();
    let body = serde_json::from_str(&text).unwrap_or(serde_json::Value::Null);
    Ok(ApiResponse { status, body })
}

#[tauri::command]
pub fn spotify_logout(state: State<'_, SpotifyState>) {
    if let Ok(mut t) = state.0.lock() {
        *t = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn le_parametros_da_url_de_retorno() {
        let q = "code=AQB%2Fx_y&state=abc123";
        assert_eq!(query_param(q, "code").as_deref(), Some("AQB/x_y"));
        assert_eq!(query_param(q, "state").as_deref(), Some("abc123"));
        assert_eq!(query_param(q, "error"), None);
    }

    #[test]
    fn desafio_pkce_segue_a_rfc_7636() {
        // Exemplo do apêndice B da RFC 7636.
        let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
        let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
        assert_eq!(challenge, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    }
}
