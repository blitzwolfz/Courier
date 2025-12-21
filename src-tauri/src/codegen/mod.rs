use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct CodeGenRequest {
    pub method: String,
    pub url: String,
    pub headers: Vec<(String, String)>,
    pub body: Option<String>,
    pub auth_header: Option<String>,
}

pub fn generate(language: &str, req: &CodeGenRequest) -> String {
    match language {
        "curl" => generate_curl(req),
        "javascript-fetch" => generate_js_fetch(req),
        "javascript-axios" => generate_js_axios(req),
        "python" => generate_python(req),
        "rust" => generate_rust(req),
        "go" => generate_go(req),
        "java" => generate_java(req),
        "csharp" => generate_csharp(req),
        "php" => generate_php(req),
        "ruby" => generate_ruby(req),
        "swift" => generate_swift(req),
        _ => format!("// Unsupported language: {}", language),
    }
}

fn escape_single(s: &str) -> String {
    s.replace('\\', "\\\\").replace('\'', "'\\''")
}

fn escape_double(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
        .replace('\t', "\\t")
}

fn generate_curl(req: &CodeGenRequest) -> String {
    let mut parts = vec![format!("curl -X {} \\", req.method)];
    parts.push(format!("  '{}'", escape_single(&req.url)));

    if let Some(auth) = &req.auth_header {
        if !auth.is_empty() {
            parts.push(format!("  -H 'Authorization: {}'", escape_single(auth)));
        }
    }

    for (key, value) in &req.headers {
        parts.push(format!(
            "  -H '{}: {}'",
            escape_single(key),
            escape_single(value)
        ));
    }

    if let Some(body) = &req.body {
        if !body.is_empty() {
            parts.push(format!("  -d '{}'", escape_single(body)));
        }
    }

    parts.join(" \\\n")
}

fn generate_js_fetch(req: &CodeGenRequest) -> String {
    let mut lines = vec![];
    let has_auth = req.auth_header.as_ref().map_or(false, |a| !a.is_empty());
    let has_headers = !req.headers.is_empty() || has_auth;
    let has_body = req.body.as_ref().map_or(false, |b| !b.is_empty());

    lines.push(format!("const response = await fetch('{}', {{", req.url));
    lines.push(format!("  method: '{}',", req.method));

    if has_headers {
        lines.push("  headers: {".to_string());
        if let Some(auth) = &req.auth_header {
            if !auth.is_empty() {
                lines.push(format!(
                    "    'Authorization': '{}',",
                    escape_single(auth)
                ));
            }
        }
        for (key, value) in &req.headers {
            lines.push(format!(
                "    '{}': '{}',",
                escape_single(key),
                escape_single(value)
            ));
        }
        lines.push("  },".to_string());
    }

    if has_body {
        let body = req.body.as_ref().unwrap();
        let is_json = req
            .headers
            .iter()
            .any(|(k, v)| k.to_lowercase() == "content-type" && v.contains("json"));
        if is_json {
            lines.push(format!("  body: JSON.stringify({}),", body));
        } else {
            lines.push(format!("  body: '{}',", escape_single(body)));
        }
    }

    lines.push("});".to_string());
    lines.push(String::new());
    lines.push("const data = await response.json();".to_string());
    lines.push("console.log(data);".to_string());

    lines.join("\n")
}

fn generate_js_axios(req: &CodeGenRequest) -> String {
    let mut lines = vec![];
    let method_lower = req.method.to_lowercase();

    lines.push("import axios from 'axios';".to_string());
    lines.push(String::new());

    let has_body = req.body.as_ref().map_or(false, |b| !b.is_empty());
    let has_headers = !req.headers.is_empty();

    lines.push(format!(
        "const response = await axios.{}('{}'{});",
        method_lower,
        req.url,
        if has_body || has_headers {
            let mut config_parts = vec![];

            if has_body {
                let body = req.body.as_ref().unwrap();
                let is_json = req
                    .headers
                    .iter()
                    .any(|(k, v)| k.to_lowercase() == "content-type" && v.contains("json"));
                if is_json {
                    config_parts.push(format!(", {}", body));
                } else {
                    config_parts.push(format!(", '{}'", escape_single(body)));
                }
            } else if has_headers {
                config_parts.push(", null".to_string());
            }

            if has_headers {
                let mut headers_lines = vec![", {\n  headers: {".to_string()];
                for (key, value) in &req.headers {
                    headers_lines.push(format!(
                        "    '{}': '{}',",
                        escape_single(key),
                        escape_single(value)
                    ));
                }
                headers_lines.push("  }\n}".to_string());
                config_parts.push(headers_lines.join("\n"));
            }

            config_parts.join("")
        } else {
            String::new()
        }
    ));
    lines.push(String::new());
    lines.push("console.log(response.data);".to_string());

    lines.join("\n")
}

