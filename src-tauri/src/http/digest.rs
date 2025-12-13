use std::collections::HashMap;
use std::time::Instant;

use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use reqwest::{Client, Method};

use crate::error::AppError;
use crate::models::response::HttpResponse;

/// Parse a WWW-Authenticate: Digest header into its components
fn parse_digest_challenge(header: &str) -> HashMap<String, String> {
    let mut params = HashMap::new();
    // Remove "Digest " prefix
    let body = header.strip_prefix("Digest ").unwrap_or(header);

    for part in body.split(',') {
        let part = part.trim();
        if let Some(eq_pos) = part.find('=') {
            let key = part[..eq_pos].trim().to_lowercase();
            let value = part[eq_pos + 1..].trim().trim_matches('"').to_string();
            params.insert(key, value);
        }
    }

    params
}

/// Compute MD5 hash and return hex string
fn md5_hex(input: &str) -> String {
    // Simple MD5 implementation using the format that digest auth needs
    // We'll use a basic approach since we don't want to add another dependency
    let digest = md5_compute(input.as_bytes());
    digest.iter().map(|b| format!("{:02x}", b)).collect()
}

/// Minimal MD5 implementation for digest auth
fn md5_compute(msg: &[u8]) -> [u8; 16] {
    const S: [u32; 64] = [
        7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
        5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
        4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
        6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
    ];

    const K: [u32; 64] = [
        0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613,
        0xfd469501, 0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193,
        0xa679438e, 0x49b40821, 0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d,
        0x02441453, 0xd8a1e681, 0xe7d3fbc8, 0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed,
        0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a, 0xfffa3942, 0x8771f681, 0x6d9d6122,
        0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70, 0x289b7ec6, 0xeaa127fa,
        0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665, 0xf4292244,
        0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
        0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb,
        0xeb86d391,
    ];

    let mut a0: u32 = 0x67452301;
    let mut b0: u32 = 0xefcdab89;
    let mut c0: u32 = 0x98badcfe;
    let mut d0: u32 = 0x10325476;

    let orig_len_bits = (msg.len() as u64) * 8;
    let mut data = msg.to_vec();
    data.push(0x80);
    while data.len() % 64 != 56 {
        data.push(0);
    }
    data.extend_from_slice(&orig_len_bits.to_le_bytes());

    for chunk in data.chunks_exact(64) {
        let mut m = [0u32; 16];
        for (i, word) in chunk.chunks_exact(4).enumerate() {
            m[i] = u32::from_le_bytes([word[0], word[1], word[2], word[3]]);
        }

        let (mut a, mut b, mut c, mut d) = (a0, b0, c0, d0);

        for i in 0..64 {
            let (f, g) = match i {
                0..=15 => ((b & c) | ((!b) & d), i),
                16..=31 => ((d & b) | ((!d) & c), (5 * i + 1) % 16),
                32..=47 => (b ^ c ^ d, (3 * i + 5) % 16),
                _ => (c ^ (b | (!d)), (7 * i) % 16),
            };

            let temp = d;
            d = c;
            c = b;
            b = b.wrapping_add(
                (a.wrapping_add(f).wrapping_add(K[i]).wrapping_add(m[g]))
                    .rotate_left(S[i]),
            );
            a = temp;
        }

        a0 = a0.wrapping_add(a);
        b0 = b0.wrapping_add(b);
        c0 = c0.wrapping_add(c);
        d0 = d0.wrapping_add(d);
    }

    let mut result = [0u8; 16];
    result[0..4].copy_from_slice(&a0.to_le_bytes());
    result[4..8].copy_from_slice(&b0.to_le_bytes());
    result[8..12].copy_from_slice(&c0.to_le_bytes());
    result[12..16].copy_from_slice(&d0.to_le_bytes());
    result
}