fn generate_python(req: &CodeGenRequest) -> String {
    let mut lines = vec![];
    lines.push("import requests".to_string());
    lines.push(String::new());

    let has_headers = !req.headers.is_empty();
    let has_body = req.body.as_ref().map_or(false, |b| !b.is_empty());

    if has_headers {
        lines.push("headers = {".to_string());
        for (key, value) in &req.headers {
            lines.push(format!(
                "    \"{}\": \"{}\",",
                escape_double(key),
                escape_double(value)
            ));
        }
        lines.push("}".to_string());
        lines.push(String::new());
    }

    let is_json = req
        .headers
        .iter()
        .any(|(k, v)| k.to_lowercase() == "content-type" && v.contains("json"));

    let method_lower = req.method.to_lowercase();
    let mut call = format!("response = requests.{}(\"{}\"", method_lower, req.url);
    if has_headers {
        call.push_str(", headers=headers");
    }
    if has_body {
        let body = req.body.as_ref().unwrap();
        if is_json {
            call.push_str(&format!(", json={}", body));
        } else {
            call.push_str(&format!(", data=\"{}\"", escape_double(body)));
        }
    }
    call.push(')');
    lines.push(call);

    lines.push(String::new());
    lines.push("print(response.status_code)".to_string());
    lines.push("print(response.json())".to_string());

    lines.join("\n")
}

fn generate_rust(req: &CodeGenRequest) -> String {
    let mut lines = vec![];
    lines.push("use reqwest;".to_string());
    lines.push(String::new());
    lines.push("#[tokio::main]".to_string());
    lines.push("async fn main() -> Result<(), reqwest::Error> {".to_string());
    lines.push("    let client = reqwest::Client::new();".to_string());

    let method_lower = req.method.to_lowercase();
    lines.push(format!(
        "    let response = client.{}(\"{}\")",
        method_lower, req.url
    ));

    for (key, value) in &req.headers {
        lines.push(format!(
            "        .header(\"{}\", \"{}\")",
            escape_double(key),
            escape_double(value)
        ));
    }

    if let Some(body) = &req.body {
        if !body.is_empty() {
            lines.push(format!("        .body(\"{}\")", escape_double(body)));
        }
    }

    lines.push("        .send()".to_string());
    lines.push("        .await?;".to_string());
    lines.push(String::new());
    lines.push("    println!(\"Status: {}\", response.status());".to_string());
    lines.push("    let body = response.text().await?;".to_string());
    lines.push("    println!(\"{}\", body);".to_string());
    lines.push("    Ok(())".to_string());
    lines.push("}".to_string());

    lines.join("\n")
}