/// Execute a request with digest authentication
/// 1. Send initial request (may get 401 with WWW-Authenticate)
/// 2. Parse digest challenge
/// 3. Compute digest response
/// 4. Resend with Authorization header
pub async fn execute_digest_request(
    method: &str,
    url: &str,
    headers: Vec<(String, String)>,
    body: Option<String>,
    username: &str,
    password: &str,
    timeout_secs: u64,
    follow_redirects: bool,
    verify_ssl: bool,
) -> Result<HttpResponse, AppError> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(timeout_secs))
        .redirect(if follow_redirects {
            reqwest::redirect::Policy::limited(10)
        } else {
            reqwest::redirect::Policy::none()
        })
        .danger_accept_invalid_certs(!verify_ssl)
        .build()?;

    let req_method = Method::from_bytes(method.as_bytes())
        .map_err(|e| AppError::Internal(format!("Invalid HTTP method: {}", e)))?;

    // Build header map (without digest auth headers)
    let mut header_map = HeaderMap::new();
    for (key, value) in &headers {
        if let (Ok(name), Ok(val)) = (
            HeaderName::from_bytes(key.as_bytes()),
            HeaderValue::from_str(value),
        ) {
            header_map.insert(name, val);
        }
    }

    // Step 1: Initial request
    let mut builder = client.request(req_method.clone(), url).headers(header_map.clone());
    if let Some(ref b) = body {
        if !b.is_empty() {
            builder = builder.body(b.clone());
        }
    }

    let start = Instant::now();
    let initial_response = builder.send().await?;

    // If not 401 or no WWW-Authenticate, just return the response
    if initial_response.status().as_u16() != 401 {
        let elapsed = start.elapsed().as_millis() as u64;
        let status_code = initial_response.status().as_u16();
        let status_text = initial_response
            .status()
            .canonical_reason()
            .unwrap_or("Unknown")
            .to_string();

        let mut resp_headers = HashMap::new();
        for (key, value) in initial_response.headers() {
            if let Ok(v) = value.to_str() {
                resp_headers.insert(key.to_string(), v.to_string());
            }
        }

        let body_bytes = initial_response.bytes().await?;
        let size = body_bytes.len() as u64;
        let body_str = String::from_utf8_lossy(&body_bytes).to_string();

        return Ok(HttpResponse {
            status_code,
            status_text,
            headers: resp_headers,
            body: body_str,
            size,
            time: elapsed,
        });
    }

    let www_authenticate = initial_response
        .headers()
        .get("www-authenticate")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    // Consume the initial response body
    let _ = initial_response.bytes().await?;

    if !www_authenticate.to_lowercase().starts_with("digest") {
        return Err(AppError::Internal(
            "Server returned 401 but not with Digest authentication challenge".to_string(),
        ));
    }

    // Step 2: Parse challenge
    let challenge = parse_digest_challenge(&www_authenticate);
    let realm = challenge.get("realm").cloned().unwrap_or_default();
    let nonce = challenge.get("nonce").cloned().unwrap_or_default();
    let qop = challenge.get("qop").cloned().unwrap_or_default();
    let opaque = challenge.get("opaque").cloned();
    let algorithm = challenge
        .get("algorithm")
        .cloned()
        .unwrap_or_else(|| "MD5".to_string());

    if algorithm.to_uppercase() != "MD5" {
        return Err(AppError::Internal(format!(
            "Unsupported digest algorithm: {}. Only MD5 is supported.",
            algorithm
        )));
    }

    // Step 3: Compute digest
    // Extract URI path from URL
    let uri = url::Url::parse(url)
        .map(|u| u.path().to_string())
        .unwrap_or_else(|_| url.to_string());

    let ha1 = md5_hex(&format!("{}:{}:{}", username, realm, password));
    let ha2 = md5_hex(&format!("{}:{}", method, uri));

    let nc = "00000001";
    let cnonce = format!("{:08x}", rand_u32());

    let response_hash = if qop.contains("auth") {
        md5_hex(&format!(
            "{}:{}:{}:{}:auth:{}",
            ha1, nonce, nc, cnonce, ha2
        ))
    } else {
        md5_hex(&format!("{}:{}:{}", ha1, nonce, ha2))
    };

    // Build Authorization header
    let mut auth_parts = vec![
        format!("username=\"{}\"", username),
        format!("realm=\"{}\"", realm),
        format!("nonce=\"{}\"", nonce),
        format!("uri=\"{}\"", uri),
        format!("response=\"{}\"", response_hash),
        format!("algorithm={}", algorithm),
    ];

    if qop.contains("auth") {
        auth_parts.push(format!("qop=auth"));
        auth_parts.push(format!("nc={}", nc));
        auth_parts.push(format!("cnonce=\"{}\"", cnonce));
    }

    if let Some(opaque_val) = opaque {
        auth_parts.push(format!("opaque=\"{}\"", opaque_val));
    }

    let auth_header = format!("Digest {}", auth_parts.join(", "));

    // Step 4: Send authenticated request
    header_map.insert(
        HeaderName::from_static("authorization"),
        HeaderValue::from_str(&auth_header)
            .map_err(|e| AppError::Internal(format!("Invalid auth header: {}", e)))?,
    );

    let mut builder = client
        .request(req_method, url)
        .headers(header_map);

    if let Some(ref b) = body {
        if !b.is_empty() {
            builder = builder.body(b.clone());
        }
    }

    let response = builder.send().await?;
    let elapsed = start.elapsed().as_millis() as u64;

    let status_code = response.status().as_u16();
    let status_text = response
        .status()
        .canonical_reason()
        .unwrap_or("Unknown")
        .to_string();

    let mut resp_headers = HashMap::new();
    for (key, value) in response.headers() {
        if let Ok(v) = value.to_str() {
            resp_headers.insert(key.to_string(), v.to_string());
        }
    }

    let body_bytes = response.bytes().await?;
    let size = body_bytes.len() as u64;
    let body_str = String::from_utf8_lossy(&body_bytes).to_string();

    Ok(HttpResponse {
        status_code,
        status_text,
        headers: resp_headers,
        body: body_str,
        size,
        time: elapsed,
    })
}

/// Simple pseudo-random u32 for cnonce generation
fn rand_u32() -> u32 {
    use std::time::SystemTime;
    let seed = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos() as u32;
    // Simple xorshift
    let mut x = seed;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    x
}