fn generate_go(req: &CodeGenRequest) -> String {
    let mut lines = vec![];
    lines.push("package main".to_string());
    lines.push(String::new());
    lines.push("import (".to_string());
    lines.push("    \"fmt\"".to_string());
    lines.push("    \"io\"".to_string());
    lines.push("    \"net/http\"".to_string());

    let has_body = req.body.as_ref().map_or(false, |b| !b.is_empty());
    if has_body {
        lines.push("    \"strings\"".to_string());
    }

    lines.push(")".to_string());
    lines.push(String::new());
    lines.push("func main() {".to_string());

    if has_body {
        let body = req.body.as_ref().unwrap();
        lines.push(format!(
            "    body := strings.NewReader(`{}`)",
            body.replace('`', "` + \"`\" + `")
        ));
        lines.push(format!(
            "    req, err := http.NewRequest(\"{}\", \"{}\", body)",
            req.method, req.url
        ));
    } else {
        lines.push(format!(
            "    req, err := http.NewRequest(\"{}\", \"{}\", nil)",
            req.method, req.url
        ));
    }

    lines.push("    if err != nil {".to_string());
    lines.push("        panic(err)".to_string());
    lines.push("    }".to_string());

    for (key, value) in &req.headers {
        lines.push(format!(
            "    req.Header.Set(\"{}\", \"{}\")",
            escape_double(key),
            escape_double(value)
        ));
    }

    lines.push(String::new());
    lines.push("    resp, err := http.DefaultClient.Do(req)".to_string());
    lines.push("    if err != nil {".to_string());
    lines.push("        panic(err)".to_string());
    lines.push("    }".to_string());
    lines.push("    defer resp.Body.Close()".to_string());
    lines.push(String::new());
    lines.push("    respBody, _ := io.ReadAll(resp.Body)".to_string());
    lines.push("    fmt.Println(string(respBody))".to_string());
    lines.push("}".to_string());

    lines.join("\n")
}

fn generate_java(req: &CodeGenRequest) -> String {
    let mut lines = vec![];
    lines.push("import java.net.URI;".to_string());
    lines.push("import java.net.http.HttpClient;".to_string());
    lines.push("import java.net.http.HttpRequest;".to_string());
    lines.push("import java.net.http.HttpResponse;".to_string());
    lines.push(String::new());
    lines.push("public class Main {".to_string());
    lines.push(
        "    public static void main(String[] args) throws Exception {".to_string(),
    );
    lines.push("        HttpClient client = HttpClient.newHttpClient();".to_string());
    lines.push(String::new());

    let has_body = req.body.as_ref().map_or(false, |b| !b.is_empty());

    lines.push(format!(
        "        HttpRequest request = HttpRequest.newBuilder()",
    ));
    lines.push(format!(
        "            .uri(URI.create(\"{}\"))",
        req.url
    ));
    lines.push(format!(
        "            .method(\"{}\", {})",
        req.method,
        if has_body {
            format!(
                "HttpRequest.BodyPublishers.ofString(\"{}\")",
                escape_double(req.body.as_ref().unwrap())
            )
        } else {
            "HttpRequest.BodyPublishers.noBody()".to_string()
        }
    ));

    for (key, value) in &req.headers {
        lines.push(format!(
            "            .header(\"{}\", \"{}\")",
            escape_double(key),
            escape_double(value)
        ));
    }

    lines.push("            .build();".to_string());
    lines.push(String::new());
    lines.push(
        "        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());".to_string(),
    );
    lines.push("        System.out.println(response.statusCode());".to_string());
    lines.push("        System.out.println(response.body());".to_string());
    lines.push("    }".to_string());
    lines.push("}".to_string());

    lines.join("\n")
}

fn generate_csharp(req: &CodeGenRequest) -> String {
    let mut lines = vec![];
    lines.push("using System.Net.Http;".to_string());
    lines.push(String::new());
    lines.push("var client = new HttpClient();".to_string());
    lines.push(String::new());

    let has_body = req.body.as_ref().map_or(false, |b| !b.is_empty());

    lines.push(format!(
        "var request = new HttpRequestMessage(HttpMethod.{}, \"{}\");",
        capitalize_first(&req.method.to_lowercase()),
        req.url
    ));

    for (key, value) in &req.headers {
        lines.push(format!(
            "request.Headers.TryAddWithoutValidation(\"{}\", \"{}\");",
            escape_double(key),
            escape_double(value)
        ));
    }

    if has_body {
        let body = req.body.as_ref().unwrap();
        let content_type = req
            .headers
            .iter()
            .find(|(k, _)| k.to_lowercase() == "content-type")
            .map(|(_, v)| v.as_str())
            .unwrap_or("text/plain");
        lines.push(format!(
            "request.Content = new StringContent(\"{}\", System.Text.Encoding.UTF8, \"{}\");",
            escape_double(body),
            content_type
        ));
    }

    lines.push(String::new());
    lines.push("var response = await client.SendAsync(request);".to_string());
    lines.push("var body = await response.Content.ReadAsStringAsync();".to_string());
    lines.push("Console.WriteLine(body);".to_string());

    lines.join("\n")
}

fn generate_php(req: &CodeGenRequest) -> String {
    let mut lines = vec![];
    lines.push("<?php".to_string());
    lines.push(String::new());
    lines.push("$ch = curl_init();".to_string());
    lines.push(format!(
        "curl_setopt($ch, CURLOPT_URL, '{}');",
        escape_single(&req.url)
    ));
    lines.push("curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);".to_string());
    lines.push(format!(
        "curl_setopt($ch, CURLOPT_CUSTOMREQUEST, '{}');",
        req.method
    ));

    if !req.headers.is_empty() {
        lines.push("curl_setopt($ch, CURLOPT_HTTPHEADER, [".to_string());
        for (key, value) in &req.headers {
            lines.push(format!(
                "    '{}: {}',",
                escape_single(key),
                escape_single(value)
            ));
        }
        lines.push("]);".to_string());
    }

    if let Some(body) = &req.body {
        if !body.is_empty() {
            lines.push(format!(
                "curl_setopt($ch, CURLOPT_POSTFIELDS, '{}');",
                escape_single(body)
            ));
        }
    }

    lines.push(String::new());
    lines.push("$response = curl_exec($ch);".to_string());
    lines.push("curl_close($ch);".to_string());
    lines.push("echo $response;".to_string());

    lines.join("\n")
}

fn generate_ruby(req: &CodeGenRequest) -> String {
    let mut lines = vec![];
    lines.push("require 'net/http'".to_string());
    lines.push("require 'json'".to_string());
    lines.push(String::new());
    lines.push(format!("uri = URI('{}')", escape_single(&req.url)));
    lines.push("http = Net::HTTP.new(uri.host, uri.port)".to_string());
    lines.push("http.use_ssl = uri.scheme == 'https'".to_string());
    lines.push(String::new());

    lines.push(format!(
        "request = Net::HTTP::{}.new(uri)",
        capitalize_first(&req.method.to_lowercase())
    ));

    for (key, value) in &req.headers {
        lines.push(format!("request['{}'] = '{}'", key, escape_single(value)));
    }

    if let Some(body) = &req.body {
        if !body.is_empty() {
            lines.push(format!("request.body = '{}'", escape_single(body)));
        }
    }

    lines.push(String::new());
    lines.push("response = http.request(request)".to_string());
    lines.push("puts response.code".to_string());
    lines.push("puts response.body".to_string());

    lines.join("\n")
}

fn generate_swift(req: &CodeGenRequest) -> String {
    let mut lines = vec![];
    lines.push("import Foundation".to_string());
    lines.push(String::new());
    lines.push(format!(
        "let url = URL(string: \"{}\")!",
        req.url
    ));
    lines.push("var request = URLRequest(url: url)".to_string());
    lines.push(format!(
        "request.httpMethod = \"{}\"",
        req.method
    ));

    for (key, value) in &req.headers {
        lines.push(format!(
            "request.setValue(\"{}\", forHTTPHeaderField: \"{}\")",
            escape_double(value),
            escape_double(key)
        ));
    }

    if let Some(body) = &req.body {
        if !body.is_empty() {
            lines.push(format!(
                "request.httpBody = \"{}\".data(using: .utf8)",
                escape_double(body)
            ));
        }
    }

    lines.push(String::new());
    lines.push("let (data, response) = try await URLSession.shared.data(for: request)".to_string());
    lines.push("let httpResponse = response as! HTTPURLResponse".to_string());
    lines.push("print(httpResponse.statusCode)".to_string());
    lines.push("print(String(data: data, encoding: .utf8)!)".to_string());

    lines.join("\n")
}

fn capitalize_first(s: &str) -> String {
    let mut c = s.chars();
    match c.next() {
        None => String::new(),
        Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
    }
}
